/**
 * antrian.service.ts — Antrian business logic
 *
 * KRITIS (CLAUDE.md §Antrian):
 *   1. SELECT FOR UPDATE wajib via prisma.$transaction + $queryRaw — BUKAN Prisma fluent API alone
 *   2. $queryRaw: kolom camelCase harus di-quote (e.g. "jadwalId", "durasiRataAktual")
 *   3. broadcastQueueUpdate WAJIB dipanggil DI LUAR blok prisma.$transaction (setelah commit)
 *   4. Selalu guard `if (!io) return` sebelum io.to().emit()
 *   5. WA notification SELALU via BullMQ — tidak pernah Fonnte langsung
 *   6. Ownership check: findFirst({ where: { id, wargaId } }) — mencegah ID enumeration (T-02-10, T-02-11)
 */
import pino from 'pino'
import { prisma } from '../../config/db'
import { io } from '../../config/socket'
import { env } from '../../config/env'
import { enqueueAntrianWaJob } from '../notification/notification.queue'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Tipe kembalian internal dari transaksi ────────────────────────────────
interface TransactionResult {
  antrianId: string
  nomorUrut: number
  slotId: string
  jadwal: {
    estimasiDurasiMenit: number
    tanggalPelaksanaan: Date
    posyandu: { namaPosyandu: string }
  }
  labelSesi: string
  wargaNomorPonsel: string
}

// ── Tipe kembalian publik dari ambilAntrian ───────────────────────────────
export interface AmbilAntrianResult {
  antrianId: string
  nomorUrut: number
  estimasiMenit: number
  slotId: string
  wargaNomorPonsel: string
  namaPosyandu: string
  tanggalPelaksanaan: string // DD/MM/YYYY — untuk WA notification
  labelSesi: string
}

/**
 * ambilAntrian — Ambil slot antrian dengan SELECT FOR UPDATE guard.
 *
 * Race condition protection:
 *   - $queryRaw SELECT ... FOR UPDATE menahan row-level lock sampai commit
 *   - Dua request concurrent di slot sisa 1: hanya 1 yang menang (201)
 *   - Yang kalah mendapat 409 SLOT_PENUH setelah lock dilepas dan terisi >= kuota
 *
 * T-02-09 Mitigation: SELECT FOR UPDATE + terisi >= kuota check inside lock.
 * T-02-12 Mitigation: nomorPonsel diambil dari DB (bukan dari request body).
 */
