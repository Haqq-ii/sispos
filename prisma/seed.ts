/**
 * prisma/seed.ts
 *
 * Master seed orchestrator untuk SISPOS.
 * Menjalankan semua fase seed secara berurutan:
 *   wilayah → massal → demo → today
 *
 * Cara jalankan (dari dalam container backend):
 *   npx prisma db seed
 * atau:
 *   docker compose exec sispos-backend npx prisma db seed
 *
 * // DEV/DEMO ONLY — tidak untuk digunakan di produksi
 */

import { PrismaClient } from '@prisma/client'
import { seedWilayah } from './seed.wilayah'
import { seedMassal } from './seed.massal'
import { seedDemo } from './seed.demo'
import { seedToday } from './seed.today'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 SISPOS Full Seed — mulai...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  console.log('\n[1/4] Seed Wilayah (DIY + Jateng + Jatim)...')
  await seedWilayah(prisma)
  console.log('✓ Seed Wilayah selesai.')

  console.log('\n[2/4] Seed Massal (Posyandu, Warga, Balita, Pemeriksaan, Imunisasi)...')
  await seedMassal(prisma)
  console.log('✓ Seed Massal selesai.')

  console.log('\n[3/4] Seed Demo (Akun demo, Balita ke-2)...')
  await seedDemo(prisma)
  console.log('✓ Seed Demo selesai.')

  console.log('\n[4/4] Seed Today (Jadwal, SlotSesi, Antrian hari ini)...')
  await seedToday(prisma)
  console.log('✓ Seed Today selesai.')

  console.log('\n✅ SISPOS Full Seed — selesai!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
