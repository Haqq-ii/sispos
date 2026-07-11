import whoTables from '../data/who-growth-tables.json'

type Indicator = 'wfa' | 'lhfa' | 'wfl'
type Sex = 'laki_laki' | 'perempuan'

interface LMSEntry { age: number; L: number; M: number; S: number }

export type StatusGizi =
  | 'normal'
  | 'kurang'
  | 'buruk'
  | 'lebih'
  | 'obesitas'
  | 'pendek'
  | 'sangat_pendek'

function getTable(indicator: Indicator, sex: Sex): LMSEntry[] {
  const key = `${indicator}_${sex === 'laki_laki' ? 'boys' : 'girls'}` as keyof typeof whoTables
  return (whoTables[key] as LMSEntry[]) ?? []
}

function findLMS(table: LMSEntry[], ageOrLength: number): LMSEntry | null {
  if (table.length === 0) return null
  // Find closest entry by the 'age' field (which also encodes length-cm for wfl)
  return table.reduce((prev, curr) =>
    Math.abs(curr.age - ageOrLength) < Math.abs(prev.age - ageOrLength) ? curr : prev,
    table[0]
  )
}

/**
 * computeZScore — Hitung Z-Score WHO 2006 dengan formula Box-Cox LMS.
 * Formula: Z = ((value/M)^L - 1) / (L * S)
 * Edge case L ≈ 0: Z = log(value/M) / S
 *
 * @param indicator  'wfa' | 'lhfa' | 'wfl'
 * @param sex        'laki_laki' | 'perempuan'
 * @param ageMonths  usia dalam bulan (untuk wfa/lhfa) atau panjang badan cm (untuk wfl)
 * @param value      nilai pengukuran (berat kg untuk wfa/wfl, tinggi cm untuk lhfa)
 * @returns          Z-Score atau null jika tabel tidak ditemukan
 */
export function computeZScore(
  indicator: Indicator,
  sex: Sex,
  ageMonths: number,
  value: number
): number | null {
  const table = getTable(indicator, sex)
  const lms = findLMS(table, ageMonths)
  if (!lms) return null

  const { L, M, S } = lms
  // Guard against division by zero and numerical instability when L ≈ 0
  if (Math.abs(L) < 0.001) {
    return Math.log(value / M) / S
  }
  return (Math.pow(value / M, L) - 1) / (L * S)
}

/**
 * ageInMonths — Hitung usia dalam bulan (floor) dari tanggal lahir ke tanggal pemeriksaan.
 * Menggunakan rata-rata 30.4375 hari per bulan (365.25 / 12).
 */
export function ageInMonths(tanggalLahir: Date, tanggalPemeriksaan: Date): number {
  const diffMs = tanggalPemeriksaan.getTime() - tanggalLahir.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375))
}

/**
 * determineStatusGizi — Tentukan status gizi berdasarkan Z-Score prioritas.
 * Prioritas: buruk > sangat_pendek > kurang > pendek > obesitas > lebih > normal
 * Cocok dengan enum StatusGizi di Prisma schema.
 *
 * @param zBbU   Z-Score BB/U (weight-for-age)
 * @param zTbU   Z-Score TB/U (height-for-age)
 * @param zBbTb  Z-Score BB/TB (weight-for-height)
 */
/**
 * getStatusTrigger — Kembalikan indikator Z-Score yang men-trigger statusGizi.
 * Dipakai UI agar badge status bisa menjelaskan MENGAPA status tersebut muncul.
 */
export function getStatusTrigger(
  zBbU: number | null,
  zTbU: number | null,
  zBbTb: number | null,
): { indicator: 'BB/U' | 'TB/U' | 'BB/TB'; zScore: number } | null {
  if (zBbU !== null && zBbU < -3) return { indicator: 'BB/U', zScore: zBbU }
  if (zBbTb !== null && zBbTb < -3) return { indicator: 'BB/TB', zScore: zBbTb }
  if (zTbU !== null && zTbU < -3) return { indicator: 'TB/U', zScore: zTbU }
  if (zBbU !== null && zBbU < -2) return { indicator: 'BB/U', zScore: zBbU }
  if (zBbTb !== null && zBbTb < -2) return { indicator: 'BB/TB', zScore: zBbTb }
  if (zTbU !== null && zTbU < -2) return { indicator: 'TB/U', zScore: zTbU }
  if (zBbU !== null && zBbU > 3) return { indicator: 'BB/U', zScore: zBbU }
  if (zBbU !== null && zBbU > 2) return { indicator: 'BB/U', zScore: zBbU }
  return null
}

export function determineStatusGizi(
  zBbU: number | null,
  zTbU: number | null,
  zBbTb: number | null
): StatusGizi {
  // Buruk: BB/U < -3 ATAU BB/TB < -3
  if ((zBbU !== null && zBbU < -3) || (zBbTb !== null && zBbTb < -3)) return 'buruk'
  // Sangat pendek: TB/U < -3
  if (zTbU !== null && zTbU < -3) return 'sangat_pendek'
  // Kurang: BB/U < -2 ATAU BB/TB < -2
  if ((zBbU !== null && zBbU < -2) || (zBbTb !== null && zBbTb < -2)) return 'kurang'
  // Pendek: TB/U < -2
  if (zTbU !== null && zTbU < -2) return 'pendek'
  // Obesitas: BB/U > 3
  if (zBbU !== null && zBbU > 3) return 'obesitas'
  // Lebih: BB/U > 2
  if (zBbU !== null && zBbU > 2) return 'lebih'
  return 'normal'
}

export type DerivedGrowthSeverity = 'severe' | 'warning' | 'normal' | 'high'

export interface DerivedGrowthCategory {
  kode: string
  label: string
  severity: DerivedGrowthSeverity
}

export function classifyTbU(zScoreTbU: number | null): DerivedGrowthCategory | null {
  if (zScoreTbU === null) return null
  if (zScoreTbU < -3) {
    return { kode: 'sangat_pendek', label: 'Stunting Berat / Sangat Pendek', severity: 'severe' }
  }
  if (zScoreTbU < -2) {
    return { kode: 'pendek', label: 'Stunting / Pendek', severity: 'warning' }
  }
  if (zScoreTbU <= 3) {
    return { kode: 'normal', label: 'Normal', severity: 'normal' }
  }
  return { kode: 'tinggi', label: 'Tinggi', severity: 'high' }
}

export function classifyBbTb(zScoreBbTb: number | null): DerivedGrowthCategory | null {
  if (zScoreBbTb === null) return null
  if (zScoreBbTb > 3) {
    return { kode: 'obesitas', label: 'Obesitas', severity: 'severe' }
  }
  if (zScoreBbTb > 2) {
    return { kode: 'gizi_lebih', label: 'Gizi Lebih / Gemuk', severity: 'warning' }
  }
  if (zScoreBbTb > 1) {
    return { kode: 'berisiko_gizi_lebih', label: 'Berisiko Gizi Lebih / Berisiko Gemuk', severity: 'warning' }
  }
  if (zScoreBbTb >= -2) {
    return { kode: 'normal', label: 'Gizi Baik / Normal', severity: 'normal' }
  }
  return { kode: 'kurang', label: 'Gizi Kurang / Wasting', severity: 'severe' }
}
