/**
 * queue-kader.service.ts — Kader-side antrian operations + Redis lock-screen
 *
 * KRITIS (CLAUDE.md §Antrian):
 *   - SELECT FOR UPDATE wajib via prisma.$transaction + $queryRaw
 *   - broadcastQueueUpdate WAJIB dipanggil DI LUAR prisma.$transaction
 *   - WA notification via BullMQ (enqueue) — tidak pernah Fonnte langsung
 *
 * Redis key: kader:{kaderId}:activeMeja — format: "${mejaNumber}:${slotId}"
 * kaderId selalu dari JWT (req.user.userId), TIDAK dari request body (T-03-02-04)
 */
import pino from 'pino'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/db'
import { redis } from '../../config/redis'
import { env } from '../../config/env'
import { broadcastQueueUpdate } from '../antrian/antrian.service'
import { notificationQueue } from '../notification/notification.queue'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

const ACTIVE_MEJA_TTL = 86400 // 24 jam

function activeMejaKey(kaderId: string) {
  return `kader:${kaderId}:activeMeja`
}

// ── Lock-screen Redis operations ──────────────────────────────────────────

export async function getActiveMeja(kaderId: string): Promise<{ activeMeja: number; slotId: string } | null> {
  const value = await redis.get(activeMejaKey(kaderId))
  if (!value) return null
  const colonIdx = value.indexOf(':')
  if (colonIdx === -1) return null
  const mejaStr = value.slice(0, colonIdx)
  const slotId = value.slice(colonIdx + 1)
  const activeMeja = Number(mejaStr)
  if (isNaN(activeMeja)) return null
  return { activeMeja, slotId }
}

export async function setActiveMeja(kaderId: string, mejaNumber: number, slotId: string): Promise<void> {
  await redis.set(activeMejaKey(kaderId), `${mejaNumber}:${slotId}`, 'EX', ACTIVE_MEJA_TTL)
}

export async function clearActiveMeja(kaderId: string): Promise<void> {
  await redis.del(activeMejaKey(kaderId))
}

// ── Slot antrian list ─────────────────────────────────────────────────────