export async function ambilAntrian(
  slotId: string,
  balitaId: string,
  wargaId: string
): Promise<AmbilAntrianResult> {
  // ── Dalam transaksi: lock + check + create ──────────────────────────────
  const txResult = await prisma.$transaction(async (tx) => {
    // 1. Lock row slot_sesi — tidak ada transaksi lain yang bisa baca/tulis baris ini
    //    PENTING: camelCase column names harus di-quote dalam raw SQL ("jadwalId", "durasiRataAktual")
    const slots = await tx.$queryRaw<
      Array<{
        id: string
        kuota: number
        terisi: number
        jadwalId: string
        durasiRataAktual: number | null
      }>
    >`
      SELECT id, kuota, terisi, "jadwalId", "durasiRataAktual"
      FROM slot_sesi
      WHERE id = ${slotId}
      FOR UPDATE
    `

    const [slot] = slots
    if (!slot) {
      throw Object.assign(new Error('Slot tidak ditemukan'), { code: 'SLOT_TIDAK_DITEMUKAN' })
    }
    if (slot.terisi >= slot.kuota) {
      throw Object.assign(new Error('Slot penuh'), { code: 'SLOT_PENUH' })
    }

    // 2. Ambil data warga — untuk nomorPonsel WA notification dan posyanduUtamaId
    const warga = await tx.warga.findUnique({
      where: { id: wargaId },
      select: { posyanduUtamaId: true, nomorPonsel: true },
    })

    // 3. Cek duplikasi: balita yang sama di sesi yang sama
    const existing = await tx.antrian.findUnique({
      where: { slotId_balitaId: { slotId, balitaId } },
    })
    if (existing) {
      throw Object.assign(new Error('Balita sudah terdaftar di sesi ini'), { code: 'SUDAH_DAFTAR' })
    }

    // 4. Increment terisi (di dalam lock — aman dari race condition)
    await tx.slotSesi.update({
      where: { id: slotId },
      data: { terisi: { increment: 1 } },
    })

    // nomorUrut = nilai terisi LAMA + 1 (sebelum increment, sesuai urutan pendaftaran)
    const nomorUrut = slot.terisi + 1

    // 5. Buat record Antrian
    const antrian = await tx.antrian.create({
      data: {
        slotId,
        balitaId,
        wargaId,
        nomorUrut,
        statusAntrian: 'menunggu',
      },
      include: {
        slotSesi: {
          include: {
            jadwal: {
              include: { posyandu: true },
            },
          },
        },
      },
    })

    const result: TransactionResult = {
      antrianId: antrian.id,
      nomorUrut,
      slotId,
      jadwal: {
        estimasiDurasiMenit: antrian.slotSesi.jadwal.estimasiDurasiMenit,
        tanggalPelaksanaan: antrian.slotSesi.jadwal.tanggalPelaksanaan,
        posyandu: { namaPosyandu: antrian.slotSesi.jadwal.posyandu.namaPosyandu },
      },
      labelSesi: antrian.slotSesi.labelSesi,
      wargaNomorPonsel: warga?.nomorPonsel ?? '',
    }

    return result
  })

  // ── Di luar transaksi: komputasi + broadcast + (Task 2: BullMQ enqueue) ──

  // Formula D-03: estimasiMenit = nomorUrut × estimasiDurasiMenit (nomorAktif = 0 Phase 2)
  const estimasiMenit = txResult.nomorUrut * txResult.jadwal.estimasiDurasiMenit

  // Format tanggal DD/MM/YYYY dalam WIB — untuk pesan WA
  const tanggalPelaksanaan = txResult.jadwal.tanggalPelaksanaan.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })

  // Broadcast queue update ke room sesi:{slotId} — WAJIB di luar transaksi (T-02-14)
  void broadcastQueueUpdate(txResult.slotId)

  // Enqueue WA notification via BullMQ — TIDAK PERNAH panggil Fonnte langsung (CLAUDE.md §WhatsApp)
  // T-02-12: nomorPonsel berasal dari DB (txResult.wargaNomorPonsel), bukan request body
  void enqueueAntrianWaJob({
    nomorPonsel: txResult.wargaNomorPonsel,
    nomorUrut: txResult.nomorUrut,
    estimasiMenit,
    namaPosyandu: txResult.jadwal.posyandu.namaPosyandu,
    tanggalPelaksanaan,
    labelSesi: txResult.labelSesi,
  })

  logger.info(
    { antrianId: txResult.antrianId, nomorUrut: txResult.nomorUrut, slotId: txResult.slotId },
    'Antrian berhasil dibuat'
  )

  return {
    antrianId: txResult.antrianId,
    nomorUrut: txResult.nomorUrut,
    estimasiMenit,
    slotId: txResult.slotId,
    wargaNomorPonsel: txResult.wargaNomorPonsel,
    namaPosyandu: txResult.jadwal.posyandu.namaPosyandu,
    tanggalPelaksanaan,
    labelSesi: txResult.labelSesi,
  }
}

/**
 * batalkanAntrian — Batalkan antrian dengan ownership check.
 *
 * T-02-10 Mitigation: findFirst({ where: { id, wargaId } }) — warga berbeda
 * mendapat 404 ANTRIAN_TIDAK_DITEMUKAN, bukan 403, mencegah ID enumeration.
 *
 * D-06: Hanya bisa batalkan saat statusAntrian === 'menunggu'.
 */
export async function batalkanAntrian(
  antrianId: string,
  wargaId: string
): Promise<{ antrianId: string; statusAntrian: string }> {
  // Fetch dengan ownership check sekaligus (findFirst + wargaId filter)
  const antrian = await prisma.antrian.findFirst({
    where: { id: antrianId, wargaId },
  })

  if (!antrian) {
    // 404 — bukan 403 — mencegah ID enumeration (T-02-10)
    throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
  }

  if (antrian.statusAntrian !== 'menunggu') {
    throw Object.assign(new Error('Antrian tidak bisa dibatalkan'), { code: 'TIDAK_BISA_BATALKAN' })
  }

  // Update status + decrement terisi secara atomic
  await prisma.$transaction([
    prisma.antrian.update({
      where: { id: antrianId },
      data: { statusAntrian: 'dibatalkan' },
    }),
    prisma.slotSesi.update({
      where: { id: antrian.slotId },
      data: { terisi: { decrement: 1 } },
    }),
  ])

  // Broadcast di luar transaksi (T-02-14)
  void broadcastQueueUpdate(antrian.slotId)

  logger.info({ antrianId, wargaId }, 'Antrian dibatalkan')

  return { antrianId, statusAntrian: 'dibatalkan' }
}

