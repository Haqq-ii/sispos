/**
 * rekap-harian.service.ts — Rekap Harian export (ExcelJS + pdfkit)
 *
 * Generates per-session health summary for kader:
 *   - Excel (.xlsx): ExcelJS Workbook with frozen header row
 *   - PDF (.pdf):    pdfkit landscape A4 with header + simple table
 *
 * Columns: No, Nama Balita, Umur (bln), BB (kg), TB (cm),
 *          Z-Score BB/U, Z-Score TB/U, Z-Score BB/TB, Status Gizi
 *
 * Security:
 *   - IDOR guard: slotSesi.jadwal.posyanduId === kader.posyanduId (T-03-07-04)
 *   - catatanKonsultasi and rekomendasiAi NOT exported (encrypted fields, UU PDP)
 *   - Excel formula injection guard on namaBalita (T-03-07-02)
 *
 * Note: ExcelJS v4.4.0 + pdfkit ^0.15.0 already in backend/package.json
 */
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { prisma } from '../../config/db'
import { ageInMonths } from '../../shared/utils/zscore'
import pino from 'pino'

const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Excel formula injection guard (T-03-07-02) ────────────────────────────
// Prefix dangerous cell values with apostrophe to prevent formula injection.
function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? "'" + value : value
}

// ── Today helpers ─────────────────────────────────────────────────────────
function formatTanggal(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

// ── IDOR guard helper ─────────────────────────────────────────────────────
async function verifyKaderSlotAccess(kaderId: string, slotId: string): Promise<void> {
  const [kader, slot] = await Promise.all([
    prisma.kader.findUnique({ where: { id: kaderId }, select: { posyanduId: true } }),
    prisma.slotSesi.findUnique({
      where: { id: slotId },
      select: { jadwal: { select: { posyanduId: true } }, labelSesi: true },
    }),
  ])

  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }
  if (!slot) {
    throw Object.assign(new Error('Slot tidak ditemukan'), { code: 'SLOT_TIDAK_DITEMUKAN' })
  }
  if (slot.jadwal.posyanduId !== kader.posyanduId) {
    throw Object.assign(new Error('Akses ditolak — slot bukan milik posyandu Anda'), {
      code: 'FORBIDDEN_POSYANDU',
    })
  }
}

