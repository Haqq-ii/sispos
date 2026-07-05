/**
 * seed.mawar.ts — Data demo realistis untuk Posyandu Mawar
 *
 * Membuat:
 * 1. Riwayat pemeriksaan bulanan Budi Santoso (30 bln) & Sari Dewi (21 bln)
 * 2. 15 keluarga tambahan di Posyandu Mawar dengan status gizi bervariasi
 *    sehingga dashboard kader menampilkan distribusi normal/kurang/buruk/pendek/lebih
 *
 * Semua data berbasis WHO Child Growth Standards 2006.
 * Dijalankan dari seed.ts setelah seedDemo, sebelum seedToday.
 */
import bcrypt from 'bcrypt'
import { JenisKelamin, PrismaClient, StatusGizi, StatusVerifikasi } from '@prisma/client'

// ── WHO 2006 median BB (kg) dan TB (cm) per usia bulan ──────────────────────
const WHO_BOYS: Record<number, [number, number]> = {
  0: [3.3, 49.9], 1: [4.5, 54.7], 2: [5.6, 58.4], 3: [6.4, 61.4],
  4: [7.0, 63.9], 5: [7.5, 65.9], 6: [7.9, 67.6], 7: [8.3, 69.2],
  8: [8.6, 70.6], 9: [8.9, 72.0], 10: [9.2, 73.3], 11: [9.4, 74.5],
  12: [9.6, 75.7], 13: [9.8, 76.9], 14: [10.0, 78.0], 15: [10.2, 79.1],
  16: [10.3, 80.2], 17: [10.5, 81.2], 18: [10.6, 82.3], 19: [10.8, 83.2],
  20: [10.9, 84.2], 21: [11.1, 85.1], 22: [11.2, 86.0], 23: [11.4, 86.9],
  24: [11.5, 87.8], 25: [11.7, 88.6], 26: [11.8, 89.4], 27: [11.9, 90.3],
  28: [12.1, 91.1], 29: [12.2, 91.9], 30: [12.3, 92.7], 33: [12.7, 95.1],
  36: [13.1, 96.1], 42: [14.3, 100.4], 48: [15.3, 103.3],
}

const WHO_GIRLS: Record<number, [number, number]> = {
  0: [3.2, 49.1], 1: [4.2, 53.7], 2: [5.1, 57.1], 3: [5.8, 59.8],
  4: [6.4, 62.1], 5: [6.9, 64.0], 6: [7.3, 65.7], 7: [7.6, 67.3],
  8: [7.9, 68.7], 9: [8.2, 70.1], 10: [8.5, 71.5], 11: [8.7, 72.8],
  12: [8.9, 74.0], 13: [9.2, 75.2], 14: [9.4, 76.4], 15: [9.6, 77.5],
  16: [9.8, 78.6], 17: [10.0, 79.7], 18: [10.2, 80.7], 19: [10.4, 81.7],
  20: [10.6, 82.7], 21: [10.9, 83.7], 22: [11.0, 84.6], 23: [11.2, 85.5],
  24: [11.5, 86.4], 25: [11.6, 87.3], 26: [11.8, 88.2], 27: [12.0, 89.1],
  28: [12.1, 90.0], 29: [12.3, 90.8], 30: [12.4, 91.7], 33: [12.9, 94.2],
  36: [13.9, 95.1], 42: [15.0, 100.3], 48: [15.8, 102.7],
}

function getMedian(gender: 'laki_laki' | 'perempuan', age: number): [number, number] {
  const tbl = gender === 'laki_laki' ? WHO_BOYS : WHO_GIRLS
  if (tbl[age]) return tbl[age]
  const keys = Object.keys(tbl).map(Number).sort((a, b) => a - b)
  const lo = keys.filter(k => k <= age).at(-1) ?? keys[0]
  const hi = keys.find(k => k > age) ?? keys.at(-1)!
  if (lo === hi) return tbl[lo]
  const r = (age - lo) / (hi - lo)
  return [
    Math.round((tbl[lo][0] + (tbl[hi][0] - tbl[lo][0]) * r) * 10) / 10,
    Math.round((tbl[lo][1] + (tbl[hi][1] - tbl[lo][1]) * r) * 10) / 10,
  ]
}