/**
 * getAntrianSaya — Ambil antrian aktif citizen hari ini.
 *
 * Mengembalikan antrian dengan status menunggu/dipanggil yang dibuat hari ini.
 * Untuk citizen dashboard card dan tiket screen.
 */
export async function getAntrianSaya(wargaId: string) {
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)

  const antrian = await prisma.antrian.findFirst({
    where: {
      wargaId,
      statusAntrian: { in: ['menunggu', 'dipanggil'] },
      createdAt: { gte: startOfToday },
    },
    include: {
      slotSesi: {
        include: {
          jadwal: {
            include: { posyandu: true },
          },
        },
      },
      balita: {
        select: { namaBalita: true },
      },
    },
  })

  if (!antrian) return null

  const [dipanggilRow, sisaAntrian] = await Promise.all([
    prisma.antrian.findFirst({
      where: { slotId: antrian.slotId, statusAntrian: 'dipanggil' },
      orderBy: { nomorUrut: 'asc' },
      select: { nomorUrut: true },
    }),
    prisma.antrian.count({
      where: {
        slotId: antrian.slotId,
        statusAntrian: 'menunggu',
        nomorUrut: { lt: antrian.nomorUrut },
      },
    }),
  ])

  return {
    ...antrian,
    nomorAktif: dipanggilRow?.nomorUrut ?? 0,
    sisaAntrian,
  }
}

/**
 * getAntrianById — Ambil detail antrian berdasarkan ID dengan ownership check.
 *
 * T-02-11 Mitigation: findFirst({ where: { id, wargaId } }) — citizen lain
 * mendapat 404, bukan 403, mencegah ID enumeration (informasi keberadaan record
 * tidak bocor ke pihak tidak berwenang).
 */
export async function getAntrianById(antrianId: string, wargaId: string) {
  const antrian = await prisma.antrian.findFirst({
    where: { id: antrianId, wargaId },
    include: {
      slotSesi: {
        include: {
          jadwal: {
            include: { posyandu: true },
          },
        },
      },
      balita: true,
    },
  })

  if (!antrian) {
    throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
  }

  // Formula D-03
  const estimasiMenit = antrian.nomorUrut * antrian.slotSesi.jadwal.estimasiDurasiMenit

  return { ...antrian, estimasiMenit }
}

/**
 * broadcastQueueUpdate — Kirim queue:update ke room sesi:{slotId}.
 *
 * Pitfall 3 prevention: guard `if (!io) return` — io adalah undefined sampai
 * initSocket() dipanggil. Broadcast bisa dipanggil dari seed/health check
 * sebelum Socket.IO terinisialisasi.
 *
 * T-02-14 Mitigation: fungsi ini SELALU dipanggil di luar prisma.$transaction —
 * broadcast tidak boleh terjadi sebelum transaksi commit.
 */
export async function broadcastQueueUpdate(slotId: string): Promise<void> {
  if (!io) {
    logger.warn('Socket.IO belum siap — skip broadcast')
    return
  }

  // Ambil antrian aktif untuk slot ini
  const [antrianList, dipanggilRow, slot] = await Promise.all([
    prisma.antrian.findMany({
      where: {
        slotId,
        statusAntrian: { in: ['menunggu', 'dipanggil'] },
      },
      orderBy: { nomorUrut: 'asc' },
      select: { id: true, nomorUrut: true, statusAntrian: true },
    }),
    // nomorAktif = nomorUrut antrian yang sedang dilayani (status dipanggil)
    prisma.antrian.findFirst({
      where: { slotId, statusAntrian: 'dipanggil' },
      orderBy: { nomorUrut: 'asc' },
      select: { nomorUrut: true },
    }),
    prisma.slotSesi.findUnique({
      where: { id: slotId },
      select: { durasiRataAktual: true },
    }),
  ])

  // Payload sesuai CLAUDE.md §Socket.IO Events
  io.to('sesi:' + slotId).emit('queue:update', {
    nomorAktif: dipanggilRow?.nomorUrut ?? 0,
    durasiRataAktual: slot?.durasiRataAktual ?? null,
    antrianList,
  })

  logger.debug({ slotId, antrianCount: antrianList.length }, 'queue:update broadcast dikirim')
}
