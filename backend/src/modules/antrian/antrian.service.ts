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

    // 3. Cegah antrian aktif ganda pada jadwal yang sama.
    const activeExisting = await tx.antrian.findFirst({
      where: {
        balitaId,
        statusAntrian: { in: ['menunggu', 'dipanggil', 'sedang_dilayani'] },
        slotSesi: { jadwalId: slot.jadwalId },
      },
      select: { id: true },
    })
    if (activeExisting) {
      throw Object.assign(new Error('Balita sudah memiliki antrian aktif'), {
        code: 'ANTRIAN_AKTIF',
        antrianId: activeExisting.id,
      })
    }

    // 4. Cek duplikasi: balita yang sama di sesi yang sama.
    // Record dibatalkan boleh dipakai ulang karena unique(slotId, balitaId).
    const existing = await tx.antrian.findUnique({
      where: { slotId_balitaId: { slotId, balitaId } },
    })
    if (existing && existing.statusAntrian !== 'dibatalkan') {
      throw Object.assign(new Error('Balita sudah terdaftar di sesi ini'), { code: 'SUDAH_DAFTAR' })
    }

    // 5. Increment terisi (di dalam lock - aman dari race condition)
    await tx.slotSesi.update({
      where: { id: slotId },
      data: { terisi: { increment: 1 } },
    })

    // nomorUrut = nilai terisi LAMA + 1 (sebelum increment, sesuai urutan pendaftaran)
    const nomorUrut = slot.terisi + 1

    // 6. Buat record baru, atau aktifkan ulang record yang sebelumnya dibatalkan.
    const antrian = existing
      ? await tx.antrian.update({
          where: { id: existing.id },
          data: {
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
      : await tx.antrian.create({
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
): Promise<{ antrianId: string; statusAntrian: 'dibatalkan' }> {
  const antrian = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: string
      slotId: string
      statusAntrian: string
    }>>`
      SELECT id, "slotId", "statusAntrian"
      FROM antrian
      WHERE id = ${antrianId} AND "wargaId" = ${wargaId}
      FOR UPDATE
    `
    const locked = rows[0]
    if (!locked) {
      // 404 - bukan 403 - mencegah ID enumeration (T-02-10)
      throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
    }

    if (locked.statusAntrian !== 'menunggu') {
      throw Object.assign(new Error('Antrian tidak bisa dibatalkan'), { code: 'TIDAK_BISA_BATALKAN' })
    }

    await tx.antrian.update({
      where: { id: antrianId },
      data: { statusAntrian: 'dibatalkan' },
    })
    await tx.slotSesi.update({
      where: { id: locked.slotId },
      data: { terisi: { decrement: 1 } },
    })

    return locked
  })

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
export interface RescheduleAntrianResult {
  antrianId: string
  oldSlotId: string
  newSlotId: string
  nomorUrut: number
  estimasiMenit: number
  namaPosyandu: string
  tanggalPelaksanaan: string
  labelSesi: string
  noChange: boolean
}

export async function rescheduleAntrian(
  antrianId: string,
  newSlotId: string,
  wargaId: string
): Promise<RescheduleAntrianResult> {
  const txResult = await prisma.$transaction(async (tx) => {
    const antrianRows = await tx.$queryRaw<Array<{
      id: string
      slotId: string
      balitaId: string
      statusAntrian: string
    }>>`
      SELECT id, "slotId", "balitaId", "statusAntrian"
      FROM antrian
      WHERE id = ${antrianId} AND "wargaId" = ${wargaId}
      FOR UPDATE
    `

    const lockedAntrian = antrianRows[0]
    if (!lockedAntrian) {
      throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
    }

    if (lockedAntrian.statusAntrian !== 'menunggu') {
      const messageByStatus: Record<string, string> = {
        dipanggil: 'Antrian sudah dipanggil sehingga tidak bisa diubah melalui chat.',
        sedang_dilayani: 'Antrian sedang dilayani sehingga tidak bisa diubah melalui chat.',
        selesai: 'Antrian sudah selesai sehingga tidak bisa diubah.',
        dibatalkan: 'Antrian sudah dibatalkan sehingga tidak bisa diubah.',
      }
      throw Object.assign(
        new Error(messageByStatus[lockedAntrian.statusAntrian] ?? 'Antrian tidak bisa diubah.'),
        { code: 'TIDAK_BISA_RESCHEDULE', statusAntrian: lockedAntrian.statusAntrian }
      )
    }

    const oldSlotId = lockedAntrian.slotId
    if (oldSlotId === newSlotId) {
      const detail = await tx.antrian.findUnique({
        where: { id: lockedAntrian.id },
        include: {
          slotSesi: { include: { jadwal: { include: { posyandu: true } } } },
        },
      })
      if (!detail) {
        throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
      }
      return {
        antrianId: detail.id,
        oldSlotId,
        newSlotId,
        nomorUrut: detail.nomorUrut,
        estimasiDurasiMenit: detail.slotSesi.jadwal.estimasiDurasiMenit,
        tanggalPelaksanaan: detail.slotSesi.jadwal.tanggalPelaksanaan,
        namaPosyandu: detail.slotSesi.jadwal.posyandu.namaPosyandu,
        labelSesi: detail.slotSesi.labelSesi,
        noChange: true,
      }
    }

    const slotRows = await tx.$queryRaw<Array<{
      id: string
      kuota: number
      terisi: number
    }>>`
      SELECT id, kuota, terisi
      FROM slot_sesi
      WHERE id IN (${oldSlotId}, ${newSlotId})
      ORDER BY id
      FOR UPDATE
    `

    const oldSlot = slotRows.find((slot) => slot.id === oldSlotId)
    const newSlot = slotRows.find((slot) => slot.id === newSlotId)

    if (!oldSlot) {
      throw Object.assign(new Error('Slot lama tidak ditemukan'), { code: 'SLOT_LAMA_TIDAK_DITEMUKAN' })
    }
    if (!newSlot) {
      throw Object.assign(new Error('Slot baru tidak ditemukan'), { code: 'SLOT_TIDAK_DITEMUKAN' })
    }
    if (oldSlot.terisi <= 0) {
      throw Object.assign(new Error('Data slot lama tidak valid'), { code: 'SLOT_LAMA_INVALID' })
    }
    if (newSlot.terisi >= newSlot.kuota) {
      throw Object.assign(new Error('Slot baru sudah penuh'), { code: 'SLOT_PENUH' })
    }

    const duplicate = await tx.antrian.findUnique({
      where: { slotId_balitaId: { slotId: newSlotId, balitaId: lockedAntrian.balitaId } },
      select: { id: true, statusAntrian: true },
    })
    if (duplicate && duplicate.id !== lockedAntrian.id) {
      throw Object.assign(new Error('Balita sudah memiliki riwayat/antrian pada sesi tujuan'), { code: 'SUDAH_DAFTAR' })
    }

    const nomorUrut = newSlot.terisi + 1

    await tx.slotSesi.update({
      where: { id: oldSlotId },
      data: { terisi: { decrement: 1 } },
    })
    await tx.slotSesi.update({
      where: { id: newSlotId },
      data: { terisi: { increment: 1 } },
    })

    const updated = await tx.antrian.update({
      where: { id: lockedAntrian.id },
      data: { slotId: newSlotId, nomorUrut },
      include: {
        slotSesi: { include: { jadwal: { include: { posyandu: true } } } },
      },
    })

    return {
      antrianId: updated.id,
      oldSlotId,
      newSlotId,
      nomorUrut,
      estimasiDurasiMenit: updated.slotSesi.jadwal.estimasiDurasiMenit,
      tanggalPelaksanaan: updated.slotSesi.jadwal.tanggalPelaksanaan,
      namaPosyandu: updated.slotSesi.jadwal.posyandu.namaPosyandu,
      labelSesi: updated.slotSesi.labelSesi,
      noChange: false,
    }
  })

  void broadcastQueueUpdate(txResult.oldSlotId)
  if (txResult.newSlotId !== txResult.oldSlotId) {
    void broadcastQueueUpdate(txResult.newSlotId)
  }

  const tanggalPelaksanaan = txResult.tanggalPelaksanaan.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })

  logger.info(
    { antrianId, oldSlotId: txResult.oldSlotId, newSlotId: txResult.newSlotId },
    txResult.noChange ? 'Reschedule antrian tanpa perubahan slot' : 'Antrian berhasil di-reschedule'
  )

  return {
    antrianId: txResult.antrianId,
    oldSlotId: txResult.oldSlotId,
    newSlotId: txResult.newSlotId,
    nomorUrut: txResult.nomorUrut,
    estimasiMenit: txResult.nomorUrut * txResult.estimasiDurasiMenit,
    namaPosyandu: txResult.namaPosyandu,
    tanggalPelaksanaan,
    labelSesi: txResult.labelSesi,
    noChange: txResult.noChange,
  }
}

export async function getAntrianSaya(wargaId: string, balitaId?: string) {
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)

  const antrian = await prisma.antrian.findFirst({
    where: {
      wargaId,
      ...(balitaId ? { balitaId } : {}),
      statusAntrian: { in: ['menunggu', 'dipanggil', 'sedang_dilayani'] },
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
      where: { slotId: antrian.slotId, statusAntrian: { in: ['dipanggil', 'sedang_dilayani'] } },
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
        statusAntrian: { in: ['menunggu', 'dipanggil', 'sedang_dilayani'] },
      },
      orderBy: { nomorUrut: 'asc' },
      select: { id: true, nomorUrut: true, statusAntrian: true },
    }),
    // nomorAktif = nomorUrut terendah yang sedang aktif (dipanggil atau sedang_dilayani)
    prisma.antrian.findFirst({
      where: { slotId, statusAntrian: { in: ['dipanggil', 'sedang_dilayani'] } },
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
