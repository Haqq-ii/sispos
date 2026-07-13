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
  totalBalitaSasaran: number
  breakdown: Record<string, number>
  partisipasiDS: {
    ditimbang: number
    sasaran: number
    persen: number
    status: 'baik' | 'cukup' | 'rendah'
  }
  redFlagsPosyandu: Array<{
    posyanduId: string
    namaPosyandu: string
    wilayah?: string
    kasusKritisBulanIni: number
    kasusKritisBulanLalu: number
    lonjakan: number
  }>
  distribusiRingkasanGiziBulanIni: {
    normal: number
    kurangPendek: number
    burukSangatPendek: number
    lebihObesitas: number
  }
  trenRingkasanGizi: Array<{
    bulan: string
    normal: number
    kurangPendek: number
    burukSangatPendek: number
    lebihObesitas: number
  }>
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

function createRingkasanGiziBucket() {
  return {
    normal: 0,
    kurangPendek: 0,
    burukSangatPendek: 0,
    lebihObesitas: 0,
  }
}

function classifyRingkasanGizi(zScoreTbU: number | null, zScoreBbTb: number | null) {
  if ((zScoreTbU !== null && zScoreTbU < -3) || (zScoreBbTb !== null && zScoreBbTb < -3)) {
    return 'burukSangatPendek' as const
  }
  if (zScoreBbTb !== null && zScoreBbTb > 1) {
    return 'lebihObesitas' as const
  }
  if (
    (zScoreTbU !== null && zScoreTbU >= -3 && zScoreTbU < -2) ||
    (zScoreBbTb !== null && zScoreBbTb >= -3 && zScoreBbTb < -2)
  ) {
    return 'kurangPendek' as const
  }
  return 'normal' as const
}

function getPartisipasiStatus(persen: number): 'baik' | 'cukup' | 'rendah' {
  if (persen >= 80) return 'baik'
  if (persen >= 60) return 'cukup'
  return 'rendah'
}

