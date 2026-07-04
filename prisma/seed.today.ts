/**
 * seed.today.ts — Buat Jadwal + 4 SlotSesi + Antrian untuk hari ini (demo)
 * Run standalone: npx ts-node --project tsconfig.json prisma/seed.today.ts
 */
import { PrismaClient, StatusJadwal } from '@prisma/client'

export async function seedToday(prisma: PrismaClient): Promise<void> {
  console.log('🌱 Seeding jadwal hari ini...')

  // Temukan posyandu demo
  const posyandu = await prisma.posyandu.findFirst({
    where: { namaPosyandu: 'Posyandu Mawar' },
  })
  if (!posyandu) throw new Error('Posyandu Mawar tidak ditemukan — jalankan seedDemo dulu')

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
        durasiRataAktual: 10,
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

  // 4 sesi: 08:00-09:00, 09:00-10:00, 10:00-11:00, 11:00-12:00 (D-22)
  const estimasiDurasiMenit = 10  // D-23
  const SESI = [
    { nomorSesi: 1, labelSesi: 'Sesi 1 (08:00 - 09:00)', jamMulaiHour: 8,  jamSelesaiHour: 9  },
    { nomorSesi: 2, labelSesi: 'Sesi 2 (09:00 - 10:00)', jamMulaiHour: 9,  jamSelesaiHour: 10 },
    { nomorSesi: 3, labelSesi: 'Sesi 3 (10:00 - 11:00)', jamMulaiHour: 10, jamSelesaiHour: 11 },
    { nomorSesi: 4, labelSesi: 'Sesi 4 (11:00 - 12:00)', jamMulaiHour: 11, jamSelesaiHour: 12 },
  ]

  const existingSlots = await prisma.slotSesi.findMany({ where: { jadwalId: jadwal.id } })
  if (existingSlots.length === 0) {
    const kuota = Math.floor(60 / estimasiDurasiMenit)  // 6
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
    console.log('✓ 4 SlotSesi dibuat')
  } else if (existingSlots.length === 3) {
    // Migration from old 3-sesi seed
    const kuota = Math.floor(60 / estimasiDurasiMenit)
    await prisma.slotSesi.create({
      data: {
        jadwalId: jadwal!.id,
        nomorSesi: 4,
        labelSesi: 'Sesi 4 (11:00 - 12:00)',
        jamMulai: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
        jamSelesai: new Date(Date.UTC(1970, 0, 1, 12, 0, 0)),
        kuota,
        terisi: 0,
      }
    })
    console.log('✓ Sesi 4 ditambahkan (migration dari 3-sesi)')
  } else {
    console.log('✓ SlotSesi sudah ada:', existingSlots.length, 'slot')
  }

  // Ambil semua 4 slot
  const slots = await prisma.slotSesi.findMany({
    where: { jadwalId: jadwal.id },
    orderBy: { nomorSesi: 'asc' },
  })
  const slot1 = slots.find(s => s.nomorSesi === 1)
  const slot2 = slots.find(s => s.nomorSesi === 2)
  const slot3 = slots.find(s => s.nomorSesi === 3)
  const slot4 = slots.find(s => s.nomorSesi === 4)
  if (!slot1 || !slot2 || !slot3 || !slot4) throw new Error('Slot sesi tidak lengkap')

  // Temukan balita Dewi (Budi Santoso, nikBalita 3471012345670002)
  const balitaDewi = await prisma.balita.findFirst({ where: { nikBalita: '3471012345670002' } })
  if (!balitaDewi) throw new Error('Balita demo (Budi Santoso) tidak ditemukan — jalankan seedDemo dulu')
  const dewi = await prisma.warga.findFirst({ where: { nikIbu: '3471012345670001' } })
  if (!dewi) throw new Error('Warga demo (Dewi) tidak ditemukan')

  // Cari warga massal dari posyandu ini untuk antrian dummy (D-27)
  const massalWarga = await prisma.warga.findMany({
    where: { posyanduUtamaId: posyandu.id, nikIbu: { not: '3471012345670001' } },
    include: { balita: { take: 1 } },
    take: 20,
  })
  // Hanya yang punya minimal 1 balita
  const massalWithBalita = massalWarga.filter(w => w.balita.length > 0)

  // Helper: buat antrian idempotent
  async function createAntrianIfAbsent(
    slotId: string, wargaId: string, balitaId: string
  ): Promise<void> {
    const existing = await prisma.antrian.findFirst({ where: { slotId, balitaId } })
    if (existing) {
      if (existing.statusAntrian !== 'menunggu') {
        await prisma.antrian.update({
          where: { id: existing.id },
          data: { statusAntrian: 'menunggu', waktuCheckin: null, waktuMulaiLayanan: null, waktuSelesai: null },
        })
      }
      return
    }
    const count = await prisma.antrian.count({ where: { slotId } })
    await prisma.antrian.create({
      data: { slotId, wargaId, balitaId, nomorUrut: count + 1, statusAntrian: 'menunggu' }
    })
    await prisma.slotSesi.update({ where: { id: slotId }, data: { terisi: { increment: 1 } } })
  }

  // Sesi 1: 2 dummy antrian sebelum Dewi, Dewi di posisi 3 (D-24)
  for (let i = 0; i < 2 && i < massalWithBalita.length; i++) {
    const w = massalWithBalita[i]
    await createAntrianIfAbsent(slot1.id, w.id, w.balita[0].id)
  }
  // Dewi di posisi 3
  await createAntrianIfAbsent(slot1.id, dewi.id, balitaDewi.id)
  console.log('✓ Sesi 1: 2 dummy + Dewi (nomorUrut 3)')

  // Sesi 2, 3, 4: isi dengan dummy antrian (D-26)
  const sesiSlots = [
    { slot: slot2, startIdx: 2 },
    { slot: slot3, startIdx: 6 },
    { slot: slot4, startIdx: 10 },
  ]
  for (const { slot, startIdx } of sesiSlots) {
    const take = Math.min(4, massalWithBalita.length - startIdx)
    for (let i = startIdx; i < startIdx + take && i < massalWithBalita.length; i++) {
      const w = massalWithBalita[i]
      await createAntrianIfAbsent(slot.id, w.id, w.balita[0].id)
    }
    console.log('✓', slot.labelSesi, 'diisi antrian dummy')
  }

  console.log('\n✅ Seed today selesai!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Login kader: 081234560001 / 123456')
  console.log('Posyandu Mawar — 4 sesi, antrian siap demo')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// Standalone execution (backward compatibility)
if (require.main === module) {
  const standaloneClient = new PrismaClient()
  seedToday(standaloneClient)
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(async () => { await standaloneClient.$disconnect() })
}
