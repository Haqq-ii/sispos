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

  const kader = await prisma.kader.findFirst({ where: { nomorPonsel: '081234560001' } })
  const kaderId = kader?.id

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

  // 4 sesi: 08:00-09:00, 09:00-10:00, 10:00-11:00, 11:00-12:00 (D-22)
  const estimasiDurasiMenit = 10  // D-23
  const SESI = [
    { nomorSesi: 1, labelSesi: 'Sesi 1 (08:00 - 09:00)', jamMulaiHour: 8,  jamSelesaiHour: 9  },
    { nomorSesi: 2, labelSesi: 'Sesi 2 (09:00 - 10:00)', jamMulaiHour: 9,  jamSelesaiHour: 10 },
    { nomorSesi: 3, labelSesi: 'Sesi 3 (10:00 - 11:00)', jamMulaiHour: 10, jamSelesaiHour: 11 },
    { nomorSesi: 4, labelSesi: 'Sesi 4 (11:00 - 12:00)', jamMulaiHour: 11, jamSelesaiHour: 12 },
  ]

  const existingSlots = await prisma.slotSesi.findMany({ where: { jadwalId: jadwal.id } })
  if (existingSlots.length === 4) {
    console.log('✓ SlotSesi sudah ada: 4 slot')
  } else {
    // Delete any partial slots (0, 1, 2, or 3) and recreate all 4 clean
    if (existingSlots.length > 0) {
      const oldSlotIds = existingSlots.map(s => s.id)
      await prisma.antrian.deleteMany({ where: { slotId: { in: oldSlotIds } } })
      await prisma.slotSesi.deleteMany({ where: { jadwalId: jadwal.id } })
      console.log('✓ Reset', existingSlots.length, 'slot lama')
    }
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
        durasiRataAktual: 10,
      })),
    })
    console.log('✓ 4 SlotSesi dibuat')
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

  // Helper: buat antrian idempotent — selalu reset ke menunggu agar re-seed aman
  async function createAntrianIfAbsent(
    slotId: string, wargaId: string, balitaId: string
  ): Promise<void> {
    const existing = await prisma.antrian.findFirst({ where: { slotId, balitaId } })
    if (existing) {
      if (existing.statusAntrian !== 'menunggu') {
        // Hapus pemeriksaan berlink dulu, lalu reset ke kondisi awal demo
        await prisma.pemeriksaan.deleteMany({ where: { antrianId: existing.id } })
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

  // Helper: selesaikan antrian + buat pemeriksaan berlink untuk Sesi 1-3
  async function finishAntrianWithPemeriksaan(
    antrianId: string,
    balitaId: string,
    nomorUrut: number,
    wibHour: number,
    wibMinute: number,
  ): Promise<void> {
    const existing = await prisma.pemeriksaan.findFirst({ where: { antrianId } })
    if (existing) return

    const latest = await prisma.pemeriksaan.findFirst({
      where: { balitaId },
      orderBy: { tanggalPemeriksaan: 'desc' },
    })

    const mulaiAt = new Date(todayStart.getTime() + (wibHour - 7) * 3_600_000 + wibMinute * 60_000)
    const selesaiAt = new Date(mulaiAt.getTime() + 9 * 60_000)

    await prisma.antrian.update({
      where: { id: antrianId },
      data: {
        statusAntrian: 'selesai',
        waktuCheckin: new Date(mulaiAt.getTime() - 5 * 60_000),
        waktuMulaiLayanan: mulaiAt,
        waktuSelesai: selesaiAt,
      },
    })

    const bb = Math.round(((latest?.beratBadan ?? 8.0) + 0.1 + (nomorUrut % 3) * 0.05) * 10) / 10
    const tb = Math.round(((latest?.tinggiBadan ?? 75.0) + 0.3 + (nomorUrut % 3) * 0.1) * 10) / 10

    await prisma.pemeriksaan.create({
      data: {
        antrianId,
        balitaId,
        kaderId,
        beratBadan: bb,
        tinggiBadan: tb,
        zScoreBbU: latest?.zScoreBbU ?? null,
        zScoreTbU: latest?.zScoreTbU ?? null,
        zScoreBbTb: latest?.zScoreBbTb ?? null,
        statusGizi: latest?.statusGizi ?? null,
        tanggalPemeriksaan: selesaiAt,
      },
    })
  }

  // ── Sesi 1, 2, 3: 4 dummy massal masing-masing → selesai (simulasi sesi pagi) ──
  for (let i = 0; i < 4 && i < massalWithBalita.length; i++) {
    const w = massalWithBalita[i]
    await createAntrianIfAbsent(slot1.id, w.id, w.balita[0].id)
  }
  for (let i = 4; i < 8 && i < massalWithBalita.length; i++) {
    const w = massalWithBalita[i]
    await createAntrianIfAbsent(slot2.id, w.id, w.balita[0].id)
  }
  for (let i = 8; i < 12 && i < massalWithBalita.length; i++) {
    const w = massalWithBalita[i]
    await createAntrianIfAbsent(slot3.id, w.id, w.balita[0].id)
  }

  const sesi1Antrian = await prisma.antrian.findMany({ where: { slotId: slot1.id }, orderBy: { nomorUrut: 'asc' } })
  const sesi2Antrian = await prisma.antrian.findMany({ where: { slotId: slot2.id }, orderBy: { nomorUrut: 'asc' } })
  const sesi3Antrian = await prisma.antrian.findMany({ where: { slotId: slot3.id }, orderBy: { nomorUrut: 'asc' } })

  for (const [idx, a] of sesi1Antrian.entries()) await finishAntrianWithPemeriksaan(a.id, a.balitaId, a.nomorUrut, 8,  idx * 10)
  for (const [idx, a] of sesi2Antrian.entries()) await finishAntrianWithPemeriksaan(a.id, a.balitaId, a.nomorUrut, 9,  idx * 10)
  for (const [idx, a] of sesi3Antrian.entries()) await finishAntrianWithPemeriksaan(a.id, a.balitaId, a.nomorUrut, 10, idx * 10)

  console.log(`✓ Sesi 1-3: ${sesi1Antrian.length + sesi2Antrian.length + sesi3Antrian.length} antrian selesai (rekap harian terisi)`)

  // ── Sesi 4: 2 dummy (pos 1-2) → Budi Santoso (pos 3) → 1 dummy (pos 4) — semua menunggu ──
  for (let i = 12; i < 14 && i < massalWithBalita.length; i++) {
    const w = massalWithBalita[i]
    await createAntrianIfAbsent(slot4.id, w.id, w.balita[0].id)
  }
  await createAntrianIfAbsent(slot4.id, dewi.id, balitaDewi.id)  // Budi posisi 3
  if (massalWithBalita.length > 14) {
    const w = massalWithBalita[14]
    await createAntrianIfAbsent(slot4.id, w.id, w.balita[0].id)
  }
  console.log('✓ Sesi 4: 2 dummy + Budi Santoso (pos 3) + 1 dummy — semua menunggu')

  console.log('\n✅ Seed today selesai!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Login kader: 081234560001 / 123456')
  console.log('Posyandu Mawar — Sesi 1-3 selesai, Sesi 4 menunggu (Budi pos 3)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// Standalone execution (backward compatibility)
if (require.main === module) {
  const standaloneClient = new PrismaClient()
  seedToday(standaloneClient)
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(async () => { await standaloneClient.$disconnect() })
}
