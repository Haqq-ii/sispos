// DEV/DEMO ONLY — jangan deploy ke produksi
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const ROUNDS = 10

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  console.log('🌱 Seeding demo accounts...')

  const pwHash = await bcrypt.hash('Demo1234!', ROUNDS)
  const pinHash = await bcrypt.hash('123456', ROUNDS)

  // 1. Puskesmas
  const puskesmas = await prisma.puskesmas.upsert({
    where: { email: 'demo@puskesmas-mergangsan.go.id' },
    update: { passwordHash: pwHash },
    create: {
      namaPuskesmas: 'Puskesmas Mergangsan',
      email: 'demo@puskesmas-mergangsan.go.id',
      passwordHash: pwHash,
      alamat: 'Jl. Kenari No. 10, Mergangsan, Kota Yogyakarta',
      nomorTelepon: '027412345678',
      wilayahKerja: 'Kecamatan Mergangsan',
    },
  })
  console.log('✓ Puskesmas:', puskesmas.email)

  // 2. Posyandu
  let posyandu = await prisma.posyandu.findFirst({
    where: { puskesmasId: puskesmas.id, namaPosyandu: 'Posyandu Mawar' },
  })
  if (!posyandu) {
    posyandu = await prisma.posyandu.create({
      data: {
        puskesmasId: puskesmas.id,
        namaPosyandu: 'Posyandu Mawar',
        provinsi: 'DI Yogyakarta',
        kabupaten: 'Kota Yogyakarta',
        kecamatan: 'Mergangsan',
        kelurahan: 'Wirogunan',
        rw: '003',
        latitude: -7.8014,
        longitude: 110.3647,
        jamOperasional: '08:00 - 12:00',
      },
    })
  } else if (!posyandu.latitude) {
    posyandu = await prisma.posyandu.update({
      where: { id: posyandu.id },
      data: { latitude: -7.8014, longitude: 110.3647 },
    })
  }
  console.log('✓ Posyandu:', posyandu.namaPosyandu)

  // 3. Kader
  const kader = await prisma.kader.upsert({
    where: { nomorPonsel: '081234560001' },
    update: { pinHash, gagalLogin: 0, terkunciSampai: null },
    create: {
      posyanduId: posyandu.id,
      namaLengkap: 'Siti Nurhaliza',
      nomorPonsel: '081234560001',
      pinHash,
      isKetua: false,
      isAktif: true,
    },
  })
  console.log('✓ Kader:', kader.namaLengkap, '/', kader.nomorPonsel)

  // 3b. Ketua Kader (isKetua: true, PIN: 654321)
  // Demo PIN ketua kader: 654321 — digunakan di TukarMejaModal untuk verifikasi
  const ketuaPinHash = await bcrypt.hash('654321', ROUNDS)
  const ketuaKader = await prisma.kader.upsert({
    where: { nomorPonsel: '081234560002' },
    update: { pinHash: ketuaPinHash, gagalLogin: 0, terkunciSampai: null, isKetua: true },
    create: {
      posyanduId: posyandu.id,
      namaLengkap: 'Ketua Demo Posyandu',
      nomorPonsel: '081234560002',
      pinHash: ketuaPinHash,
      isKetua: true,
      isAktif: true,
    },
  })
  console.log('✓ Ketua Kader:', ketuaKader.namaLengkap, '/', ketuaKader.nomorPonsel, '(PIN: 654321)')

  // 3c. Kader tambahan untuk demo 5 Meja (HP 081234560003–081234560006, PIN 123456)
  const kaderTambahan = [
    { nomorPonsel: '081234560003', namaLengkap: 'Nur Aini Wahyuni' },
    { nomorPonsel: '081234560004', namaLengkap: 'Retno Wulandari' },
    { nomorPonsel: '081234560005', namaLengkap: 'Sri Wahyuni Putri' },
    { nomorPonsel: '081234560006', namaLengkap: 'Dwi Rahayu Lestari' },
  ]
  for (const k of kaderTambahan) {
    await prisma.kader.upsert({
      where: { nomorPonsel: k.nomorPonsel },
      update: { pinHash, gagalLogin: 0, terkunciSampai: null },
      create: { posyanduId: posyandu.id, namaLengkap: k.namaLengkap, nomorPonsel: k.nomorPonsel, pinHash, isKetua: false, isAktif: true },
    })
    console.log('✓ Kader:', k.namaLengkap, '/', k.nomorPonsel)
  }

  // 4. Warga (Citizen)
  const warga = await prisma.warga.upsert({
    where: { nikIbu: '3471012345670001' },
    update: { passwordHash: pwHash, statusVerifikasi: 'terverifikasi', posyanduUtamaId: posyandu.id },
    create: {
      nikIbu: '3471012345670001',
      namaLengkap: 'Dewi Rahayu',
      nomorPonsel: '081234560010',
      passwordHash: pwHash,
      statusVerifikasi: 'terverifikasi',
      provinsi: 'DI Yogyakarta',
      kabupaten: 'Kota Yogyakarta',
      kecamatan: 'Mergangsan',
      kelurahan: 'Wirogunan',
      rw: '003',
      rt: '001',
      posyanduUtamaId: posyandu.id,
    },
  })
  console.log('✓ Warga:', warga.namaLengkap, '/', warga.nikIbu)

  // 5. Balita demo ke-1 (Budi Santoso)
  const existingBalita = await prisma.balita.findFirst({ where: { wargaId: warga.id } })
  if (!existingBalita) {
    const balita = await prisma.balita.create({
      data: {
        wargaId: warga.id,
        nikBalita: '3471012345670002',
        namaBalita: 'Budi Santoso',
        tanggalLahir: new Date('2024-01-15'),
        jenisKelamin: 'laki_laki',
      },
    })
    console.log('✓ Balita 1:', balita.namaBalita)
  } else {
    console.log('✓ Balita 1: sudah ada, skip')
  }

  // Balita ke-2: Sari Dewi (D-20)
  const existingBalita2 = await prisma.balita.findFirst({
    where: { nikBalita: '3471012345670003' }
  })
  if (!existingBalita2) {
    await prisma.balita.create({
      data: {
        wargaId: warga.id,
        nikBalita: '3471012345670003',
        namaBalita: 'Sari Dewi',
        tanggalLahir: new Date('2024-10-01'),
        jenisKelamin: 'perempuan',
      }
    })
    console.log('✓ Balita 2: Sari Dewi')
  } else {
    console.log('✓ Balita 2: Sari Dewi (sudah ada, skip)')
  }

  console.log('\n✅ Demo seed selesai!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Citizen:      NIK 3471012345670001 / Demo1234!')
  console.log('Kader Meja 1: HP  081234560001     / PIN 123456  (Siti Nurhaliza)')
  console.log('Kader Meja 2: HP  081234560003     / PIN 123456  (Nur Aini Wahyuni)')
  console.log('Kader Meja 3: HP  081234560004     / PIN 123456  (Retno Wulandari)')
  console.log('Kader Meja 4: HP  081234560005     / PIN 123456  (Sri Wahyuni Putri)')
  console.log('Kader Meja 5: HP  081234560006     / PIN 123456  (Dwi Rahayu Lestari)')
  console.log('Ketua Kader:  HP  081234560002     / PIN 654321  (Ketua Demo Posyandu)')
  console.log('Puskesmas:    demo@puskesmas-mergangsan.go.id / Demo1234!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// Standalone execution (backward compatibility)
if (require.main === module) {
  const standaloneClient = new PrismaClient()
  seedDemo(standaloneClient)
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(async () => { await standaloneClient.$disconnect() })
}