function isKasusKritis(zScoreTbU: number | null, zScoreBbTb: number | null): boolean {
  return (zScoreTbU !== null && zScoreTbU < -3) || (zScoreBbTb !== null && zScoreBbTb < -3)
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
      zScoreTbU: { not: null },
    },
    select: {
      balitaId: true,
      tanggalPemeriksaan: true,
      zScoreTbU: true,
      balita: { select: { warga: { select: { posyanduUtamaId: true } } } },
    },
  })

  // Dedup: per balitaId gunakan pemeriksaan terbaru - 1 anak dihitung 1 kali.
  const latestByBalita = new Map<string, typeof allPemeriksaan[0]>()
  for (const pm of allPemeriksaan) {
    const ex = latestByBalita.get(pm.balitaId)
    if (!ex || pm.tanggalPemeriksaan > ex.tanggalPemeriksaan) {
      latestByBalita.set(pm.balitaId, pm)
    }
  }

  const groupedMap = new Map<string, Record<string, number>>()
  for (const pm of latestByBalita.values()) {
    const pid = pm.balita.warga.posyanduUtamaId
    if (!pid || pm.zScoreTbU === null) continue
    const zTbU = Number(pm.zScoreTbU)
    const kategori = zTbU < -3 ? 'sangat_pendek' : zTbU < -2 ? 'pendek' : 'normal'
    const acc = groupedMap.get(pid) ?? {}
    acc[kategori] = (acc[kategori] ?? 0) + 1
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
  const startOfPreviousMonth = new Date(startOfMonth)
  startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1)

  // Query pemeriksaan directly via balita → warga (posyanduUtamaId) under this puskesmas.
  // Seed massal creates pemeriksaan without antrian (antrianId: null), so traversing
  // through antrian chain would always return 0. Instead, query by tanggalPemeriksaan
  // and posyandu membership.
  const posyanduRows = await prisma.posyandu.findMany({
    where: { puskesmasId },
    select: { id: true, namaPosyandu: true, kelurahan: true },
  })
  const posyanduIds = posyanduRows.map((r) => r.id)

  if (posyanduIds.length === 0) {
    return {
      totalPemeriksaan: 0,
      totalBalita: 0,
      totalBalitaSasaran: 0,
      breakdown: {},
      partisipasiDS: { ditimbang: 0, sasaran: 0, persen: 0, status: 'rendah' },
      redFlagsPosyandu: [],
      distribusiRingkasanGiziBulanIni: createRingkasanGiziBucket(),
      trenRingkasanGizi: [],
      trenGiziBulanan: [],
    }
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
  const pemeriksaanPartisipasiBulanIni = await prisma.pemeriksaan.findMany({
    where: {
      tanggalPemeriksaan: { gte: startOfMonth, lt: startOfNextMonth },
      balita: {
        warga: { posyanduUtamaId: { in: posyanduIds } },
      },
    },
    select: { balitaId: true },
  })
  const totalBalitaSasaran = await prisma.balita.count({
    where: {
      warga: { posyanduUtamaId: { in: posyanduIds } },
    },
  })
  const pemeriksaanKritisDuaBulan = await prisma.pemeriksaan.findMany({
    where: {
      tanggalPemeriksaan: { gte: startOfPreviousMonth, lt: startOfNextMonth },
      balita: {
        warga: { posyanduUtamaId: { in: posyanduIds } },
      },
      OR: [{ zScoreTbU: { not: null } }, { zScoreBbTb: { not: null } }],
    },
    select: {
      tanggalPemeriksaan: true,
      zScoreTbU: true,
      zScoreBbTb: true,
      balita: { select: { warga: { select: { posyanduUtamaId: true } } } },
    },
  })
  const pemeriksaanRingkasanBulanIni = await prisma.pemeriksaan.findMany({
    where: {
      tanggalPemeriksaan: { gte: startOfMonth, lt: startOfNextMonth },
      balita: {
        warga: { posyanduUtamaId: { in: posyanduIds } },
      },
      OR: [{ zScoreTbU: { not: null } }, { zScoreBbTb: { not: null } }],
    },
    select: {
      zScoreTbU: true,
      zScoreBbTb: true,
    },
  })
  const trendStart = new Date(startOfMonth)
  trendStart.setMonth(trendStart.getMonth() - 5)
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

  const kasusKritisBulanIniMap = new Map<string, number>()
  const kasusKritisBulanLaluMap = new Map<string, number>()
  for (const pm of pemeriksaanKritisDuaBulan) {
    const posyanduId = pm.balita.warga.posyanduUtamaId
    if (!posyanduId) continue
    const tbU = pm.zScoreTbU === null ? null : Number(pm.zScoreTbU)
    const bbTb = pm.zScoreBbTb === null ? null : Number(pm.zScoreBbTb)
    if (!isKasusKritis(tbU, bbTb)) continue

    const targetMap = pm.tanggalPemeriksaan >= startOfMonth
      ? kasusKritisBulanIniMap
      : kasusKritisBulanLaluMap
    targetMap.set(posyanduId, (targetMap.get(posyanduId) ?? 0) + 1)
  }

  const redFlagCandidates = posyanduRows.map((p) => {
    const kasusKritisBulanIni = kasusKritisBulanIniMap.get(p.id) ?? 0
    const kasusKritisBulanLalu = kasusKritisBulanLaluMap.get(p.id) ?? 0
    return {
      posyanduId: p.id,
      namaPosyandu: p.namaPosyandu,
      wilayah: p.kelurahan,
      kasusKritisBulanIni,
      kasusKritisBulanLalu,
      lonjakan: kasusKritisBulanIni - kasusKritisBulanLalu,
    }
  })
  const hasPositiveLonjakan = redFlagCandidates.some((item) => item.lonjakan > 0)
  const redFlagsPosyandu = redFlagCandidates
    .filter((item) => hasPositiveLonjakan ? item.lonjakan > 0 : item.kasusKritisBulanIni > 0)
    .sort((a, b) => {
      if (hasPositiveLonjakan) {
        return b.lonjakan - a.lonjakan || b.kasusKritisBulanIni - a.kasusKritisBulanIni
      }
      return b.kasusKritisBulanIni - a.kasusKritisBulanIni || b.lonjakan - a.lonjakan
    })
    .slice(0, 5)
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
  const trenRingkasanMap = new Map<string, {
    bulan: string
    normal: number
    kurangPendek: number
    burukSangatPendek: number
    lebihObesitas: number
  }>()

  const distribusiRingkasanGiziBulanIni = createRingkasanGiziBucket()
  for (const pm of pemeriksaanRingkasanBulanIni) {
    const tbU = pm.zScoreTbU === null ? null : Number(pm.zScoreTbU)
    const bbTb = pm.zScoreBbTb === null ? null : Number(pm.zScoreBbTb)
    const kategori = classifyRingkasanGizi(tbU, bbTb)
    distribusiRingkasanGiziBulanIni[kategori] += 1
  }

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
    if (!trenRingkasanMap.has(bulanKey)) {
      trenRingkasanMap.set(bulanKey, {
        bulan: bulanKey,
        ...createRingkasanGiziBucket(),
      })
    }
    const ringkasanEntry = trenRingkasanMap.get(bulanKey)!
    const ringkasanKategori = classifyRingkasanGizi(
      pm.zScoreTbU === null ? null : Number(pm.zScoreTbU),
      pm.zScoreBbTb === null ? null : Number(pm.zScoreBbTb)
    )
    ringkasanEntry[ringkasanKategori] += 1

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
  const trenRingkasanGizi = Array.from(trenRingkasanMap.values()).sort((a, b) =>
    a.bulan.localeCompare(b.bulan)
  )

  const uniqueBalitaIds = new Set(pemeriksaanPartisipasiBulanIni.map((pm) => pm.balitaId))
  const partisipasiPersen = totalBalitaSasaran === 0
    ? 0
    : Math.round((uniqueBalitaIds.size / totalBalitaSasaran) * 1000) / 10
  return {
    totalPemeriksaan: allPemeriksaan.length,
    totalBalita: uniqueBalitaIds.size,
    totalBalitaSasaran,
    breakdown,
    partisipasiDS: {
      ditimbang: uniqueBalitaIds.size,
      sasaran: totalBalitaSasaran,
      persen: partisipasiPersen,
      status: getPartisipasiStatus(partisipasiPersen),
    },
    redFlagsPosyandu,
    distribusiRingkasanGiziBulanIni,
    trenRingkasanGizi,
    trenGiziBulanan,
  }
}