// ── Query helper ──────────────────────────────────────────────────────────
async function getPemeriksaanList(slotId: string) {
  return prisma.pemeriksaan.findMany({
    where: { antrian: { slotId } },
    include: {
      balita: { select: { namaBalita: true, tanggalLahir: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}

// ── generateRekapHarianXlsx ───────────────────────────────────────────────

/**
 * generateRekapHarianXlsx — Returns Excel buffer for the given slotId.
 *
 * Column layout: No | Nama Balita | Umur (bln) | BB (kg) | TB (cm) |
 *                Z-Score BB/U | Z-Score TB/U | Z-Score BB/TB | Status Gizi
 *
 * Header row is bold and frozen (ySplit: 1).
 * namaBalita cells are sanitized against formula injection.
 *
 * @param slotId  ID of the SlotSesi
 * @param kaderId ID of the requesting kader (for IDOR verification)
 */
export async function generateRekapHarianXlsx(slotId: string, kaderId: string): Promise<Buffer> {
  await verifyKaderSlotAccess(kaderId, slotId)

  const pemeriksaanList = await getPemeriksaanList(slotId)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SISPOS'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Rekap Harian')

  // Column definitions with widths
  sheet.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Balita', key: 'namaBalita', width: 25 },
    { header: 'Umur (bln)', key: 'usiaBulan', width: 12 },
    { header: 'BB (kg)', key: 'beratBadan', width: 10 },
    { header: 'TB (cm)', key: 'tinggiBadan', width: 10 },
    { header: 'Z-Score BB/U', key: 'zScoreBbU', width: 14 },
    { header: 'Z-Score TB/U', key: 'zScoreTbU', width: 14 },
    { header: 'Z-Score BB/TB', key: 'zScoreBbTb', width: 15 },
    { header: 'Status Gizi', key: 'statusGizi', width: 15 },
  ]

  // Bold header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F5E9' }, // light green
  }

  // Data rows — use for...of to preserve TypeScript inference from Prisma result type
  for (const [i, p] of pemeriksaanList.entries()) {
    const usiaBulan = ageInMonths(
      new Date(p.balita.tanggalLahir),
      new Date(p.tanggalPemeriksaan)
    )

    // T-03-07-02: sanitize namaBalita against formula injection
    const namaBalitaSafe = safeCell(p.balita.namaBalita)

    sheet.addRow({
      no: i + 1,
      namaBalita: namaBalitaSafe,
      usiaBulan,
      beratBadan: p.beratBadan ?? '',
      tinggiBadan: p.tinggiBadan ?? '',
      zScoreBbU: p.zScoreBbU !== null ? Number(p.zScoreBbU.toFixed(2)) : '',
      zScoreTbU: p.zScoreTbU !== null ? Number(p.zScoreTbU.toFixed(2)) : '',
      zScoreBbTb: p.zScoreBbTb !== null ? Number(p.zScoreBbTb.toFixed(2)) : '',
      statusGizi: p.statusGiziOverride ?? p.statusGizi ?? '',
    })
  }

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  const rawBuffer = await workbook.xlsx.writeBuffer()
  logger.debug({ slotId, rows: pemeriksaanList.length }, 'Rekap harian XLSX generated')
  // ExcelJS writeBuffer may return Buffer or ArrayBuffer depending on version; normalize to Buffer
  return Buffer.from(rawBuffer as ArrayBuffer)
}

// ── generateRekapHarianPdf ────────────────────────────────────────────────

/**
 * generateRekapHarianPdf — Returns PDF buffer for the given slotId.
 *
 * Layout: A4 landscape, margin 40pt.
 * Header: "Rekap Harian Posyandu" (centered) + date + slot label.
 * Table: simple text-based layout with column positions.
 *
 * Note: Uses pdfkit collect-buffer pattern (doc.on('data') + doc.on('end')).
 * pdfkit ^0.15.0 — same API for text, moveDown, fontSize.
 *
 * @param slotId  ID of the SlotSesi
 * @param kaderId ID of the requesting kader (for IDOR verification)
 */
export async function generateRekapHarianPdf(slotId: string, kaderId: string): Promise<Buffer> {
  await verifyKaderSlotAccess(kaderId, slotId)

  // Fetch slot info for header
  const slot = await prisma.slotSesi.findUnique({
    where: { id: slotId },
    select: { labelSesi: true, jamMulai: true, jadwal: { select: { tanggalPelaksanaan: true } } },
  })

  const pemeriksaanList = await getPemeriksaanList(slotId)

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    layout: 'landscape',
  })

  // Collect buffer via stream — pdfkit standard pattern
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // ── Header ──────────────────────────────────────────────────────────────
  const tanggalStr = slot?.jadwal?.tanggalPelaksanaan
    ? formatTanggal(new Date(slot.jadwal.tanggalPelaksanaan))
    : formatTanggal(new Date())
  const sesiLabel = slot?.labelSesi ?? 'Sesi'

  doc.fontSize(16).font('Helvetica-Bold').text('Rekap Harian Posyandu', { align: 'center' })
  doc.moveDown(0.4)
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`Tanggal: ${tanggalStr}   |   ${sesiLabel}`, { align: 'center' })
  doc.moveDown(0.8)

  // ── Column layout (x positions for landscape A4 width ~751pt - 80pt margins = 671pt usable) ──
  // Columns: No(20), NamaBalita(150), Umur(50), BB(55), TB(55), BBU(60), TBU(60), BBTB(60), StatusGizi(80)
  const cols = {
    no: 40,
    nama: 65,
    umur: 215,
    bb: 270,
    tb: 330,
    bbu: 390,
    tbu: 455,
    bbtb: 520,
    status: 585,
  }

  // ── Table header ─────────────────────────────────────────────────────────
  doc.fontSize(9).font('Helvetica-Bold')
  const headerY = doc.y

  doc.text('No', cols.no, headerY, { width: 20 })
  doc.text('Nama Balita', cols.nama, headerY, { width: 145 })
  doc.text('Umur', cols.umur, headerY, { width: 50 })
  doc.text('BB (kg)', cols.bb, headerY, { width: 55 })
  doc.text('TB (cm)', cols.tb, headerY, { width: 55 })
  doc.text('Z BB/U', cols.bbu, headerY, { width: 60 })
  doc.text('Z TB/U', cols.tbu, headerY, { width: 60 })
  doc.text('Z BB/TB', cols.bbtb, headerY, { width: 60 })
  doc.text('Status Gizi', cols.status, headerY, { width: 85 })

  doc.moveDown(0.4)

  // Divider line
  doc
    .moveTo(cols.no, doc.y)
    .lineTo(cols.status + 85, doc.y)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke()

  doc.moveDown(0.3)

  // ── Table rows ────────────────────────────────────────────────────────────
  doc.fontSize(8).font('Helvetica')

  if (pemeriksaanList.length === 0) {
    doc.moveDown(0.5)
    doc.fontSize(9).text('Tidak ada data pemeriksaan untuk sesi ini.', { align: 'center' })
  } else {
    // for...of preserves TypeScript inference from Prisma result type
    for (const [i, p] of pemeriksaanList.entries()) {
      const rowY = doc.y
      const usiaBulan = ageInMonths(
        new Date(p.balita.tanggalLahir),
        new Date(p.tanggalPemeriksaan)
      )

      doc.text(String(i + 1), cols.no, rowY, { width: 20 })
      // Truncate name if too long to avoid overflow
      const nama = p.balita.namaBalita.length > 22
        ? p.balita.namaBalita.substring(0, 22) + '…'
        : p.balita.namaBalita
      doc.text(nama, cols.nama, rowY, { width: 145 })
      doc.text(String(usiaBulan), cols.umur, rowY, { width: 50 })
      doc.text(p.beratBadan !== null ? p.beratBadan.toString() : '—', cols.bb, rowY, { width: 55 })
      doc.text(p.tinggiBadan !== null ? p.tinggiBadan.toString() : '—', cols.tb, rowY, { width: 55 })
      doc.text(p.zScoreBbU !== null ? p.zScoreBbU.toFixed(2) : '—', cols.bbu, rowY, { width: 60 })
      doc.text(p.zScoreTbU !== null ? p.zScoreTbU.toFixed(2) : '—', cols.tbu, rowY, { width: 60 })
      doc.text(p.zScoreBbTb !== null ? p.zScoreBbTb.toFixed(2) : '—', cols.bbtb, rowY, { width: 60 })
      doc.text(p.statusGiziOverride ?? p.statusGizi ?? '—', cols.status, rowY, { width: 85 })

      doc.moveDown(0.3)
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.moveDown(1)
  doc.fontSize(7).fillColor('#888888').text(
    `Dicetak oleh SISPOS pada ${formatTanggal(new Date())}. Data ini bersifat rahasia.`,
    { align: 'center' }
  )

  doc.end()

  const buffer = await bufferPromise
  logger.debug({ slotId, rows: pemeriksaanList.length }, 'Rekap harian PDF generated')
  return buffer
}
