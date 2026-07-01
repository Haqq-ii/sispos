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
      statusAntrian: { in: ['menunggu', 'dipanggil', 'ditangguhkan'] },
    },
    include: {
      balita: { select: { namaBalita: true, jenisKelamin: true, tanggalLahir: true } },
      warga: { select: { rt: true } },
    },
    orderBy: { nomorUrut: 'asc' },
  })
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
    if (row.statusAntrian !== 'dipanggil') {
      throw Object.assign(new Error('Hanya antrian dengan status dipanggil yang bisa ditangguhkan'), {
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
                where: { statusAntrian: { in: ['menunggu', 'dipanggil', 'ditangguhkan', 'selesai'] } },
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
