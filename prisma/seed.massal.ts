/**
 * prisma/seed.massal.ts
 *
 * Generator data massal untuk SISPOS:
 * - 3 Puskesmas (termasuk Puskesmas Mergangsan demo)
 * - 15 Posyandu (5 per puskesmas, dengan koordinat Leaflet)
 * - 375-525 Warga + Balita tersebar merata
 * - Distribusi status gizi bertingkat per posyandu (sehat/sedang/rawan/kritis/outlier)
 *
 * DEV/DEMO ONLY — tidak untuk produksi
 *
 * Dipanggil dari prisma/seed.ts sebagai `await seedMassal(prisma)`.
 * Bisa dijalankan standalone: ts-node prisma/seed.massal.ts
 */

import bcrypt from 'bcrypt'
import { JenisKelamin, PrismaClient, StatusGizi, StatusVerifikasi } from '@prisma/client'

const BCRYPT_ROUNDS = 8 // Lebih cepat dari 10 untuk data bulk; acceptable untuk demo

// ============================================================
// DATA PUSKESMAS (3 total)
// ============================================================

const PUSKESMAS_DATA = [
  {
    namaPuskesmas: 'Puskesmas Mergangsan',
    email: 'demo@puskesmas-mergangsan.go.id',
    alamat: 'Jl. Kenari No. 10, Mergangsan, Kota Yogyakarta',
    nomorTelepon: '0274512345',
    wilayahKerja: 'Kecamatan Mergangsan',
    passwordPlain: 'Demo1234!',
  },
  {
    namaPuskesmas: 'Puskesmas Gedongtengen',
    email: 'admin@puskesmas-gedongtengen.go.id',
    alamat: 'Jl. Tentara Pelajar No. 1, Gedongtengen, Kota Yogyakarta',
    nomorTelepon: '0274678901',
    wilayahKerja: 'Kecamatan Gedongtengen',
    passwordPlain: 'Massal1234!',
  },
  {
    namaPuskesmas: 'Puskesmas Umbulharjo',
    email: 'admin@puskesmas-umbulharjo.go.id',
    alamat: 'Jl. Veteran No. 22, Umbulharjo, Kota Yogyakarta',
    nomorTelepon: '0274789012',
    wilayahKerja: 'Kecamatan Umbulharjo',
    passwordPlain: 'Massal1234!',
  },
]

// ============================================================
// DATA POSYANDU (15 total: 5 per puskesmas)
// ============================================================

type StatusGroup = 'sehat' | 'sedang' | 'rawan' | 'kritis' | 'outlier'

interface PosyanduEntry {
  puskesmasEmail: string
  namaPosyandu: string
  kecamatan: string
  kelurahan: string
  rw: string
  latitude: number
  longitude: number
  statusGroup: StatusGroup
  targetBalita: number
}