export async function getSlotAntrian(slotId: string) {
  return prisma.antrian.findMany({
    where: {
      slotId,
      statusAntrian: { in: ['menunggu', 'dipanggil', 'sedang_dilayani', 'ditangguhkan', 'selesai'] },
    },
    include: {
      balita: { select: { namaBalita: true, jenisKelamin: true, tanggalLahir: true } },
      warga: { select: { rt: true } },
      pemeriksaan: {
        where: { beratBadan: { not: null } },
        select: { id: true, beratBadan: true, tinggiBadan: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { nomorUrut: 'asc' },
  })
}

// ── Dashboard stats (KaderDashboardPage) ──────────────────────────────────

/**
 * getKaderDashboardStats — statistik populasi balita untuk dashboard kader.
 *
 * T-08-06-01 Mitigation (IDOR): kaderId SELALU dari JWT (parameter fungsi ini),
 * TIDAK PERNAH dari query params. posyanduId di-resolve dari DB via kaderId.
 * T-08-06-02 Mitigation (SQL Injection): semua $queryRaw menggunakan tagged
 * template literals — Prisma otomatis parameterisasi nilai interpolasi.
 */
export async function getKaderDashboardStats(kaderId: string): Promise<{
  posyanduNama: string
  totalBalita: number
  risikoStunting: number
  hadirHariIni: number
  trenGiziBulanan: Array<{ bulan: string; normal: number; kurang: number; buruk: number; pendek: number }>
  distribusiGiziBulanIni: { normal: number; kurang: number; buruk: number; pendek: number }
  peringatanRisiko: Array<{
    balitaId: string
    namaBalita: string
    zScoreBbU: number | null
    zScoreTbU: number | null
    statusGizi: string
  }>
  daftarBalita: Array<{
    balitaId: string
    namaBalita: string
    nikBalita: string | null
    tanggalLahir: string
    jenisKelamin: string
    usiaMonths: number
    zScoreBbU: number | null
    zScoreTbU: number | null
    statusGizi: string | null
    beratBadan: number | null
    tinggiBadan: number | null
  }>
}> {
  // Step A: posyanduId dari kader (sumber: JWT via kaderId — IDOR guard T-08-06-01)
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    select: { posyanduId: true, posyandu: { select: { namaPosyandu: true } } },
  })
  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }
  const posyanduId = kader.posyanduId

  // WIB date untuk hadirHariIni (UTC+7) — teknik sama dengan getTodaySlots
  const nowUtc = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  const nowWib = new Date(nowUtc.getTime() + wibOffset)
  const todayStr = [
    String(nowWib.getUTCFullYear()),
    String(nowWib.getUTCMonth() + 1).padStart(2, '0'),
    String(nowWib.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`)

  // Steps B–H paralel (setelah posyanduId resolved)
  const [
    totalBalita,
    hadirHariIni,
    risikoRows,
    trenRaw,
    distribusiRaw,
    pemeriksaanRisiko,
    daftarBalitaRaw,
  ] = await Promise.all([
    // B: total balita di posyandu (filter via warga.posyanduUtamaId — IDOR safe)
    prisma.balita.count({
      where: { warga: { posyanduUtamaId: posyanduId } },
    }),

    // C: hadir hari ini (waktuCheckin tidak null + jadwal posyandu hari ini WIB)
    prisma.antrian.count({
      where: {
        slotSesi: {
          jadwal: {
            posyanduId,
            tanggalPelaksanaan: { equals: todayDate },
          },
        },
        waktuCheckin: { not: null },
      },
    }),

    // D: balita dengan pemeriksaan terakhir statusGizi risiko (LATERAL JOIN)
    // T-08-06-02: posyanduId via tagged template literal — parameterized, bukan concatenated
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT b.id)::int AS count
      FROM balita b
      JOIN warga w ON b."wargaId" = w.id
      JOIN LATERAL (
        SELECT p."statusGizi"
        FROM pemeriksaan p
        WHERE p."balitaId" = b.id
        ORDER BY p."tanggalPemeriksaan" DESC
        LIMIT 1
      ) latest ON TRUE
      WHERE w."posyanduUtamaId" = ${posyanduId}
        AND latest."statusGizi" IN ('kurang', 'buruk', 'pendek', 'sangat_pendek')
    `,

    // E: trenGiziBulanan — 6 bulan terakhir (grouped by bulan + statusGizi)
    prisma.$queryRaw<Array<{ bulan: string; statusGizi: string; jumlah: number }>>`
      SELECT
        TO_CHAR(p."tanggalPemeriksaan", 'YYYY-MM') AS bulan,
        p."statusGizi",
        COUNT(*)::int AS jumlah
      FROM pemeriksaan p
      JOIN balita b ON p."balitaId" = b.id
      JOIN warga w ON b."wargaId" = w.id
      WHERE w."posyanduUtamaId" = ${posyanduId}
        AND p."tanggalPemeriksaan" >= (NOW() AT TIME ZONE 'Asia/Jakarta' - INTERVAL '5 months')::date
        AND p."statusGizi" IS NOT NULL
      GROUP BY bulan, p."statusGizi"
      ORDER BY bulan
    `,

    // F: distribusiGiziBulanIni — bulan berjalan
    prisma.$queryRaw<Array<{ statusGizi: string; jumlah: number }>>`
      SELECT
        p."statusGizi",
        COUNT(*)::int AS jumlah
      FROM pemeriksaan p
      JOIN balita b ON p."balitaId" = b.id
      JOIN warga w ON b."wargaId" = w.id
      WHERE w."posyanduUtamaId" = ${posyanduId}
        AND TO_CHAR(p."tanggalPemeriksaan", 'YYYY-MM') = TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM')
        AND p."statusGizi" IS NOT NULL
      GROUP BY p."statusGizi"
    `,

    // G: peringatanRisiko — latest pemeriksaan per balita, hanya yang berisiko
    prisma.$queryRaw<Array<{
      balitaId: string
      namaBalita: string
      zScoreBbU: number | null
      zScoreTbU: number | null
      statusGizi: string
    }>>`
      SELECT DISTINCT ON (b.id)
        b.id AS "balitaId",
        b."namaBalita",
        p."zScoreBbU",
        p."zScoreTbU",
        p."statusGizi"
      FROM balita b
      JOIN warga w ON b."wargaId" = w.id
      JOIN pemeriksaan p ON p."balitaId" = b.id
      WHERE w."posyanduUtamaId" = ${posyanduId}
        AND p."statusGizi" IN ('kurang', 'buruk', 'pendek', 'sangat_pendek')
      ORDER BY b.id, p."tanggalPemeriksaan" DESC
      LIMIT 10
    `,

    // H: daftarBalita — semua balita di posyandu + pemeriksaan terakhir
    prisma.$queryRaw<Array<{
      balitaId: string
      namaBalita: string
      nikBalita: string | null
      tanggalLahir: Date
      jenisKelamin: string
      zScoreBbU: number | null
      zScoreTbU: number | null
      statusGizi: string | null
      beratBadan: number | null
      tinggiBadan: number | null
    }>>`
      SELECT
        b.id AS "balitaId",
        b."namaBalita",
        b."nikBalita",
        b."tanggalLahir",
        b."jenisKelamin",
        latest."zScoreBbU",
        latest."zScoreTbU",
        latest."statusGizi",
        latest."beratBadan",
        latest."tinggiBadan"
      FROM balita b
      JOIN warga w ON b."wargaId" = w.id
      LEFT JOIN LATERAL (
        SELECT p."zScoreBbU", p."zScoreTbU", p."statusGizi", p."beratBadan", p."tinggiBadan"
        FROM pemeriksaan p
        WHERE p."balitaId" = b.id
        ORDER BY p."tanggalPemeriksaan" DESC
        LIMIT 1
      ) latest ON TRUE
      WHERE w."posyanduUtamaId" = ${posyanduId}
      ORDER BY b."namaBalita"
    `,
  ])

  // D: risikoStunting
  const risikoStunting = Number(risikoRows[0]?.count ?? 0)

  // E: transform ke { bulan, normal, kurang, buruk, pendek }
  const trenMap = new Map<string, { bulan: string; normal: number; kurang: number; buruk: number; pendek: number }>()
  for (const row of trenRaw) {
    if (!trenMap.has(row.bulan)) {
      trenMap.set(row.bulan, { bulan: row.bulan, normal: 0, kurang: 0, buruk: 0, pendek: 0 })
    }
    const entry = trenMap.get(row.bulan)!
    const jumlah = Number(row.jumlah)
    if (row.statusGizi === 'normal') entry.normal += jumlah
    else if (row.statusGizi === 'kurang') entry.kurang += jumlah
    else if (row.statusGizi === 'buruk') entry.buruk += jumlah
    else if (row.statusGizi === 'pendek' || row.statusGizi === 'sangat_pendek') entry.pendek += jumlah
  }
  const trenGiziBulanan = Array.from(trenMap.values())

  // F: distribusiGiziBulanIni
  const distribusiGiziBulanIni = { normal: 0, kurang: 0, buruk: 0, pendek: 0 }
  for (const row of distribusiRaw) {
    const jumlah = Number(row.jumlah)
    if (row.statusGizi === 'normal') distribusiGiziBulanIni.normal += jumlah
    else if (row.statusGizi === 'kurang') distribusiGiziBulanIni.kurang += jumlah
    else if (row.statusGizi === 'buruk') distribusiGiziBulanIni.buruk += jumlah
    else if (row.statusGizi === 'pendek' || row.statusGizi === 'sangat_pendek') distribusiGiziBulanIni.pendek += jumlah
  }

  // G: sudah DISTINCT ON dari query — sort by zScoreBbU ascending (terburuk duluan)
  const peringatanRisiko = pemeriksaanRisiko
    .sort((a, b) => (a.zScoreBbU ?? 0) - (b.zScoreBbU ?? 0))
    .map((p) => ({
      balitaId: p.balitaId,
      namaBalita: p.namaBalita,
      zScoreBbU: p.zScoreBbU !== null ? Number(p.zScoreBbU) : null,
      zScoreTbU: p.zScoreTbU !== null ? Number(p.zScoreTbU) : null,
      statusGizi: p.statusGizi,
    }))

  // H: daftarBalita — hitung usia dalam bulan dari tanggalLahir
  const nowForAge = new Date()
  const daftarBalita = daftarBalitaRaw.map((b) => {
    const lahir = new Date(b.tanggalLahir)
    const usiaMonths = Math.floor(
      (nowForAge.getTime() - lahir.getTime()) / (30.4375 * 24 * 60 * 60 * 1000)
    )
    return {
      balitaId: b.balitaId,
      namaBalita: b.namaBalita,
      nikBalita: b.nikBalita ?? null,
      tanggalLahir: lahir.toISOString().split('T')[0],
      jenisKelamin: b.jenisKelamin,
      usiaMonths,
      zScoreBbU: b.zScoreBbU !== null ? Number(b.zScoreBbU) : null,
      zScoreTbU: b.zScoreTbU !== null ? Number(b.zScoreTbU) : null,
      statusGizi: b.statusGizi ?? null,
      beratBadan: b.beratBadan !== null ? Number(b.beratBadan) : null,
      tinggiBadan: b.tinggiBadan !== null ? Number(b.tinggiBadan) : null,
    }
  })

  logger.debug({ kaderId }, 'getKaderDashboardStats called')

  return {
    posyanduNama: kader.posyandu.namaPosyandu,
    totalBalita,
    risikoStunting,
    hadirHariIni,
    trenGiziBulanan,
    distribusiGiziBulanIni,
    peringatanRisiko,
    daftarBalita,
  }
}