function getSd(age: number): [number, number] {
  if (age <= 6) return [0.7, 2.0]
  if (age <= 12) return [0.9, 2.5]
  if (age <= 24) return [1.1, 2.8]
  return [1.2, 3.0]
}

// GrowthProfile: menentukan rentang Z-score yang dihasilkan
type GrowthProfile =
  | 'normal'
  | 'kurang'
  | 'kurang_berat'    // fase paling parah (Z ~-2.25 sd -2.37)
  | 'kurang_ringan'   // fase pemulihan  (Z ~-2.00 sd -2.06)
  | 'buruk'
  | 'pendek'
  | 'lebih'

function calcRecord(
  gender: 'laki_laki' | 'perempuan',
  ageMonths: number,
  profile: GrowthProfile,
  jitter: number,
): { bb: number; tb: number; zBbU: number; zTbU: number; zBbTb: number; statusGizi: StatusGizi } {
  const [medBb, medTb] = getMedian(gender, ageMonths)
  const [sdBb, sdTb] = getSd(ageMonths)

  let zBbU: number, zTbU: number

  switch (profile) {
    case 'kurang':
      zBbU = -2.05 - (jitter % 4) * 0.05
      zTbU = -1.10 - (jitter % 3) * 0.05
      break
    case 'kurang_berat':
      zBbU = -2.25 - (jitter % 3) * 0.06
      zTbU = -1.30 - (jitter % 3) * 0.05
      break
    case 'kurang_ringan':
      zBbU = -2.00 - (jitter % 3) * 0.03
      zTbU = -1.00 - (jitter % 3) * 0.03
      break
    case 'buruk':
      zBbU = -3.10 - (jitter % 3) * 0.07
      zTbU = -1.80 - (jitter % 2) * 0.06
      break
    case 'pendek':
      zBbU = -0.40 + (jitter % 3) * 0.07
      zTbU = -2.30 - (jitter % 3) * 0.06
      break
    case 'lebih':
      zBbU = 1.90 + (jitter % 4) * 0.07
      zTbU = 0.40 + (jitter % 3) * 0.05
      break
    default: // normal
      zBbU = -0.30 + (jitter % 5) * 0.08
      zTbU = -0.20 + (jitter % 4) * 0.06
  }

  const bb = Math.max(Math.round((medBb + zBbU * sdBb) * 10) / 10, 2.0)
  const tb = Math.max(Math.round((medTb + zTbU * sdTb) * 10) / 10, 45.0)
  const zBbTb = Math.round((zBbU - zTbU * 0.25) * 100) / 100

  let statusGizi: StatusGizi
  if (zBbU <= -3) statusGizi = StatusGizi.buruk
  else if (zBbU <= -2) statusGizi = StatusGizi.kurang
  else if (zBbU >= 3) statusGizi = StatusGizi.obesitas
  else if (zBbU >= 2) statusGizi = StatusGizi.lebih
  else if (zTbU <= -3) statusGizi = StatusGizi.sangat_pendek
  else if (zTbU <= -2) statusGizi = StatusGizi.pendek
  else statusGizi = StatusGizi.normal

  return {
    bb, tb,
    zBbU: Math.round(zBbU * 100) / 100,
    zTbU: Math.round(zTbU * 100) / 100,
    zBbTb,
    statusGizi,
  }
}

function ageInMonths(birthDate: Date, today: Date): number {
  let m = (today.getFullYear() - birthDate.getFullYear()) * 12
  m += today.getMonth() - birthDate.getMonth()
  if (today.getDate() < birthDate.getDate()) m--
  return Math.max(m, 0)
}

