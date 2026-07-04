/**
 * laporan-bulanan.service.ts — Laporan Bulanan export (ExcelJS + pdfkit)
 *
 * Generates monthly health report for Puskesmas (e-PPGBM format):
 *   - Excel (.xlsx): 2 worksheets — "Data Balita" (17 cols) + "Rekap Bulanan" (9 cols)
 *   - PDF (.pdf):    pdfkit landscape A4 — summary table per posyandu
 *
 * Security:
 *   - IDOR guard: puskesmasId is a function parameter from req.user!.userId (JWT)
 *   - Encrypted PDP fields NOT selected (UU PDP No. 27/2022)
 *   - Excel formula injection guard via safeCell() on all string cells
 *
 * Pitfall fixes:
 *   - Pitfall 1: Buffer.from(rawBuffer as ArrayBuffer) — ExcelJS v4.x writeBuffer normalization
 *   - Pitfall 4: pemeriksaan: { some: {} } in antrian where clause
 *   - Pitfall 5: lt: startOfNextMonth (NOT lte endOfMonth) for UTC/WIB off-by-one
 */
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { prisma } from '../../config/db'
import { ageInMonths } from '../../shared/utils/zscore'
import pino from 'pino'

const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Excel formula injection guard (T-05-02) ───────────────────────────────
// Prefix dangerous cell values with apostrophe to prevent formula injection.
export function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? "'" + value : value
}