// ── hadir (Meja 1) ────────────────────────────────────────────────────────

/**
 * hadirAntrian — Kader tandai balita hadir → statusAntrian = 'dipanggil'
 *
 * T-03-02-05 Mitigation: SELECT FOR UPDATE mencegah double-hadir concurrent.
 * T-03-02-01 Mitigation: IDOR guard verifikasi kader.posyanduId === jadwal.posyanduId.
 * broadcastQueueUpdate WAJIB di luar transaksi (CLAUDE.md §Antrian point 3).
 */
export async function hadirAntrian(antrianId: string, kaderId: string): Promise<{ slotId: string }> {
  // IDOR guard: ambil posyanduId kader sebelum masuk transaksi
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    select: { posyanduId: true },
  })
  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }

  const txResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // SELECT FOR UPDATE — cegah race condition double-hadir (T-03-02-05)
    const rows = await tx.$queryRaw<Array<{ id: string; statusAntrian: string; slotId: string }>>`
      SELECT id, "statusAntrian", "slotId" FROM antrian WHERE id = ${antrianId} FOR UPDATE
    `
    const row = rows[0]
    if (!row) {
      throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
    }
    if (!['menunggu', 'ditangguhkan'].includes(row.statusAntrian)) {
      throw Object.assign(new Error('Antrian sudah diproses'), { code: 'ANTRIAN_STATUS_TIDAK_VALID' })
    }

    // IDOR: verifikasi kader hanya bisa operasikan antrian di posyanduId-nya (T-03-02-01)
    const antrianDetail = await tx.antrian.findUnique({
      where: { id: antrianId },
      include: { slotSesi: { include: { jadwal: { select: { posyanduId: true } } } } },
    })
    if (antrianDetail?.slotSesi.jadwal.posyanduId !== kader.posyanduId) {
      throw Object.assign(new Error('Akses ditolak — antrian bukan milik posyandu Anda'), {
        code: 'FORBIDDEN_POSYANDU',
      })
    }

    const now = new Date()
    await tx.antrian.update({
      where: { id: antrianId },
      data: { statusAntrian: 'dipanggil', waktuCheckin: now, waktuMulaiLayanan: now },
    })

    return { slotId: row.slotId }
  })

  // WAJIB di luar transaksi (CLAUDE.md §Antrian + T-02-14)
  void broadcastQueueUpdate(txResult.slotId)

  // BullMQ: enqueue WA dipanggil notification (CLAUDE.md §WhatsApp)
  void notificationQueue.add(
    'dipanggil_whatsapp',
    { antrianId },
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  )

  logger.info({ antrianId, kaderId }, 'Antrian dipanggil')
  return txResult
}