const POSYANDU_DATA: PosyanduEntry[] = [
  // --- Mergangsan (5 posyandu) ---
  {
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Mawar',
    kecamatan: 'Mergangsan',
    kelurahan: 'Wirogunan',
    rw: '003',
    latitude: -7.8160,
    longitude: 110.3700,
    statusGroup: 'rawan',
    targetBalita: 28,
  },
  {
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Melati',
    kecamatan: 'Mergangsan',
    kelurahan: 'Brontokusuman',
    rw: '002',
    latitude: -7.8190,
    longitude: 110.3680,
    statusGroup: 'sehat',
    targetBalita: 26,
  },
  {
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Anggrek',
    kecamatan: 'Mergangsan',
    kelurahan: 'Mergangsan',
    rw: '005',
    latitude: -7.8140,
    longitude: 110.3720,
    statusGroup: 'sedang',
    targetBalita: 30,
  },
  {
    // D-13: Cluster stunting kritis di Wirogunan RW 007
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Dahlia',
    kecamatan: 'Mergangsan',
    kelurahan: 'Wirogunan',
    rw: '007',
    latitude: -7.8175,
    longitude: 110.3710,
    statusGroup: 'kritis',
    targetBalita: 27,
  },
  {
    puskesmasEmail: 'demo@puskesmas-mergangsan.go.id',
    namaPosyandu: 'Posyandu Kenanga',
    kecamatan: 'Mergangsan',
    kelurahan: 'Brontokusuman',
    rw: '009',
    latitude: -7.8200,
    longitude: 110.3660,
    statusGroup: 'outlier',
    targetBalita: 25,
  },

  // --- Gedongtengen (5 posyandu) ---
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Seruni',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Pringgokusuman',
    rw: '001',
    latitude: -7.7920,
    longitude: 110.3620,
    statusGroup: 'sehat',
    targetBalita: 28,
  },
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Cempaka',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Sosromenduran',
    rw: '003',
    latitude: -7.7935,
    longitude: 110.3610,
    statusGroup: 'sedang',
    targetBalita: 30,
  },
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Kamboja',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Pringgokusuman',
    rw: '006',
    latitude: -7.7950,
    longitude: 110.3630,
    statusGroup: 'sedang',
    targetBalita: 27,
  },
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Aster',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Sosromenduran',
    rw: '008',
    latitude: -7.7960,
    longitude: 110.3640,
    statusGroup: 'rawan',
    targetBalita: 26,
  },
  {
    puskesmasEmail: 'admin@puskesmas-gedongtengen.go.id',
    namaPosyandu: 'Posyandu Bougenville',
    kecamatan: 'Gedongtengen',
    kelurahan: 'Pringgokusuman',
    rw: '011',
    latitude: -7.7975,
    longitude: 110.3650,
    statusGroup: 'kritis',
    targetBalita: 28,
  },

  // --- Umbulharjo (5 posyandu) ---
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Flamboyan',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Muja Muju',
    rw: '002',
    latitude: -7.8050,
    longitude: 110.3870,
    statusGroup: 'sehat',
    targetBalita: 28,
  },
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Teratai',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Tahunan',
    rw: '004',
    latitude: -7.8070,
    longitude: 110.3890,
    statusGroup: 'sedang',
    targetBalita: 30,
  },
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Wijayakusuma',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Warungboto',
    rw: '003',
    latitude: -7.8090,
    longitude: 110.3910,
    statusGroup: 'rawan',
    targetBalita: 27,
  },
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Tulip',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Sorosutan',
    rw: '006',
    latitude: -7.8110,
    longitude: 110.3930,
    statusGroup: 'kritis',
    targetBalita: 26,
  },
  {
    puskesmasEmail: 'admin@puskesmas-umbulharjo.go.id',
    namaPosyandu: 'Posyandu Lavender',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Pandeyan',
    rw: '008',
    latitude: -7.8130,
    longitude: 110.3950,
    statusGroup: 'outlier',
    targetBalita: 25,
  },
]

// ============================================================
// DISTRIBUSI STATUS GIZI (weighted random per statusGroup)
// ============================================================

const STATUS_GIZI_DIST: Record<StatusGroup, { s: string; w: number }[]> = {
  sehat:   [{ s: 'normal', w: 80 }, { s: 'kurang', w: 10 }, { s: 'pendek', w: 5 }, { s: 'lebih', w: 5 }],
  sedang:  [{ s: 'normal', w: 60 }, { s: 'kurang', w: 25 }, { s: 'pendek', w: 10 }, { s: 'buruk', w: 5 }],
  rawan:   [{ s: 'normal', w: 40 }, { s: 'kurang', w: 30 }, { s: 'pendek', w: 20 }, { s: 'buruk', w: 10 }],
  kritis:  [{ s: 'normal', w: 30 }, { s: 'kurang', w: 25 }, { s: 'pendek', w: 25 }, { s: 'buruk', w: 15 }, { s: 'sangat_pendek', w: 5 }],
  outlier: [{ s: 'lebih', w: 60 }, { s: 'obesitas', w: 25 }, { s: 'normal', w: 15 }],
}

// ============================================================
// NAMA IBU & BALITA (khas Jawa/Yogyakarta)
// ============================================================