// ── Date helpers ──────────────────────────────────────────────────────────
function formatTanggal(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

function formatTanggalBulan(bulan: string): string {
  const [year, month] = bulan.split('-').map(Number)
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  return `${months[month - 1] ?? ''} ${year}`
}

// ── parseBulan — Pitfall 5: use lt startOfNextMonth (NOT lte endOfMonth) ──
function parseBulan(bulan: string): { startOfMonth: Date; startOfNextMonth: Date } {
  const [year, month] = bulan.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const startOfNextMonth = new Date(year, month, 1) // exclusive upper bound — avoids Pitfall 5
  return { startOfMonth, startOfNextMonth }
}

// ── Prisma aggregation query ───────────────────────────────────────────────
// Shared between xlsx and pdf generators to avoid code duplication.
async function getPosyanduData(puskesmasId: string, startOfMonth: Date, startOfNextMonth: Date) {
  // IDOR: puskesmasId always from JWT parameter, never from client
  return prisma.posyandu.findMany({
    where: { puskesmasId },
    select: {
      id: true,
      namaPosyandu: true,
      kelurahan: true,
      rw: true,
      jadwal: {
        where: {
          tanggalPelaksanaan: { gte: startOfMonth, lt: startOfNextMonth }, // Pitfall 5: lt not lte
        },
        select: {
          tanggalPelaksanaan: true,
          slotSesi: {
            select: {
              antrian: {
                where: {
                  pemeriksaan: { some: {} }, // include any antrian that has pemeriksaan (Pitfall 4)
                },
                select: {
                  pemeriksaan: {
                    select: {
                      beratBadan: true,
                      tinggiBadan: true,
                      lingkarLengan: true,
                      zScoreBbU: true,
                      zScoreTbU: true,
                      zScoreBbTb: true,
                      statusGizi: true,
                      statusGiziOverride: true,
                      tanggalPemeriksaan: true,
                      // T-05-04: encrypted PDP fields deliberately excluded from this select (UU PDP No. 27/2022)
                      balita: {
                        select: {
                          namaBalita: true,
                          nikBalita: true,
                          tanggalLahir: true,
                          jenisKelamin: true,
                          warga: { select: { namaLengkap: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}

// ── generateLaporanBulananXlsx ────────────────────────────────────────────

/**
 * generateLaporanBulananXlsx — Returns 2-sheet Excel buffer for monthly e-PPGBM report.
 *
 * Sheet 1 "Data Balita": 17 columns, individual pemeriksaan rows.
 * Sheet 2 "Rekap Bulanan": 9 columns, aggregate counts per posyandu.
 *
 * @param puskesmasId  From req.user!.userId (JWT) — never from client. (T-05-01)
 * @param bulan        YYYY-MM format string.
 */
export async function generateLaporanBulananXlsx(puskesmasId: string, bulan: string): Promise<Buffer> {
  // 1. Look up puskesmas name for headers
  const puskesmas = await prisma.puskesmas.findUnique({
    where: { id: puskesmasId },
    select: { namaPuskesmas: true },
  })
  if (!puskesmas) {
    throw Object.assign(new Error('Puskesmas tidak ditemukan'), { code: 'PUSKESMAS_TIDAK_DITEMUKAN' })
  }
  const { namaPuskesmas } = puskesmas

  // 2. Compute date range (Pitfall 5: lt startOfNextMonth)
  const { startOfMonth, startOfNextMonth } = parseBulan(bulan)

  // 3. Run nested Prisma query
  const posyanduList = await getPosyanduData(puskesmasId, startOfMonth, startOfNextMonth)

  // 4. Flatten to individual pemeriksaan rows
  type FlatRow = {
    namaPosyandu: string
    kelurahan: string
    tanggalPelaksanaan: Date
    pem: (typeof posyanduList)[0]['jadwal'][0]['slotSesi'][0]['antrian'][0]['pemeriksaan'][0]
  }

  const flatRows: FlatRow[] = []
  for (const posyandu of posyanduList) {
    for (const jadwal of posyandu.jadwal) {
      for (const sesi of jadwal.slotSesi) {
        for (const antrian of sesi.antrian) {
          for (const pem of antrian.pemeriksaan) {
            flatRows.push({
              namaPosyandu: posyandu.namaPosyandu,
              kelurahan: posyandu.kelurahan,
              tanggalPelaksanaan: jadwal.tanggalPelaksanaan,
              pem,
            })
          }
        }
      }
    }
  }

  // 5. Build ExcelJS workbook with 2 sheets
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SISPOS'
  workbook.created = new Date()

  // ── Sheet 1: "Data Balita" — 17 columns ─────────────────────────────────
  const sheet1 = workbook.addWorksheet('Data Balita')
  sheet1.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Posyandu', key: 'namaPosyandu', width: 20 },
    { header: 'Tanggal Pemeriksaan', key: 'tanggalPemeriksaan', width: 18 },
    { header: 'Nama Anak', key: 'namaBalita', width: 22 },
    { header: 'NIK Anak', key: 'nikBalita', width: 18 },
    { header: 'Nama Orang Tua', key: 'namaOrangTua', width: 22 },
    { header: 'Tanggal Lahir', key: 'tanggalLahir', width: 14 },
    { header: 'JK', key: 'jenisKelamin', width: 5 },
    { header: 'Umur (bln)', key: 'usiaBulan', width: 10 },
    { header: 'BB (kg)', key: 'beratBadan', width: 9 },
    { header: 'TB/PB (cm)', key: 'tinggiBadan', width: 10 },
    { header: 'LILA (cm)', key: 'lingkarLengan', width: 10 },
    { header: 'Z-Score BB/U', key: 'zScoreBbU', width: 13 },
    { header: 'Z-Score TB/U', key: 'zScoreTbU', width: 13 },
    { header: 'Z-Score BB/TB', key: 'zScoreBbTb', width: 14 },
    { header: 'Status Gizi BB/U', key: 'statusGizi', width: 16 },
    { header: 'Kelurahan/Wilayah', key: 'kelurahan', width: 18 },
  ]

  const h1 = sheet1.getRow(1)
  h1.font = { bold: true }
  h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
  sheet1.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  let rowNo = 1
  for (const row of flatRows) {
    const { pem } = row
    const usiaBulan = ageInMonths(
      new Date(pem.balita.tanggalLahir),
      new Date(pem.tanggalPemeriksaan)
    )
    const statusEfektif = pem.statusGiziOverride ?? pem.statusGizi ?? ''
    const jk = pem.balita.jenisKelamin === 'laki_laki' ? 'L' : 'P'

    sheet1.addRow({
      no: rowNo++,
      namaPosyandu: safeCell(row.namaPosyandu),
      tanggalPemeriksaan: formatTanggal(new Date(pem.tanggalPemeriksaan)),
      namaBalita: safeCell(pem.balita.namaBalita),
      nikBalita: pem.balita.nikBalita ? safeCell(pem.balita.nikBalita) : '',
      namaOrangTua: safeCell(pem.balita.warga?.namaLengkap ?? ''),
      tanggalLahir: formatTanggal(new Date(pem.balita.tanggalLahir)),
      jenisKelamin: jk,
      usiaBulan,
      beratBadan: pem.beratBadan ?? '',
      tinggiBadan: pem.tinggiBadan ?? '',
      lingkarLengan: pem.lingkarLengan ?? '',
      zScoreBbU: pem.zScoreBbU !== null ? Number(pem.zScoreBbU.toFixed(2)) : '',
      zScoreTbU: pem.zScoreTbU !== null ? Number(pem.zScoreTbU.toFixed(2)) : '',
      zScoreBbTb: pem.zScoreBbTb !== null ? Number(pem.zScoreBbTb.toFixed(2)) : '',
      statusGizi: statusEfektif,
      kelurahan: safeCell(row.kelurahan),
    })
  }

  // ── Sheet 2: "Rekap Bulanan" — 9 columns ────────────────────────────────
  const sheet2 = workbook.addWorksheet('Rekap Bulanan')
  sheet2.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Posyandu', key: 'namaPosyandu', width: 25 },
    { header: 'Jml Diperiksa/D', key: 'diperiksa', width: 14 },
    { header: 'Gizi Buruk', key: 'buruk', width: 12 },
    { header: 'Gizi Kurang', key: 'kurang', width: 12 },
    { header: 'Gizi Normal', key: 'normal', width: 12 },
    { header: 'Gizi Lebih/Obesitas', key: 'lebihObesi', width: 18 },
    { header: 'Sangat Pendek', key: 'sangatPendek', width: 13 },
    { header: 'Pendek', key: 'pendek', width: 10 },
  ]

  const h2 = sheet2.getRow(1)
  h2.font = { bold: true }
  h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
  sheet2.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  let rekapNo = 1
  for (const posyandu of posyanduList) {
    let diperiksa = 0, buruk = 0, kurang = 0, normal = 0
    let lebihObesi = 0, sangatPendek = 0, pendek = 0

    for (const jadwal of posyandu.jadwal) {
      for (const sesi of jadwal.slotSesi) {
        for (const antrian of sesi.antrian) {
          for (const pem of antrian.pemeriksaan) {
            diperiksa++
            const status = pem.statusGiziOverride ?? pem.statusGizi ?? ''
            if (status === 'buruk') buruk++
            else if (status === 'kurang') kurang++
            else if (status === 'normal') normal++
            else if (status === 'lebih' || status === 'obesitas') lebihObesi++
            else if (status === 'sangat_pendek') sangatPendek++
            else if (status === 'pendek') pendek++
          }
        }
      }
    }

    sheet2.addRow({
      no: rekapNo++,
      namaPosyandu: safeCell(posyandu.namaPosyandu),
      diperiksa,
      buruk,
      kurang,
      normal,
      lebihObesi,
      sangatPendek,
      pendek,
    })
  }

  // 6. Serialize — Pitfall 1: normalize ArrayBuffer → Buffer
  const rawBuffer = await workbook.xlsx.writeBuffer()
  logger.debug({ puskesmasId, bulan, rows: flatRows.length }, 'Laporan bulanan XLSX generated')
  return Buffer.from(rawBuffer as ArrayBuffer)
}

// ── generateLaporanBulananPdf ─────────────────────────────────────────────

/**
 * generateLaporanBulananPdf — Returns PDF buffer for monthly health report.
 *
 * Layout: A4 landscape, margin 40pt.
 * Content: summary table per posyandu (aggregate counts).
 *
 * @param puskesmasId  From req.user!.userId (JWT) — never from client. (T-05-01)
 * @param bulan        YYYY-MM format string.
 */
export async function generateLaporanBulananPdf(puskesmasId: string, bulan: string): Promise<Buffer> {
  // 1. Look up puskesmas name
  const puskesmas = await prisma.puskesmas.findUnique({
    where: { id: puskesmasId },
    select: { namaPuskesmas: true },
  })
  if (!puskesmas) {
    throw Object.assign(new Error('Puskesmas tidak ditemukan'), { code: 'PUSKESMAS_TIDAK_DITEMUKAN' })
  }
  const { namaPuskesmas } = puskesmas

  // 2. Compute date range (Pitfall 5: lt startOfNextMonth)
  const { startOfMonth, startOfNextMonth } = parseBulan(bulan)

  // 3. Run nested Prisma query
  const posyanduList = await getPosyanduData(puskesmasId, startOfMonth, startOfNextMonth)

  // 4. Create PDF document
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })

  // pdfkit stream collection pattern (identical to rekap-harian.service.ts)
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // ── Header ───────────────────────────────────────────────────────────────
  doc.fontSize(16).font('Helvetica-Bold').text('Laporan Gizi Balita Bulanan', { align: 'center' })
  doc.moveDown(0.4)
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`Puskesmas: ${namaPuskesmas}   Periode: ${formatTanggalBulan(bulan)}`, { align: 'center' })
  doc.moveDown(0.8)
  doc.fontSize(9).font('Helvetica')

  // ── Table layout ─────────────────────────────────────────────────────────
  // Landscape A4: usable width ~751pt - 80pt margins = 671pt
  // Columns: No(20), Posyandu(160), D(40), Buruk(55), Kurang(55), Normal(55), Lebih(65), SP(55), Pendek(55)
  const cols = {
    no: 40,
    posyandu: 65,
    d: 230,
    buruk: 275,
    kurang: 335,
    normal: 395,
    lebih: 455,
    sp: 525,
    pendek: 580,
  }

  // Table header row
  doc.fontSize(9).font('Helvetica-Bold')
  const headerY = doc.y
  doc.text('No', cols.no, headerY, { width: 20, lineBreak: false })
  doc.text('Posyandu', cols.posyandu, headerY, { width: 160, lineBreak: false })
  doc.text('D', cols.d, headerY, { width: 40, lineBreak: false })
  doc.text('Buruk', cols.buruk, headerY, { width: 55, lineBreak: false })
  doc.text('Kurang', cols.kurang, headerY, { width: 55, lineBreak: false })
  doc.text('Normal', cols.normal, headerY, { width: 55, lineBreak: false })
  doc.text('Lebih/Obes', cols.lebih, headerY, { width: 65, lineBreak: false })
  doc.text('SP', cols.sp, headerY, { width: 50, lineBreak: false })
  doc.text('Pendek', cols.pendek, headerY, { width: 55, lineBreak: false })
  doc.moveDown(0.4)

  // Divider
  doc
    .moveTo(cols.no, doc.y)
    .lineTo(cols.pendek + 55, doc.y)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke()
  doc.moveDown(0.3)

  // ── Table rows ────────────────────────────────────────────────────────────
  doc.fontSize(8).font('Helvetica')

  if (posyanduList.length === 0) {
    doc.moveDown(0.5)
    doc.fontSize(9).text('Tidak ada data posyandu untuk periode ini.', { align: 'center' })
  } else {
    let rowNo = 1
    for (const posyandu of posyanduList) {
      let diperiksa = 0, buruk = 0, kurang = 0, normal = 0
      let lebihObesi = 0, sangatPendek = 0, pendek = 0

      for (const jadwal of posyandu.jadwal) {
        for (const sesi of jadwal.slotSesi) {
          for (const antrian of sesi.antrian) {
            for (const pem of antrian.pemeriksaan) {
              diperiksa++
              const status = pem.statusGiziOverride ?? pem.statusGizi ?? ''
              if (status === 'buruk') buruk++
              else if (status === 'kurang') kurang++
              else if (status === 'normal') normal++
              else if (status === 'lebih' || status === 'obesitas') lebihObesi++
              else if (status === 'sangat_pendek') sangatPendek++
              else if (status === 'pendek') pendek++
            }
          }
        }
      }

      const rowY = doc.y
      const nama = posyandu.namaPosyandu.length > 24
        ? posyandu.namaPosyandu.substring(0, 24) + '…'
        : posyandu.namaPosyandu

      doc.text(String(rowNo++), cols.no, rowY, { width: 20, lineBreak: false })
      doc.text(nama, cols.posyandu, rowY, { width: 160, lineBreak: false })
      doc.text(String(diperiksa), cols.d, rowY, { width: 40, lineBreak: false })
      doc.text(String(buruk), cols.buruk, rowY, { width: 55, lineBreak: false })
      doc.text(String(kurang), cols.kurang, rowY, { width: 55, lineBreak: false })
      doc.text(String(normal), cols.normal, rowY, { width: 55, lineBreak: false })
      doc.text(String(lebihObesi), cols.lebih, rowY, { width: 65, lineBreak: false })
      doc.text(String(sangatPendek), cols.sp, rowY, { width: 50, lineBreak: false })
      doc.text(String(pendek), cols.pendek, rowY, { width: 55, lineBreak: false })
      doc.moveDown(0.3)
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.moveDown(0.5)
  doc
    .fontSize(8)
    .fillColor('#888888')
    .text(`Dicetak oleh SISPOS pada ${formatTanggal(new Date())}`, { align: 'right' })

  doc.end()

  const buffer = await bufferPromise
  logger.debug({ puskesmasId, bulan }, 'Laporan bulanan PDF generated')
  return buffer
}
