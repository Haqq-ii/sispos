/**
 * seed.today.ts — Buat Jadwal + SlotSesi + Antrian untuk hari ini (smoke test)
 * Run: npx ts-node --project tsconfig.json prisma/seed.today.ts
 */
import { PrismaClient, StatusJadwal } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding jadwal hari ini...')

  // Temukan posyandu demo
  const posyandu = await prisma.posyandu.findFirst({
    where: { namaPosyandu: 'Posyandu Mawar' },
  })
  if (!posyandu) throw new Error('Posyandu Mawar tidak ditemukan — jalankan seed.demo.ts dulu')

  const puskesmas = await prisma.puskesmas.findFirst({
    where: { email: 'demo@puskesmas-mergangsan.go.id' },
  })
  if (!puskesmas) throw new Error('Puskesmas demo tidak ditemukan')

  // Hari ini UTC+7 (WIB)
  const nowUtc = new Date()
  const wibOffset = 7 * 60 * 60 * 1000
  const nowWib = new Date(nowUtc.getTime() + wibOffset)
  const todayStart = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()))

  console.log('Tanggal hari ini (WIB):', todayStart.toISOString().split('T')[0])

  // Upsert Jadwal hari ini
  let jadwal = await prisma.jadwal.findFirst({
    where: { posyanduId: posyandu.id, tanggalPelaksanaan: todayStart },
  })
  if (!jadwal) {
    jadwal = await prisma.jadwal.create({
      data: {
        posyanduId: posyandu.id,
        puskesmasId: puskesmas.id,
        tanggalPelaksanaan: todayStart,
        estimasiDurasiMenit: 10,
        statusJadwal: StatusJadwal.aktif,
      },
    })
    console.log('✓ Jadwal dibuat:', jadwal.id)
  } else {
    // Update status jadi aktif kalau bukan
    if (jadwal.statusJadwal !== StatusJadwal.aktif) {
      jadwal = await prisma.jadwal.update({
        where: { id: jadwal.id },
        data: { statusJadwal: StatusJadwal.aktif },
      })
    }
    console.log('✓ Jadwal sudah ada:', jadwal.id)
  }

  // Buat 3 SlotSesi kalau belum ada
  const existingSlots = await prisma.slotSesi.findMany({ where: { jadwalId: jadwal.id } })
  if (existingSlots.length === 0) {
    const SESI = [
      { nomorSesi: 1, labelSesi: 'Sesi 1 (08:00 - 09:00)', jamMulaiHour: 8, jamSelesaiHour: 9 },
      { nomorSesi: 2, labelSesi: 'Sesi 2 (09:00 - 10:00)', jamMulaiHour: 9, jamSelesaiHour: 10 },
      { nomorSesi: 3, labelSesi: 'Sesi 3 (10:00 - 11:00)', jamMulaiHour: 10, jamSelesaiHour: 11 },
    ]
    const kuota = Math.floor(60 / 10) // 6 per sesi
    await prisma.slotSesi.createMany({
      data: SESI.map((s) => ({
        jadwalId: jadwal!.id,
        nomorSesi: s.nomorSesi,
        labelSesi: s.labelSesi,
        jamMulai: new Date(Date.UTC(1970, 0, 1, s.jamMulaiHour, 0, 0)),
        jamSelesai: new Date(Date.UTC(1970, 0, 1, s.jamSelesaiHour, 0, 0)),
        kuota,
        terisi: 0,
      })),
    })
    console.log('✓ 3 SlotSesi dibuat')
  } else {
    console.log('✓ SlotSesi sudah ada:', existingSlots.length, 'slot')
  }

  // Ambil Sesi 1 untuk antrian demo
  const slot1 = await prisma.slotSesi.findFirst({
    where: { jadwalId: jadwal.id, nomorSesi: 1 },
  })
  if (!slot1) throw new Error('Slot sesi 1 tidak ditemukan')

  // Temukan balita demo
  const balita = await prisma.balita.findFirst({
    where: { nikBalita: '3471012345670002' },
  })
  if (!balita) throw new Error('Balita demo tidak ditemukan — jalankan seed.demo.ts dulu')

  // Buat Antrian di Sesi 1 kalau belum ada
  const existingAntrian = await prisma.antrian.findFirst({
    where: { slotId: slot1.id, balitaId: balita.id },
  })
  if (!existingAntrian) {
    // Hitung nomorUrut
    const count = await prisma.antrian.count({ where: { slotId: slot1.id } })
    const wargaId = balita.wargaId

    const antrian = await prisma.antrian.create({
      data: {
        slotId: slot1.id,
        wargaId,
        balitaId: balita.id,
        nomorUrut: count + 1,
        statusAntrian: 'menunggu',
      },
    })
    // Update terisi
    await prisma.slotSesi.update({
      where: { id: slot1.id },
      data: { terisi: { increment: 1 } },
    })
    console.log('✓ Antrian dibuat untuk', balita.namaBalita, '— nomorUrut:', antrian.nomorUrut)
  } else {
    console.log('✓ Antrian sudah ada:', existingAntrian.id, '— status:', existingAntrian.statusAntrian)
    // Reset ke menunggu (re-run smoke test — dari status apapun)
    if (existingAntrian.statusAntrian !== 'menunggu') {
      await prisma.antrian.update({
        where: { id: existingAntrian.id },
        data: { statusAntrian: 'menunggu', waktuCheckin: null, waktuMulaiLayanan: null, waktuSelesai: null },
      })
      console.log('  → Reset ke menunggu dari', existingAntrian.statusAntrian)
    }
  }

  console.log('\n✅ Seed today selesai!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Buka: http://localhost → Login kader 081234560001 / 123456')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
