/**
 * prisma/seed.minimal.ts
 *
 * Minimal wilayah seed untuk development Phase 0.
 * Menyediakan 5 data wilayah (DIY + Jateng) untuk testing dropdown pendaftaran warga.
 *
 * Catatan: Script ini dirancang untuk dijalankan sekali saat development.
 * Untuk seed data lengkap (>500 wilayah DIY + Jateng + Jatim), gunakan
 * prisma/seed.wilayah.ts yang akan dibuat di Phase 7.
 *
 * Cara jalankan (dari dalam container backend):
 *   docker compose exec -T sispos-backend npx ts-node --project ./tsconfig.json ./prisma/seed.minimal.ts
 */

import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

const wilayahData = [
  {
    provinsi: 'DI Yogyakarta',
    kabupaten: 'Kota Yogyakarta',
    kecamatan: 'Mergangsan',
    kelurahan: 'Wirogunan',
    kodePos: '55151',
  },
  {
    provinsi: 'DI Yogyakarta',
    kabupaten: 'Kota Yogyakarta',
    kecamatan: 'Mergangsan',
    kelurahan: 'Brontokusuman',
    kodePos: '55153',
  },
  {
    provinsi: 'DI Yogyakarta',
    kabupaten: 'Kota Yogyakarta',
    kecamatan: 'Umbulharjo',
    kelurahan: 'Muja Muju',
    kodePos: '55165',
  },
  {
    provinsi: 'DI Yogyakarta',
    kabupaten: 'Sleman',
    kecamatan: 'Depok',
    kelurahan: 'Caturtunggal',
    kodePos: '55281',
  },
  {
    provinsi: 'Jawa Tengah',
    kabupaten: 'Kota Semarang',
    kecamatan: 'Semarang Tengah',
    kelurahan: 'Sekayu',
    kodePos: '50134',
  },
]

async function main(): Promise<void> {
  console.log('Memulai seed data wilayah minimal...')

  const result = await prisma.wilayah.createMany({
    data: wilayahData.map((w) => ({
      id: crypto.randomUUID(),
      ...w,
    })),
    skipDuplicates: false, // Selalu insert; script ini dijalankan sekali saat development
  })

  console.log(`Berhasil seed ${result.count} wilayah records`)
  console.log('Data yang di-seed:')
  wilayahData.forEach((w, i) => {
    console.log(`  ${i + 1}. ${w.kelurahan}, ${w.kecamatan}, ${w.kabupaten} (${w.provinsi}) - ${w.kodePos}`)
  })
}

main()
  .catch((e: unknown) => {
    console.error('Seed gagal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