// ── tangguhkan ────────────────────────────────────────────────────────────

export async function tangguhkanAntrian(antrianId: string, kaderId: string): Promise<{ slotId: string }> {
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    select: { posyanduId: true },
  })
  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }

  const txResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<Array<{ id: string; statusAntrian: string; slotId: string }>>`
      SELECT id, "statusAntrian", "slotId" FROM antrian WHERE id = ${antrianId} FOR UPDATE
    `
    const row = rows[0]
    if (!row) {
      throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
    }
    if (!['menunggu', 'dipanggil'].includes(row.statusAntrian)) {
      throw Object.assign(new Error('Hanya antrian menunggu atau dipanggil yang bisa ditangguhkan'), {
        code: 'ANTRIAN_STATUS_TIDAK_VALID',
      })
    }

    // IDOR guard
    const antrianDetail = await tx.antrian.findUnique({
      where: { id: antrianId },
      include: { slotSesi: { include: { jadwal: { select: { posyanduId: true } } } } },
    })
    if (antrianDetail?.slotSesi.jadwal.posyanduId !== kader.posyanduId) {
      throw Object.assign(new Error('Akses ditolak'), { code: 'FORBIDDEN_POSYANDU' })
    }

    await tx.antrian.update({
      where: { id: antrianId },
      data: { statusAntrian: 'ditangguhkan' },
    })

    return { slotId: row.slotId }
  })

  void broadcastQueueUpdate(txResult.slotId)

  logger.info({ antrianId, kaderId }, 'Antrian ditangguhkan')
  return txResult
}