function pemDate(birthDate: Date, monthOffset: number): Date {
  const d = new Date(birthDate)
  d.setMonth(d.getMonth() + monthOffset)
  d.setDate(5)
  return d
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════════════

export async function seedMawar(prisma: PrismaClient): Promise<void> {
  console.log('🌱 Seeding Posyandu Mawar (riwayat pemeriksaan realistis)...')

  const TODAY = new Date('2026-07-06')

  const posyanduRow = await prisma.posyandu.findFirst({ where: { namaPosyandu: 'Posyandu Mawar' } })
  if (!posyanduRow) throw new Error('Posyandu Mawar tidak ditemukan — jalankan seedDemo dulu')
  const posyanduId = posyanduRow.id  // captured string — always defined from here on

  const kader = await prisma.kader.findFirst({ where: { nomorPonsel: '081234560001' } })
  const kaderId = kader?.id

  // ── generateRiwayat: hapus lama, buat baru bulan per bulan ──────────────

  async function generateRiwayat(
    balitaId: string,
    gender: 'laki_laki' | 'perempuan',
    birthDate: Date,
    profileFn: (ageMonth: number) => GrowthProfile,
  ): Promise<number> {
    await prisma.pemeriksaan.deleteMany({ where: { balitaId } })
    const totalMonths = ageInMonths(birthDate, TODAY)

    for (let m = 1; m <= totalMonths; m++) {
      const tgl = pemDate(birthDate, m)
      if (tgl > TODAY) break
      const rec = calcRecord(gender, m, profileFn(m), m)
      await prisma.pemeriksaan.create({
        data: {
          balitaId,
          kaderId,
          beratBadan: rec.bb,
          tinggiBadan: rec.tb,
          zScoreBbU: rec.zBbU,
          zScoreTbU: rec.zTbU,
          zScoreBbTb: rec.zBbTb,
          statusGizi: rec.statusGizi,
          tanggalPemeriksaan: tgl,
        },
      })
    }
    return totalMonths
  }

  // ── upsertKeluarga: buat warga + balita jika belum ada ──────────────────

  const pwHash = await bcrypt.hash('Demo1234!', 10)

  async function upsertKeluarga(opts: {
    nikIbu: string; namaIbu: string; hp: string; rw: string; rt: string
    namaBalita: string; gender: 'laki_laki' | 'perempuan'; lahir: Date
  }) {
    const warga = await prisma.warga.upsert({
      where: { nikIbu: opts.nikIbu },
      update: {},
      create: {
        nikIbu: opts.nikIbu,
        namaLengkap: opts.namaIbu,
        nomorPonsel: opts.hp,
        passwordHash: pwHash,
        statusVerifikasi: StatusVerifikasi.terverifikasi,
        provinsi: 'DI Yogyakarta',
        kabupaten: 'Kota Yogyakarta',
        kecamatan: 'Mergangsan',
        kelurahan: 'Wirogunan',
        rw: opts.rw,
        rt: opts.rt,
        posyanduUtamaId: posyanduId,
      },
    })
    let balita = await prisma.balita.findFirst({ where: { wargaId: warga.id } })
    if (!balita) {
      balita = await prisma.balita.create({
        data: {
          wargaId: warga.id,
          namaBalita: opts.namaBalita,
          tanggalLahir: opts.lahir,
          jenisKelamin: opts.gender as JenisKelamin,
        },
      })
    }
    return { warga, balita }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. Budi Santoso (L, 2024-01-15, ~30 bln)
  //    Cerita: lahir normal → kurang gizi saat MPASI (6-15 bln) → intervensi kader →
  //            perlahan membaik (16-30 bln), saat ini masih "kurang" tapi tren naik
  // ════════════════════════════════════════════════════════════════════════

  const budiBalita = await prisma.balita.findFirst({ where: { nikBalita: '3471012345670002' } })
  if (budiBalita) {
    const n = await generateRiwayat(budiBalita.id, 'laki_laki', new Date('2024-01-15'), (age) => {
      if (age <= 5) return 'normal'
      if (age <= 15) return 'kurang_berat'   // fase terpuruk
      if (age <= 21) return 'kurang'          // mulai stabil
      return 'kurang_ringan'                  // pemulihan bertahap (masih kurang, tren naik)
    })
    console.log(`  ✓ Budi Santoso: ${n} pemeriksaan — normal→kurang_berat→kurang_ringan`)
  } else {
    console.log('  ⚠ Budi Santoso tidak ditemukan (nikBalita 3471012345670002)')
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. Sari Dewi (P, 2024-10-01, ~21 bln)
  //    Cerita: BB cukup, TB jauh di bawah median → stunting (pendek)
  //            terdeteksi sejak 4 bln, belum ada intervensi efektif
  // ════════════════════════════════════════════════════════════════════════

  const sariBalita = await prisma.balita.findFirst({ where: { nikBalita: '3471012345670003' } })
  if (sariBalita) {
    const n = await generateRiwayat(sariBalita.id, 'perempuan', new Date('2024-10-01'), (age) => {
      if (age <= 3) return 'normal'
      return 'pendek'
    })
    console.log(`  ✓ Sari Dewi: ${n} pemeriksaan — TB/U pendek, BB relatif normal`)
  } else {
    console.log('  ⚠ Sari Dewi tidak ditemukan (nikBalita 3471012345670003)')
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. 15 Keluarga Tambahan di Posyandu Mawar
  //    Usia bervariasi 3–42 bln; NIK warga dimulai dari 347109900100000x
  //    agar tidak tabrakan dengan seed massal (yang pakai format berbeda)
  // ════════════════════════════════════════════════════════════════════════

  const families: Array<{
    nikIbu: string; namaIbu: string; hp: string; rw: string; rt: string
    namaBalita: string; gender: 'laki_laki' | 'perempuan'; lahir: Date
    profileFn: (age: number) => GrowthProfile
  }> = [
    // ── Normal (5 keluarga) ─────────────────────────────────────────────
    {
      nikIbu: '3471099001000001', namaIbu: 'Ratna Sari', hp: '082123456201',
      rw: '003', rt: '001', namaBalita: 'Ahmad Fauzi', gender: 'laki_laki',
      lahir: new Date('2026-01-10'),   // ~6 bln
      profileFn: () => 'normal',
    },
    {
      nikIbu: '3471099001000002', namaIbu: 'Sri Wahyuni', hp: '082123456202',
      rw: '003', rt: '002', namaBalita: 'Putri Andini', gender: 'perempuan',
      lahir: new Date('2025-07-01'),   // ~12 bln
      profileFn: () => 'normal',
    },
    {
      nikIbu: '3471099001000005', namaIbu: 'Yuni Astuti', hp: '082123456205',
      rw: '003', rt: '005', namaBalita: 'Bayu Nugroho', gender: 'laki_laki',
      lahir: new Date('2025-10-05'),   // ~9 bln
      profileFn: () => 'normal',
    },
    {
      nikIbu: '3471099001000011', namaIbu: 'Retno Wilis', hp: '082123456211',
      rw: '004', rt: '001', namaBalita: 'Fajar Santoso', gender: 'laki_laki',
      lahir: new Date('2026-04-05'),   // ~3 bln
      profileFn: () => 'normal',
    },
    {
      nikIbu: '3471099001000015', namaIbu: 'Ika Wahyudi', hp: '082123456215',
      rw: '004', rt: '005', namaBalita: 'Raka Permana', gender: 'laki_laki',
      lahir: new Date('2025-12-20'),   // ~6.5 bln
      profileFn: () => 'normal',
    },

    // ── Kurang Gizi (3 keluarga) ─────────────────────────────────────────
    {
      nikIbu: '3471099001000003', namaIbu: 'Endang Sulistyowati', hp: '082123456203',
      rw: '003', rt: '003', namaBalita: 'Rizki Pratama', gender: 'laki_laki',
      lahir: new Date('2024-12-15'),   // ~19 bln
      profileFn: (age) => age <= 5 ? 'normal' : 'kurang',
    },
    {
      nikIbu: '3471099001000007', namaIbu: 'Wulan Sari', hp: '082123456207',
      rw: '003', rt: '007', namaBalita: 'Dimas Eko Prasetyo', gender: 'laki_laki',
      lahir: new Date('2024-01-20'),   // ~29 bln
      profileFn: (age) => age <= 4 ? 'normal' : 'kurang',
    },
    {
      nikIbu: '3471099001000010', namaIbu: 'Novi Setiani', hp: '082123456210',
      rw: '004', rt: '002', namaBalita: 'Intan Puspita', gender: 'perempuan',
      lahir: new Date('2024-10-15'),   // ~21 bln
      profileFn: (age) => age <= 6 ? 'normal' : 'kurang',
    },

    // ── Gizi Buruk (2 keluarga) ──────────────────────────────────────────
    {
      nikIbu: '3471099001000006', namaIbu: 'Fitri Rahayu', hp: '082123456206',
      rw: '003', rt: '006', namaBalita: 'Anisa Fitriana', gender: 'perempuan',
      lahir: new Date('2023-06-15'),   // ~37 bln
      profileFn: (age) => age <= 7 ? 'kurang' : 'buruk',
    },
    {
      nikIbu: '3471099001000014', namaIbu: 'Nining Rahayu', hp: '082123456214',
      rw: '004', rt: '004', namaBalita: 'Zahwa Amelia', gender: 'perempuan',
      lahir: new Date('2024-02-28'),   // ~28 bln
      profileFn: (age) => age <= 5 ? 'normal' : 'buruk',
    },

    // ── Pendek/Stunting (3 keluarga) ─────────────────────────────────────
    {
      nikIbu: '3471099001000004', namaIbu: 'Dian Pertiwi', hp: '082123456204',
      rw: '003', rt: '004', namaBalita: 'Lestari Wulandari', gender: 'perempuan',
      lahir: new Date('2024-07-20'),   // ~23 bln
      profileFn: (age) => age <= 4 ? 'normal' : 'pendek',
    },
    {
      nikIbu: '3471099001000008', namaIbu: 'Ningsih Susilo', hp: '082123456208',
      rw: '003', rt: '008', namaBalita: 'Cantika Dewi', gender: 'perempuan',
      lahir: new Date('2025-04-10'),   // ~15 bln
      profileFn: (age) => age <= 3 ? 'normal' : 'pendek',
    },
    {
      nikIbu: '3471099001000012', namaIbu: 'Sari Mulyani', hp: '082123456212',
      rw: '004', rt: '002', namaBalita: 'Nayla Putri', gender: 'perempuan',
      lahir: new Date('2024-04-10'),   // ~27 bln
      profileFn: (age) => age <= 4 ? 'normal' : 'pendek',
    },

    // ── Lebih/Overweight (1 keluarga) ────────────────────────────────────
    {
      nikIbu: '3471099001000013', namaIbu: 'Dewi Lestari', hp: '082123456213',
      rw: '004', rt: '003', namaBalita: 'Aditya Prabowo', gender: 'laki_laki',
      lahir: new Date('2023-07-15'),   // ~36 bln
      profileFn: () => 'lebih',
    },

    // ── Kurang Berat aktif (kasus serius kader) ──────────────────────────
    {
      nikIbu: '3471099001000009', namaIbu: 'Hesti Purwanti', hp: '082123456209',
      rw: '004', rt: '001', namaBalita: 'Galang Ramadhan', gender: 'laki_laki',
      lahir: new Date('2023-01-25'),   // ~42 bln
      profileFn: (age) => age <= 12 ? 'normal' : 'kurang_berat',
    },
  ]

  for (const fam of families) {
    const { balita } = await upsertKeluarga(fam)
    const n = await generateRiwayat(balita.id, fam.gender, fam.lahir, fam.profileFn)
    const age = ageInMonths(fam.lahir, TODAY)
    console.log(`  ✓ ${fam.namaBalita} (${age} bln, ${n} pemeriksaan)`)
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  const totalBalita = await prisma.balita.count({
    where: { warga: { posyanduUtamaId: posyanduId } },
  })
  const totalPemeriksaan = await prisma.pemeriksaan.count({
    where: { balita: { warga: { posyanduUtamaId: posyanduId } } },
  })

  console.log(`\n✅ Posyandu Mawar: ${totalBalita} balita, ${totalPemeriksaan} pemeriksaan`)
  console.log('   Distribusi: Normal ✓ | Kurang ✓ | Buruk ✓ | Pendek ✓ | Lebih ✓')
}

if (require.main === module) {
  const client = new PrismaClient()
  seedMawar(client)
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => client.$disconnect())
}
