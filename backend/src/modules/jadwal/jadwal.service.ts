import { Prisma } from '@prisma/client'
import { prisma } from '../../config/db'
import type { CreateJadwalInput } from '../../shared/schemas/jadwal.schema'

// ── Konfigurasi 3 sesi per hari (08:00 - 11:00) ──────────────────
const SESI_CONFIG = [
  { nomorSesi: 1, labelSesi: 'Sesi 1 (08:00 - 09:00)', jamMulaiHour: 8, jamSelesaiHour: 9 },
  { nomorSesi: 2, labelSesi: 'Sesi 2 (09:00 - 10:00)', jamMulaiHour: 9, jamSelesaiHour: 10 },
  { nomorSesi: 3, labelSesi: 'Sesi 3 (10:00 - 11:00)', jamMulaiHour: 10, jamSelesaiHour: 11 },
]

// ── Buat jadwal + 3 SlotSesi secara atomik ────────────────────────
export async function createJadwal(data: CreateJadwalInput, puskesmasId: string) {
  // T-02-04 Mitigation: Verifikasi posyandu milik puskesmas yang login
  const posyandu = await prisma.posyandu.findFirst({
    where: { id: data.posyanduId, puskesmasId },
  })
  if (!posyandu) {
    const err = new Error('Posyandu tidak ditemukan atau bukan milik akun ini.') as NodeJS.ErrnoException
    err.code = 'POSYANDU_TIDAK_DITEMUKAN'
    throw err
  }

  // kuota per sesi = floor(60 / estimasiDurasiMenit) — CLAUDE.md §Antrian
  const kuota = Math.floor(60 / data.estimasiDurasiMenit)

  try {
    const result = await prisma.$transaction(async (tx) => {
      // a. Buat Jadwal
      const newJadwal = await tx.jadwal.create({
        data: {
          posyanduId: data.posyanduId,
          puskesmasId,
          tanggalPelaksanaan: new Date(data.tanggalPelaksanaan),
          estimasiDurasiMenit: data.estimasiDurasiMenit,
          statusJadwal: 'aktif',
        },
      })

      // b. Build SlotSesi — gunakan UTC hours untuk menghindari timezone pitfall (@db.Time)
      const slots = SESI_CONFIG.map((sesi) => {
        const jamMulai = new Date(0)
        jamMulai.setUTCHours(sesi.jamMulaiHour, 0, 0, 0)

        const jamSelesai = new Date(0)
        jamSelesai.setUTCHours(sesi.jamSelesaiHour, 0, 0, 0)

        return {
          jadwalId: newJadwal.id,
          nomorSesi: sesi.nomorSesi,
          labelSesi: sesi.labelSesi,
          jamMulai,
          jamSelesai,
          kuota,
          terisi: 0,
        }
      })

      // c. Buat 3 SlotSesi sekaligus
      await tx.slotSesi.createMany({ data: slots })

      // Kembalikan jadwal lengkap dengan slot
      return tx.jadwal.findUnique({
        where: { id: newJadwal.id },
        include: { slotSesi: { orderBy: { nomorSesi: 'asc' } } },
      })
    })

    return result
  } catch (err) {
    // P2002 = unique constraint violation: [posyanduId, tanggalPelaksanaan]
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const e = new Error('Jadwal untuk posyandu dan tanggal ini sudah ada.') as NodeJS.ErrnoException
      e.code = 'JADWAL_SUDAH_ADA'
      throw e
    }
    throw err
  }
}

// ── Daftar jadwal milik puskesmas (paginasi) ──────────────────────
export async function getJadwalList(puskesmasId: string, page: number, limit: number) {
  const skip = (page - 1) * limit

  const [total, data] = await Promise.all([
    prisma.jadwal.count({ where: { puskesmasId } }),
    prisma.jadwal.findMany({
      where: { puskesmasId },
      include: {
        posyandu: { select: { namaPosyandu: true } },
        slotSesi: {
          select: { id: true, nomorSesi: true, labelSesi: true, kuota: true, terisi: true },
          orderBy: { nomorSesi: 'asc' },
        },
      },
      orderBy: { tanggalPelaksanaan: 'desc' },
      skip,
      take: limit,
    }),
  ])

  return { data, total }
}

// ── Jadwal tersedia untuk citizen (berdasarkan posyanduId) ────────
export async function getJadwalTersedia(posyanduId: string, bulan: string) {
  // bulan format: 'YYYY-MM'
  const startDate = new Date(bulan + '-01')
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)

  const jadwalList = await prisma.jadwal.findMany({
    where: {
      posyanduId,
      tanggalPelaksanaan: { gte: startDate, lte: endDate },
      statusJadwal: 'aktif',
    },
    select: {
      id: true,
      tanggalPelaksanaan: true,
      estimasiDurasiMenit: true,
      slotSesi: {
        select: {
          id: true,
          nomorSesi: true,
          labelSesi: true,
          kuota: true,
          terisi: true,
        },
      },
    },
    orderBy: { tanggalPelaksanaan: 'asc' },
  })

  // Sertakan flag hasAvailableSlot agar client bisa tampilkan/sembunyikan tanggal
  return jadwalList.map((j) => ({
    ...j,
    hasAvailableSlot: j.slotSesi.some((s) => s.terisi < s.kuota),
  }))
}

// ── Dapatkan posyanduUtamaId citizen dari DB ──────────────────────
export async function getCitizenPosyanduId(wargaId: string): Promise<string | null> {
  const warga = await prisma.warga.findUnique({
    where: { id: wargaId },
    select: { posyanduUtamaId: true },
  })
  return warga?.posyanduUtamaId ?? null
}

// ── Detail SlotSesi untuk satu Jadwal ────────────────────────────
export async function getSesiList(jadwalId: string) {
  return prisma.slotSesi.findMany({
    where: { jadwalId },
    include: {
      jadwal: {
        select: {
          estimasiDurasiMenit: true,
          tanggalPelaksanaan: true,
          posyandu: { select: { namaPosyandu: true } },
        },
      },
    },
    orderBy: { nomorSesi: 'asc' },
  })
}