// ── Today's slots for kader posyandu ─────────────────────────────────────

export async function getTodaySlots(kaderId: string) {
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    select: { posyanduId: true },
  })
  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }

  // Ambil jadwal hari ini untuk posyandu kader — gunakan tanggal WIB (UTC+7)
  const nowUtc = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  const nowWib = new Date(nowUtc.getTime() + wibOffset)
  const todayStart = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()))
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const jadwal = await prisma.jadwal.findFirst({
    where: {
      posyanduId: kader.posyanduId,
      tanggalPelaksanaan: { gte: todayStart, lt: todayEnd },
      statusJadwal: { in: ['aktif', 'terkunci'] },
    },
    include: {
      slotSesi: {
        orderBy: { nomorSesi: 'asc' },
        include: {
          _count: {
            select: {
              antrian: {
                where: { statusAntrian: { in: ['menunggu', 'dipanggil', 'sedang_dilayani', 'ditangguhkan', 'selesai'] } },
              },
            },
          },
        },
      },
    },
  })

  if (!jadwal) return null

  return {
    jadwalId: jadwal.id,
    tanggalPelaksanaan: jadwal.tanggalPelaksanaan,
    estimasiDurasiMenit: jadwal.estimasiDurasiMenit,
    statusJadwal: jadwal.statusJadwal,
    slotSesi: jadwal.slotSesi.map((s) => ({
      id: s.id,
      nomorSesi: s.nomorSesi,
      labelSesi: s.labelSesi,
      jamMulai: s.jamMulai.toISOString().substring(11, 16),
      jamSelesai: s.jamSelesai.toISOString().substring(11, 16),
      kuota: s.kuota,
      terisi: s.terisi,
      durasiRataAktual: s.durasiRataAktual,
      totalAntrian: s._count.antrian,
    })),
  }
}

// ── getAntrianDetail (Meja 2: fetch balita info) ─────────────────────────

/**
 * getAntrianDetail — Return antrian dengan info balita untuk Meja 2.
 *
 * T-03-04-03 Mitigation: IDOR guard verifikasi kader.posyanduId === jadwal.posyanduId.
 * Kader hanya bisa akses antrian milik posyandu-nya.
 *
 * @param antrianId  ID antrian
 * @param kaderId    ID kader dari JWT (req.user.userId)
 */
