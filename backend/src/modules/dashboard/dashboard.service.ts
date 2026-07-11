import { prisma } from '../../config/db'
import { classifyBbTb, classifyTbU } from '../../shared/utils/zscore'

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
  trenGiziBulanan: Array<{
    bulan: string
    sangatPendek: number
    pendek: number
    normalTbU: number
    tinggi: number
    obesitas: number
    giziLebih: number
    berisikoGiziLebih: number
    normalBbTb: number
    kurangBbTb: number
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBulan(bulan: string): { startOfMonth: Date; startOfNextMonth: Date } {
  const [year, month] = bulan.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const startOfNextMonth = new Date(year, month, 1)
  return { startOfMonth, startOfNextMonth }
}

// ── getStuntingMapData ────────────────────────────────────────────────────────
// T-04-01-01: puskesmasId SELALU dari JWT (parameter), tidak pernah dari client

export async function getStuntingMapData(
  puskesmasId: string,
  bulan: string
): Promise<StuntingMapPoint[]> {
  const { startOfMonth, startOfNextMonth } = parseBulan(bulan)

  // Query pemeriksaan directly (same pattern as getDashboardStats).
  // Seed massal creates pemeriksaan with antrianId: null, so traversing antrian chain returns 0.
  const posyanduRows = await prisma.posyandu.findMany({
    where: { puskesmasId },
    select: { id: true, namaPosyandu: true, kelurahan: true, latitude: true, longitude: true },
  })
  const posyanduIds = posyanduRows.map((p) => p.id)

  if (posyanduIds.length === 0) return []

  const allPemeriksaan = await prisma.pemeriksaan.findMany({
    where: {
      tanggalPemeriksaan: { gte: startOfMonth, lt: startOfNextMonth },
      balita: { warga: { posyanduUtamaId: { in: posyanduIds } } },
      statusGizi: { not: null },
    },
    select: {
      balitaId: true,
      tanggalPemeriksaan: true,
      statusGizi: true,
      statusGiziOverride: true,
      balita: { select: { warga: { select: { posyanduUtamaId: true } } } },
    },
  })

  // Dedup: per balitaId gunakan pemeriksaan terbaru — 1 anak dihitung 1 kali
  const latestByBalita = new Map<string, typeof allPemeriksaan[0]>()
  for (const pm of allPemeriksaan) {
    const ex = latestByBalita.get(pm.balitaId)
    if (!ex || pm.tanggalPemeriksaan > ex.tanggalPemeriksaan) {
      latestByBalita.set(pm.balitaId, pm)
    }
  }

  // Group unique balita by posyanduId
  const groupedMap = new Map<string, Record<string, number>>()
  for (const pm of latestByBalita.values()) {
    const pid = pm.balita.warga.posyanduUtamaId
    if (!pid) continue
    const status = pm.statusGiziOverride ?? pm.statusGizi
    if (!status) continue
    const acc = groupedMap.get(pid) ?? {}
    acc[status] = (acc[status] ?? 0) + 1
    groupedMap.set(pid, acc)
  }

  return posyanduRows
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => {
      const breakdown = groupedMap.get(p.id) ?? {}
      const total = Object.values(breakdown).reduce((s, n) => s + n, 0)
      return {
        posyanduId: p.id,
        namaPosyandu: p.namaPosyandu,
        kelurahan: p.kelurahan,
        lat: p.latitude!,
        lng: p.longitude!,
        total,
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
  const { startOfMonth, startOfNextMonth } = parseBulan(bulan)

  // Query pemeriksaan directly via balita → warga (posyanduUtamaId) under this puskesmas.
  // Seed massal creates pemeriksaan without antrian (antrianId: null), so traversing
  // through antrian chain would always return 0. Instead, query by tanggalPemeriksaan
  // and posyandu membership.
  const posyanduIds = await prisma.posyandu
    .findMany({ where: { puskesmasId }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id))

  if (posyanduIds.length === 0) {
    return { totalPemeriksaan: 0, totalBalita: 0, breakdown: {}, trenGiziBulanan: [] }
  }

  const allPemeriksaan = await prisma.pemeriksaan.findMany({
    where: {
      tanggalPemeriksaan: { gte: startOfMonth, lt: startOfNextMonth },
      balita: {
        warga: { posyanduUtamaId: { in: posyanduIds } },
      },
      statusGizi: { not: null },
    },
    select: {
      balitaId: true,
      statusGizi: true,
      statusGiziOverride: true,
    },
  })
  const trendStart = new Date(startOfMonth)
  trendStart.setMonth(trendStart.getMonth() - 11)
  const trendPemeriksaan = await prisma.pemeriksaan.findMany({
    where: {
      tanggalPemeriksaan: { gte: trendStart, lt: startOfNextMonth },
      balita: {
        warga: { posyanduUtamaId: { in: posyanduIds } },
      },
      OR: [{ zScoreTbU: { not: null } }, { zScoreBbTb: { not: null } }],
    },
    select: {
      tanggalPemeriksaan: true,
      zScoreTbU: true,
      zScoreBbTb: true,
    },
  })

  const breakdown = allPemeriksaan.reduce(
    (acc, pm) => {
      const status = pm.statusGiziOverride ?? pm.statusGizi
      if (status) acc[status] = (acc[status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const trenMap = new Map<string, {
    bulan: string
    sangatPendek: number
    pendek: number
    normalTbU: number
    tinggi: number
    obesitas: number
    giziLebih: number
    berisikoGiziLebih: number
    normalBbTb: number
    kurangBbTb: number
  }>()

  for (const pm of trendPemeriksaan) {
    const bulanKey = pm.tanggalPemeriksaan.toISOString().slice(0, 7)
    if (!trenMap.has(bulanKey)) {
      trenMap.set(bulanKey, {
        bulan: bulanKey,
        sangatPendek: 0,
        pendek: 0,
        normalTbU: 0,
        tinggi: 0,
        obesitas: 0,
        giziLebih: 0,
        berisikoGiziLebih: 0,
        normalBbTb: 0,
        kurangBbTb: 0,
      })
    }
    const entry = trenMap.get(bulanKey)!
    const tbU = classifyTbU(pm.zScoreTbU === null ? null : Number(pm.zScoreTbU))
    if (tbU?.kode === 'sangat_pendek') entry.sangatPendek += 1
    else if (tbU?.kode === 'pendek') entry.pendek += 1
    else if (tbU?.kode === 'normal') entry.normalTbU += 1
    else if (tbU?.kode === 'tinggi') entry.tinggi += 1

    const bbTb = classifyBbTb(pm.zScoreBbTb === null ? null : Number(pm.zScoreBbTb))
    if (bbTb?.kode === 'obesitas') entry.obesitas += 1
    else if (bbTb?.kode === 'gizi_lebih') entry.giziLebih += 1
    else if (bbTb?.kode === 'berisiko_gizi_lebih') entry.berisikoGiziLebih += 1
    else if (bbTb?.kode === 'normal') entry.normalBbTb += 1
    else if (bbTb?.kode === 'kurang') entry.kurangBbTb += 1
  }
  const trenGiziBulanan = Array.from(trenMap.values()).sort((a, b) => a.bulan.localeCompare(b.bulan))

  const uniqueBalitaIds = new Set(allPemeriksaan.map((pm) => pm.balitaId))
  return {
    totalPemeriksaan: allPemeriksaan.length,
    totalBalita: uniqueBalitaIds.size,
    breakdown,
    trenGiziBulanan,
  }
}
