import { prisma } from '../../config/db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StuntingMapPoint {
  posyanduId: string
  namaPosyandu: string
  kelurahan: string
  lat: number
  lng: number
  total: number
  breakdown: Record<string, number>
}

export interface DashboardStats {
  totalPemeriksaan: number
  totalBalita: number
  breakdown: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBulan(bulan: string): { startOfMonth: Date; endOfMonth: Date } {
  const [year, month] = bulan.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)
  return { startOfMonth, endOfMonth }
}

// ── getStuntingMapData ────────────────────────────────────────────────────────
// T-04-01-01: puskesmasId SELALU dari JWT (parameter), tidak pernah dari client

export async function getStuntingMapData(
  puskesmasId: string,
  bulan: string
): Promise<StuntingMapPoint[]> {
  const { startOfMonth, endOfMonth } = parseBulan(bulan)

  const posyanduList = await prisma.posyandu.findMany({
    where: { puskesmasId },
    select: {
      id: true,
      namaPosyandu: true,
      kelurahan: true,
      latitude: true,
      longitude: true,
      jadwal: {
        where: {
          tanggalPelaksanaan: { gte: startOfMonth, lte: endOfMonth },
        },
        select: {
          slotSesi: {
            select: {
              antrian: {
                where: { statusAntrian: 'selesai' },
                select: {
                  pemeriksaan: {
                    select: { statusGizi: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  return posyanduList
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => {
      const allPemeriksaan = p.jadwal
        .flatMap((j) => j.slotSesi)
        .flatMap((s) => s.antrian)
        .flatMap((a) => a.pemeriksaan)
        .filter((pm) => pm.statusGizi !== null)

      const breakdown = allPemeriksaan.reduce(
        (acc, pm) => {
          if (pm.statusGizi) acc[pm.statusGizi] = (acc[pm.statusGizi] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      return {
        posyanduId: p.id,
        namaPosyandu: p.namaPosyandu,
        kelurahan: p.kelurahan,
        lat: p.latitude!,
        lng: p.longitude!,
        total: allPemeriksaan.length,
        breakdown,
      }
    })
}

// ── getDashboardStats ─────────────────────────────────────────────────────────
// T-04-01-03: puskesmasId SELALU dari JWT (parameter)

export async function getDashboardStats(
  puskesmasId: string,
  bulan: string
): Promise<DashboardStats> {
  const { startOfMonth, endOfMonth } = parseBulan(bulan)

  const posyanduList = await prisma.posyandu.findMany({
    where: { puskesmasId },
    select: {
      jadwal: {
        where: {
          tanggalPelaksanaan: { gte: startOfMonth, lte: endOfMonth },
        },
        select: {
          slotSesi: {
            select: {
              antrian: {
                where: { statusAntrian: 'selesai' },
                select: {
                  wargaId: true,
                  pemeriksaan: {
                    select: { statusGizi: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const allAntrian = posyanduList
    .flatMap((p) => p.jadwal)
    .flatMap((j) => j.slotSesi)
    .flatMap((s) => s.antrian)

  const allPemeriksaan = allAntrian
    .flatMap((a) => a.pemeriksaan)
    .filter((pm) => pm.statusGizi !== null)

  const breakdown = allPemeriksaan.reduce(
    (acc, pm) => {
      if (pm.statusGizi) acc[pm.statusGizi] = (acc[pm.statusGizi] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Count distinct wargaId from antrian in the period
  const uniqueWargaIds = new Set(allAntrian.map((a) => a.wargaId))

  return {
    totalPemeriksaan: allPemeriksaan.length,
    totalBalita: uniqueWargaIds.size,
    breakdown,
  }
}