export async function getAntrianDetail(antrianId: string, kaderId: string) {
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    select: { posyanduId: true },
  })
  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }

  const antrian = await prisma.antrian.findUnique({
    where: { id: antrianId },
    include: {
      balita: {
        select: {
          id: true,
          namaBalita: true,
          jenisKelamin: true,
          tanggalLahir: true,
        },
      },
      slotSesi: {
        include: {
          jadwal: { select: { posyanduId: true } },
        },
      },
    },
  })

  if (!antrian) {
    throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
  }

  // IDOR: kader hanya bisa lihat antrian posyanduId-nya (T-03-04-03)
  if (antrian.slotSesi.jadwal.posyanduId !== kader.posyanduId) {
    throw Object.assign(new Error('Akses ditolak — antrian bukan milik posyandu Anda'), {
      code: 'FORBIDDEN_POSYANDU',
    })
  }

  return {
    id: antrian.id,
    nomorUrut: antrian.nomorUrut,
    statusAntrian: antrian.statusAntrian,
    slotId: antrian.slotId,
    balitaId: antrian.balitaId,
    namaBalita: antrian.balita.namaBalita,
    jenisKelamin: antrian.balita.jenisKelamin,
    tanggalLahir: antrian.balita.tanggalLahir,
  }
}

// ── selesaikan (Meja 5) ───────────────────────────────────────────────────

/**
 * selesaikanAntrian — Kader tandai balita selesai → statusAntrian = 'selesai' + CMA update.
 *
 * QUEUE-05: Update SlotSesi.durasiRataAktual dengan Cumulative Moving Average setiap selesai.
 * Formula: n<=1 ? durasiLayanan : (oldAvg*(n-1)+durasiLayanan)/n
 *   - n = jumlah antrian 'selesai' di slot ini SETELAH update ini
 *   - Sanity guard: hanya update jika 0 < durasiLayanan < 60 menit
 *
 * T-03-07-01 Mitigation: SELECT FOR UPDATE mencegah double-selesai concurrent.
 *   Jika statusAntrian sudah 'selesai', throws ANTRIAN_BELUM_AKTIF (bukan 'dipanggil').
 * T-03-07-04 Mitigation: IDOR guard verifikasi kader.posyanduId === jadwal.posyanduId.
 * broadcastQueueUpdate WAJIB dipanggil DI LUAR transaksi (CLAUDE.md §Antrian + T-02-14).
 */
export async function selesaikanAntrian(
  antrianId: string,
  kaderId: string
): Promise<{ slotId: string; durasiRataAktual: number | null }> {
  // IDOR guard: ambil posyanduId kader sebelum masuk transaksi
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    select: { posyanduId: true },
  })
  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }

  let finalDurasiRataAktual: number | null = null

  const txResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // SELECT FOR UPDATE — cegah race condition double-selesai (T-03-07-01)
    const rows = await tx.$queryRaw<Array<{
      id: string
      statusAntrian: string
      slotId: string
      waktuMulaiLayanan: Date | null
    }>>`
      SELECT id, "statusAntrian", "slotId", "waktuMulaiLayanan"
      FROM antrian WHERE id = ${antrianId} FOR UPDATE
    `
    const antrian = rows[0]
    if (!antrian) {
      throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
    }
    // T-03-07-01: hanya 'dipanggil'/'sedang_dilayani' yang bisa selesai
    if (!['dipanggil', 'sedang_dilayani'].includes(antrian.statusAntrian)) {
      throw Object.assign(new Error('Antrian belum aktif'), {
        code: 'ANTRIAN_BELUM_AKTIF',
      })
    }

    // IDOR: kader hanya bisa operasikan antrian di posyanduId-nya (T-03-07-04)
    const antrianDetail = await tx.antrian.findUnique({
      where: { id: antrianId },
      include: { slotSesi: { include: { jadwal: { select: { posyanduId: true } } } } },
    })
    if (antrianDetail?.slotSesi.jadwal.posyanduId !== kader.posyanduId) {
      throw Object.assign(new Error('Akses ditolak — antrian bukan milik posyandu Anda'), {
        code: 'FORBIDDEN_POSYANDU',
      })
    }

    const waktuSelesai = new Date()
    const durasiLayananBaru = antrian.waktuMulaiLayanan
      ? (waktuSelesai.getTime() - antrian.waktuMulaiLayanan.getTime()) / 60000
      : null

    // Update status antrian
    await tx.antrian.update({
      where: { id: antrianId },
      data: { statusAntrian: 'selesai', waktuSelesai },
    })

    // CMA moving average — hanya jika durasi valid (> 0 dan < 60 menit sanity guard)
    if (durasiLayananBaru !== null && durasiLayananBaru > 0 && durasiLayananBaru < 60) {
      const slot = await tx.slotSesi.findUnique({
        where: { id: antrian.slotId },
        select: { durasiRataAktual: true },
      })

      // n = jumlah antrian selesai setelah update ini (include antrian ini sendiri)
      const n = await tx.antrian.count({
        where: { slotId: antrian.slotId, statusAntrian: 'selesai' },
      })

      const oldAvg = slot?.durasiRataAktual ?? durasiLayananBaru
      const newAvg =
        n <= 1
          ? durasiLayananBaru
          : (oldAvg * (n - 1) + durasiLayananBaru) / n

      await tx.slotSesi.update({
        where: { id: antrian.slotId },
        data: { durasiRataAktual: newAvg },
      })

      finalDurasiRataAktual = newAvg
    }

    return { slotId: antrian.slotId }
  })

  // Broadcast WAJIB di luar transaksi (CLAUDE.md §Antrian + T-02-14)
  void broadcastQueueUpdate(txResult.slotId)

  // BullMQ: enqueue WA selesai notification (CLAUDE.md §WhatsApp)
  void notificationQueue.add(
    'selesai_whatsapp',
    { antrianId },
    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  )

  logger.info({ antrianId, kaderId, durasiRataAktual: finalDurasiRataAktual }, 'Antrian selesai')
  return { slotId: txResult.slotId, durasiRataAktual: finalDurasiRataAktual }
}