const WARGA_IBU_NAMES = [
  'Siti Aminah', 'Dewi Lestari', 'Sri Wahyuni', 'Rini Handayani', 'Yuni Astuti',
  'Eni Susanti', 'Wati Rahayu', 'Anik Suryani', 'Tutik Wulandari', 'Sari Utami',
  'Endah Priyatni', 'Ning Raharti', 'Retno Widayati', 'Umi Kulsum', 'Puji Lestari',
  'Hartini Soewondo', 'Kustiyah Broto', 'Lastri Mulyani', 'Sumarni Dwiputri', 'Niken Cahyani',
]

const BALITA_NAMES_L = [
  'Bima Prakoso', 'Aldi Susanto', 'Fajar Nugroho', 'Rizki Hidayat', 'Bayu Setiawan',
  'Dimas Wicaksono', 'Agus Prasetyo', 'Hendra Gunawan', 'Wahyu Santoso', 'Teguh Kurniawan',
]

const BALITA_NAMES_P = [
  'Ayu Puspita', 'Rini Cahyanti', 'Dewi Kusuma', 'Sari Wulandari', 'Indah Permatasari',
  'Bunga Rahayu', 'Tari Handayani', 'Laras Pertiwi', 'Citra Dewi', 'Melati Suci',
]

// ============================================================
// JADWAL IMUNISASI DASAR (module-level — Kemenkes standard)
// ============================================================

