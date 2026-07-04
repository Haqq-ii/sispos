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
        jamOperasional: '08:00 - 12:00',
      },
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
  console.log('Citizen:   NIK 3471012345670001 / Demo1234!')
  console.log('Kader:     HP  081234560001     / PIN 123456')
  console.log('Puskesmas: demo@puskesmas-mergangsan.go.id / Demo1234!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// Standalone execution (backward compatibility)
if (require.main === module) {
  const standaloneClient = new PrismaClient()
  seedDemo(standaloneClient)
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(async () => { await standaloneClient.$disconnect() })
}