// ── go-show (daftar manual) ───────────────────────────────────────────────

export async function goShowAntrian(
  slotId: string,
  balitaId: string,
  wargaId: string,
  kaderId: string
): Promise<{ antrianId: string; nomorUrut: number }> {
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    select: { posyanduId: true },
  })
  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }

  const txResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // SELECT FOR UPDATE on slot — cegah race condition melewati kuota
    const slots = await tx.$queryRaw<Array<{ id: string; kuota: number; terisi: number; jadwalId: string }>>`
      SELECT id, kuota, terisi, "jadwalId" FROM slot_sesi WHERE id = ${slotId} FOR UPDATE
    `
    const slot = slots[0]
    if (!slot) {
      throw Object.assign(new Error('Slot tidak ditemukan'), { code: 'SLOT_TIDAK_DITEMUKAN' })
    }
    if (slot.terisi >= slot.kuota) {
      throw Object.assign(new Error('Slot sudah penuh'), { code: 'SLOT_PENUH' })
    }

    // IDOR: verifikasi slot milik posyandu kader
    const jadwal = await tx.jadwal.findUnique({
      where: { id: slot.jadwalId },
      select: { posyanduId: true },
    })
    if (jadwal?.posyanduId !== kader.posyanduId) {
      throw Object.assign(new Error('Akses ditolak'), { code: 'FORBIDDEN_POSYANDU' })
    }

    // Cek duplikasi balita di sesi ini
    const existing = await tx.antrian.findUnique({
      where: { slotId_balitaId: { slotId, balitaId } },
    })
    if (existing) {
      throw Object.assign(new Error('Balita sudah terdaftar di sesi ini'), { code: 'SUDAH_DAFTAR' })
    }

    // nomorUrut = terisi lama + 1 (analog dengan ambilAntrian)
    const nomorUrut = slot.terisi + 1

    await tx.slotSesi.update({
      where: { id: slotId },
      data: { terisi: { increment: 1 } },
    })

    const antrian = await tx.antrian.create({
      data: {
        slotId,
        balitaId,
        wargaId,
        nomorUrut,
        isDaftarManual: true,
        statusAntrian: 'menunggu',
      },
    })

    return { antrianId: antrian.id, nomorUrut }
  })

  void broadcastQueueUpdate(slotId)

  logger.info({ slotId, balitaId, kaderId }, 'Go-show antrian created')
  return txResult
}