const IMUNISASI_SCHEDULE = [
  { namaVaksin: 'BCG',         dosisKe: 1, ageMonth: 0 },
  { namaVaksin: 'Polio',       dosisKe: 1, ageMonth: 0 },
  { namaVaksin: 'Polio',       dosisKe: 2, ageMonth: 2 },
  { namaVaksin: 'DPT-HB-Hib', dosisKe: 1, ageMonth: 2 },
  { namaVaksin: 'Polio',       dosisKe: 3, ageMonth: 3 },
  { namaVaksin: 'DPT-HB-Hib', dosisKe: 2, ageMonth: 3 },
  { namaVaksin: 'Polio',       dosisKe: 4, ageMonth: 4 },
  { namaVaksin: 'DPT-HB-Hib', dosisKe: 3, ageMonth: 4 },
  { namaVaksin: 'Campak',      dosisKe: 1, ageMonth: 9 },
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/** Weighted random pick using deterministic seed (seed % 100 as roll) */
function pickWeighted(dist: { s: string; w: number }[], seed: number): string {
  const roll = seed % 100
  let cumulative = 0
  for (const item of dist) {
    cumulative += item.w
    if (roll < cumulative) return item.s
  }
  return dist[dist.length - 1].s
}

/**
 * Generate 16-digit NIK from posIdx + balIdx.
 * Format: 3471 (DIY prefix) + posIdx:2 + balIdx:4 + suffix:6
 * T-07-02-02: pattern guaranteed unique within seed scope.
 */
function genNIK(posIdx: number, balIdx: number): string {
  return (
    '3471' +
    String(posIdx).padStart(2, '0') +
    String(balIdx).padStart(4, '0') +
    String(posIdx * 100 + balIdx).padStart(6, '0')
  )
}

/** Generate 12-digit HP number from posIdx + balIdx (no collision with demo accounts) */
function genHP(posIdx: number, balIdx: number): string {
  return '0812' + String(posIdx).padStart(3, '0') + String(balIdx).padStart(5, '0')
}

/** Generate tanggal lahir balita usia 6-59 bulan (seed-deterministic) */
function genTanggalLahirBalita(seed: number): Date {
  const ageMonths = 6 + (seed % 54) // 6..59 bulan
  const today = new Date()
  return new Date(today.getTime() - ageMonths * 30 * 24 * 60 * 60 * 1000)
}

/** Approximate Z-Score values based on statusGizi category */
function getZScores(
  statusGizi: string,
  seed: number,
): { zBbU: number; zTbU: number; zScoreBbTb: number } {
  switch (statusGizi) {
    case 'normal':
      return {
        zBbU: -1.5 + (seed % 30) * 0.1,
        zTbU: -1.0 + (seed % 20) * 0.1,
        zScoreBbTb: -0.5 + (seed % 10) * 0.1,
      }
    case 'kurang':
      return {
        zBbU: -2.8 + (seed % 8) * 0.1,
        zTbU: -1.5 + (seed % 10) * 0.1,
        zScoreBbTb: -1.2 + (seed % 8) * 0.1,
      }
    case 'buruk':
      return {
        zBbU: -3.5 + (seed % 5) * 0.1,
        zTbU: -2.5 + (seed % 5) * 0.1,
        zScoreBbTb: -2.0 + (seed % 5) * 0.1,
      }
    case 'pendek':
      return {
        zBbU: -1.0 + (seed % 20) * 0.1,
        zTbU: -2.8 + (seed % 8) * 0.1,
        zScoreBbTb: -0.5 + (seed % 10) * 0.1,
      }
    case 'sangat_pendek':
      return {
        zBbU: -1.5 + (seed % 10) * 0.1,
        zTbU: -3.8 + (seed % 8) * 0.1,
        zScoreBbTb: -0.5 + (seed % 5) * 0.1,
      }
    case 'lebih':
      return {
        zBbU: 2.0 + (seed % 8) * 0.1,
        zTbU: 0.5 + (seed % 10) * 0.1,
        zScoreBbTb: 1.5 + (seed % 8) * 0.1,
      }
    case 'obesitas':
      return {
        zBbU: 3.0 + (seed % 5) * 0.1,
        zTbU: 1.0 + (seed % 5) * 0.1,
        zScoreBbTb: 2.5 + (seed % 5) * 0.1,
      }
    default:
      return { zBbU: 0, zTbU: 0, zScoreBbTb: 0 }
  }
}

/** Approximate BB (kg) + TB (cm) based on usia balita in months */
function getMeasurements(
  ageMonths: number,
  seed: number,
): { beratBadan: number; tinggiBadan: number } {
  if (ageMonths <= 6) {
    return { beratBadan: 3.0 + (seed % 50) * 0.1, tinggiBadan: 50 + (seed % 17) }
  } else if (ageMonths <= 12) {
    return { beratBadan: 7.0 + (seed % 30) * 0.1, tinggiBadan: 67 + (seed % 8) }
  } else if (ageMonths <= 24) {
    return { beratBadan: 9.0 + (seed % 30) * 0.1, tinggiBadan: 75 + (seed % 10) }
  } else {
    return { beratBadan: 12.0 + (seed % 60) * 0.1, tinggiBadan: 85 + (seed % 25) }
  }
}

// ============================================================
// RECORD TYPE (untuk loop pemeriksaan + imunisasi)
// ============================================================

interface BalitaRecord {
  balita: { id: string }
  statusGizi: string
  tanggalLahir: Date
  posIdx: number
  balitaIdx: number
}

// ============================================================
// MAIN EXPORT
// ============================================================

export async function seedMassal(prisma: PrismaClient): Promise<void> {
  // Hitung todayStart dalam WIB
  const nowUtc = new Date()
  const wibMs = 7 * 60 * 60 * 1000
  const nowWib = new Date(nowUtc.getTime() + wibMs)
  const todayStart = new Date(
    Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()),
  )

  // Hash password sekali (efisiensi bulk)
  const demoHash = await bcrypt.hash('Demo1234!', BCRYPT_ROUNDS)
  const massalHash = await bcrypt.hash('Warga1234!', BCRYPT_ROUNDS)
  const puskHash = await bcrypt.hash('Massal1234!', BCRYPT_ROUNDS)

  // ---- 1. Upsert 3 Puskesmas ----
  const puskesmasMap = new Map<string, { id: string }>()
  for (const entry of PUSKESMAS_DATA) {
    const pwHash = entry.passwordPlain === 'Demo1234!' ? demoHash : puskHash
    const puskesmas = await prisma.puskesmas.upsert({
      where: { email: entry.email },
      update: { passwordHash: pwHash },
      create: {
        namaPuskesmas: entry.namaPuskesmas,
        email: entry.email,
        passwordHash: pwHash,
        alamat: entry.alamat,
        nomorTelepon: entry.nomorTelepon,
        wilayahKerja: entry.wilayahKerja,
      },
    })
    puskesmasMap.set(entry.email, puskesmas)
    console.log('✓ Puskesmas:', puskesmas.id.slice(0, 8), '—', entry.namaPuskesmas)
  }

  // ---- 2. Find or create 15 Posyandu ----
  const posyanduList: Array<{
    id: string
    kecamatan: string
    kelurahan: string
    rw: string
  }> = []

  for (const entry of POSYANDU_DATA) {
    const puskesmas = puskesmasMap.get(entry.puskesmasEmail)!
    let posyandu = await prisma.posyandu.findFirst({
      where: { puskesmasId: puskesmas.id, namaPosyandu: entry.namaPosyandu },
    })
    if (!posyandu) {
      posyandu = await prisma.posyandu.create({
        data: {
          puskesmasId: puskesmas.id,
          namaPosyandu: entry.namaPosyandu,
          provinsi: 'DI Yogyakarta',
          kabupaten: 'Kota Yogyakarta',
          kecamatan: entry.kecamatan,
          kelurahan: entry.kelurahan,
          rw: entry.rw,
          latitude: entry.latitude,
          longitude: entry.longitude,
          jamOperasional: '08:00 - 12:00',
        },
      })
    }
    posyanduList.push(posyandu)
  }

  // ---- 3. Create Warga + Balita per posyandu ----
  let totalBalita = 0
  const balitaRecords: BalitaRecord[] = []

  for (const [posIdx, entry] of POSYANDU_DATA.entries()) {
    const posyandu = posyanduList[posIdx]

    for (let balitaIdx = 0; balitaIdx < entry.targetBalita; balitaIdx++) {
      const nik = genNIK(posIdx, balitaIdx)
      const hp = genHP(posIdx, balitaIdx)
      const seed = posIdx * 100 + balitaIdx
      const statusGizi = pickWeighted(STATUS_GIZI_DIST[entry.statusGroup], seed)
      const tanggalLahir = genTanggalLahirBalita(posIdx * 1000 + balitaIdx)
      const jenisKelamin: JenisKelamin =
        balitaIdx % 2 === 0 ? JenisKelamin.laki_laki : JenisKelamin.perempuan

      // Upsert Warga (idempotent via nikIbu unique)
      const warga = await prisma.warga.upsert({
        where: { nikIbu: nik },
        update: {},
        create: {
          nikIbu: nik,
          namaLengkap: WARGA_IBU_NAMES[balitaIdx % 20],
          nomorPonsel: hp,
          passwordHash: massalHash,
          statusVerifikasi: StatusVerifikasi.terverifikasi,
          provinsi: 'DI Yogyakarta',
          kabupaten: 'Kota Yogyakarta',
          kecamatan: posyandu.kecamatan,
          kelurahan: posyandu.kelurahan,
          rw: posyandu.rw,
          rt: String(1 + (balitaIdx % 5)).padStart(3, '0'),
          posyanduUtamaId: posyandu.id,
        },
      })

      // Find or create Balita (idempotent via nikBalita)
      const balitaNik = nik.slice(0, 15) + '9'
      let balita = await prisma.balita.findFirst({ where: { nikBalita: balitaNik } })
      if (!balita) {
        balita = await prisma.balita.create({
          data: {
            wargaId: warga.id,
            nikBalita: balitaNik,
            namaBalita:
              jenisKelamin === JenisKelamin.laki_laki
                ? BALITA_NAMES_L[balitaIdx % 10]
                : BALITA_NAMES_P[balitaIdx % 10],
            tanggalLahir,
            jenisKelamin,
          },
        })
      }

      // Kumpulkan untuk loop Pemeriksaan + Imunisasi di bawah
      balitaRecords.push({ balita, statusGizi, tanggalLahir, posIdx, balitaIdx })
      totalBalita++
    }

    console.log('✓', entry.namaPosyandu, '—', entry.targetBalita, 'balita')
  }

  // ---- 4. Buat riwayat Pemeriksaan (12-15 bulan) per balita ----
  console.log('\n[Pemeriksaan] Membuat riwayat pemeriksaan...')
  for (const rec of balitaRecords) {
    const { balita, statusGizi, tanggalLahir, posIdx, balitaIdx } = rec
    const lookbackMonths = 12 + (posIdx + balitaIdx) % 4 // 12-15 bulan

    for (let m = lookbackMonths; m >= 0; m--) {
      // D-15: skip ~25% bulan untuk realistis (70-80% kehadiran)
      if ((posIdx + balitaIdx + m) % 4 === 0) continue

      const examDate = new Date(todayStart.getTime() - m * 30 * 24 * 60 * 60 * 1000)
      const examDateStr = examDate.toISOString().split('T')[0]
      const tanggalPemeriksaan = new Date(examDateStr)

      const ageMonthsAtExam = Math.floor(
        (examDate.getTime() - tanggalLahir.getTime()) / (30 * 24 * 60 * 60 * 1000),
      )
      if (ageMonthsAtExam < 0) continue

      // D-16: tren BB bervariasi (membaik / stabil / memburuk)
      const trendOffset =
        balitaIdx % 3 === 0
          ? (lookbackMonths - m) * 0.05  // membaik
          : balitaIdx % 3 === 2
            ? -(lookbackMonths - m) * 0.05 // memburuk
            : 0 // stabil

      const examSeed = posIdx * 10000 + balitaIdx * 100 + m
      const zs = getZScores(statusGizi, examSeed)
      const ms = getMeasurements(ageMonthsAtExam, examSeed)

      const existing = await prisma.pemeriksaan.findFirst({
        where: { balitaId: balita.id, tanggalPemeriksaan },
      })
      if (!existing) {
        await prisma.pemeriksaan.create({
          data: {
            balitaId: balita.id,
            beratBadan: Math.round((ms.beratBadan + trendOffset * 0.2) * 10) / 10,
            tinggiBadan: Math.round(ms.tinggiBadan * 10) / 10,
            zScoreBbU: Math.round((zs.zBbU + trendOffset) * 100) / 100,
            zScoreTbU: Math.round(zs.zTbU * 100) / 100,
            zScoreBbTb: Math.round(zs.zScoreBbTb * 100) / 100,
            statusGizi: statusGizi as StatusGizi,
            tanggalPemeriksaan,
          },
        })
      }
    }
  }

  // ---- 5. Buat riwayat Imunisasi dasar per balita ----
  console.log('[Imunisasi] Membuat riwayat imunisasi dasar...')
  for (const rec of balitaRecords) {
    const { balita, tanggalLahir, posIdx, balitaIdx } = rec
    const ageMonthsNow = Math.floor(
      (todayStart.getTime() - tanggalLahir.getTime()) / (30 * 24 * 60 * 60 * 1000),
    )

    for (const [vIdx, vax] of IMUNISASI_SCHEDULE.entries()) {
      if (ageMonthsNow < vax.ageMonth) continue
      // D-19: skip ~25% untuk realistis (70-80% imunisasi lengkap)
      if ((posIdx + balitaIdx + vIdx) % 4 === 3) continue

      const existing = await prisma.imunisasi.findFirst({
        where: { balitaId: balita.id, namaVaksin: vax.namaVaksin, dosisKe: vax.dosisKe },
      })
      if (!existing) {
        const injeksiDate = new Date(
          tanggalLahir.getTime() + vax.ageMonth * 30 * 24 * 60 * 60 * 1000,
        )
        await prisma.imunisasi.create({
          data: {
            balitaId: balita.id,
            namaVaksin: vax.namaVaksin,
            dosisKe: vax.dosisKe,
            tanggalInjeksi: new Date(injeksiDate.toISOString().split('T')[0]),
          },
        })
      }
    }
  }

  // ---- Summary ----
  console.log(`\n✅ seedMassal selesai — 15 posyandu, ${totalBalita} balita`)
}

// ============================================================
// STANDALONE GUARD
// ============================================================

if (require.main === module) {
  const prismaClient = new PrismaClient()
  seedMassal(prismaClient)
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prismaClient.$disconnect()
    })
}
