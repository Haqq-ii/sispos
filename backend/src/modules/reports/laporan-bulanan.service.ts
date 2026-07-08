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

// ── PemRow type (flat, direct query — no antrian chain) ───────────────────
type PemRow = {
  posyanduId: string
  namaPosyandu: string
  kelurahan: string
  pem: {
    beratBadan: number | null
    tinggiBadan: number | null
    lingkarLengan: number | null
    zScoreBbU: number | null
    zScoreTbU: number | null
    zScoreBbTb: number | null
    statusGizi: string | null
    statusGiziOverride: string | null
    tanggalPemeriksaan: Date
    balita: {
      namaBalita: string
      nikBalita: string | null
      tanggalLahir: Date
      jenisKelamin: string
      warga: { namaLengkap: string } | null
    }
  }
}

// ── getPemeriksaanData — direct query (mirrors dashboard.service.ts approach) ─
// Fixes root cause of empty export: seed massal creates pemeriksaan with antrianId=null,
// so traversing jadwal→slotSesi→antrian chain always returns 0 rows for historical data.
async function getPemeriksaanData(
  puskesmasId: string,
  startOfMonth: Date,
  startOfNextMonth: Date
): Promise<PemRow[]> {
  const posyanduRows = await prisma.posyandu.findMany({
    where: { puskesmasId },
    select: { id: true, namaPosyandu: true, kelurahan: true },
  })
  if (posyanduRows.length === 0) return []

  const posyanduMap = new Map(posyanduRows.map(p => [p.id, p]))
  const posyanduIds = posyanduRows.map(p => p.id)

  const pemeriksaanList = await prisma.pemeriksaan.findMany({
    where: {
      tanggalPemeriksaan: { gte: startOfMonth, lt: startOfNextMonth },
      balita: { warga: { posyanduUtamaId: { in: posyanduIds } } },
    },
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
      // T-05-04: encrypted PDP fields deliberately excluded (UU PDP No. 27/2022)
      balita: {
        select: {
          namaBalita: true,
          nikBalita: true,
          tanggalLahir: true,
          jenisKelamin: true,
          warga: { select: { namaLengkap: true, posyanduUtamaId: true } },
        },
      },
    },
    orderBy: { tanggalPemeriksaan: 'asc' },
  })

  return pemeriksaanList
    .filter(p => p.balita.warga?.posyanduUtamaId != null)
    .map(p => {
      const posyanduId = p.balita.warga!.posyanduUtamaId!
      return {
        posyanduId,
        namaPosyandu: posyanduMap.get(posyanduId)?.namaPosyandu ?? '',
        kelurahan: posyanduMap.get(posyanduId)?.kelurahan ?? '',
        pem: p,
      }
    })
}

// ── Types for preview endpoint ────────────────────────────────────────────
export type PreviewRow = {
  namaBalita: string
  nikBalita: string | null
  namaOrangTua: string
  tanggalLahir: string
  jenisKelamin: string
  usiaBulan: number
  beratBadan: number | null
  tinggiBadan: number | null
  zScoreBbU: number | null
  zScoreTbU: number | null
  zScoreBbTb: number | null
  statusGizi: string
  namaPosyandu: string
  tanggalPemeriksaan: string
}

export type PreviewStats = {
  totalPemeriksaan: number
  buruk: number; kurang: number; normal: number
  lebih: number; obesitas: number
  pendek: number; sangatPendek: number
  posyanduList: { id: string; nama: string }[]
}

export type PreviewBulananResult = {
  rows: PreviewRow[]
  stats: PreviewStats
  meta: { total: number; page: number; limit: number }
}

// ── getPreviewBulanan ─────────────────────────────────────────────────────
export async function getPreviewBulanan(
  puskesmasId: string,
  bulan: string,
  posyanduIdFilter: string | undefined,
  page: number,
  limit: number,
  statusGiziFilter?: string,
  jenisKelaminFilter?: string,
): Promise<PreviewBulananResult> {
  const { startOfMonth, startOfNextMonth } = parseBulan(bulan)

  const allPosyandu = await prisma.posyandu.findMany({
    where: { puskesmasId },
    select: { id: true, namaPosyandu: true },
    orderBy: { namaPosyandu: 'asc' },
  })
  if (allPosyandu.length === 0) {
    const empty: PreviewStats = { totalPemeriksaan: 0, buruk: 0, kurang: 0, normal: 0, lebih: 0, obesitas: 0, pendek: 0, sangatPendek: 0, posyanduList: [] }
    return { rows: [], stats: empty, meta: { total: 0, page, limit } }
  }

  const posyanduMap = new Map(allPosyandu.map(p => [p.id, p.namaPosyandu]))
  const filteredIds = posyanduIdFilter
    ? allPosyandu.filter(p => p.id === posyanduIdFilter).map(p => p.id)
    : allPosyandu.map(p => p.id)

  // statsWhere: bulan + posyandu only (stats card always shows full-month picture)
  const statsWhere = {
    tanggalPemeriksaan: { gte: startOfMonth, lt: startOfNextMonth },
    balita: { warga: { posyanduUtamaId: { in: filteredIds } } },
  }

  // Expand group filter values to individual status values
  const STATUS_GROUP_MAP: Record<string, string[]> = {
    kurang_group: ['kurang', 'buruk', 'pendek', 'sangat_pendek'],
    lebih_group:  ['lebih', 'obesitas'],
  }
  const isGroupFilter = statusGiziFilter && statusGiziFilter in STATUS_GROUP_MAP
  const statusGiziCondition = statusGiziFilter
    ? isGroupFilter
      ? { statusGizi: { in: STATUS_GROUP_MAP[statusGiziFilter] as never } }
      : { statusGizi: statusGiziFilter as never }
    : {}

  // rowWhere: adds optional statusGizi + jenisKelamin filters for the table
  const rowWhere = {
    tanggalPemeriksaan: { gte: startOfMonth, lt: startOfNextMonth },
    ...statusGiziCondition,
    balita: {
      ...(jenisKelaminFilter ? { jenisKelamin: jenisKelaminFilter as never } : {}),
      warga: { posyanduUtamaId: { in: filteredIds } },
    },
  }

  const [total, statusGroups] = await Promise.all([
    prisma.pemeriksaan.count({ where: rowWhere }),
    prisma.pemeriksaan.groupBy({
      by: ['statusGizi'],
      where: statsWhere,
      _count: { id: true },
    }),
  ])

  const sm: Record<string, number> = {}
  for (const g of statusGroups) sm[g.statusGizi ?? ''] = (sm[g.statusGizi ?? ''] ?? 0) + g._count.id

  // Sort by severity (worst first) when a group filter is active, else by date desc
  const orderBy: object[] = isGroupFilter
    ? [{ statusGizi: 'desc' as const }, { tanggalPemeriksaan: 'desc' as const }]
    : [{ tanggalPemeriksaan: 'desc' as const }]

  const rows: PreviewRow[] = (await prisma.pemeriksaan.findMany({
    where: rowWhere,
    skip: (page - 1) * limit,
    take: limit,
    orderBy,
    select: {
      beratBadan: true, tinggiBadan: true,
      zScoreBbU: true, zScoreTbU: true, zScoreBbTb: true,
      statusGizi: true, statusGiziOverride: true, tanggalPemeriksaan: true,
      balita: {
        select: {
          namaBalita: true, nikBalita: true, tanggalLahir: true, jenisKelamin: true,
          warga: { select: { namaLengkap: true, posyanduUtamaId: true } },
        },
      },
    },
  }))
    .filter(p => p.balita.warga?.posyanduUtamaId != null)
    .map(p => {
      const usiaBulan = ageInMonths(new Date(p.balita.tanggalLahir), new Date(p.tanggalPemeriksaan))
      const statusEfektif = p.statusGiziOverride ?? p.statusGizi ?? ''
      const posId = p.balita.warga!.posyanduUtamaId!
      return {
        namaBalita: p.balita.namaBalita,
        nikBalita: p.balita.nikBalita ?? null,
        namaOrangTua: p.balita.warga?.namaLengkap ?? '',
        tanggalLahir: formatTanggal(new Date(p.balita.tanggalLahir)),
        jenisKelamin: p.balita.jenisKelamin === 'laki_laki' ? 'L' : 'P',
        usiaBulan,
        beratBadan: p.beratBadan,
        tinggiBadan: p.tinggiBadan,
        zScoreBbU: p.zScoreBbU !== null ? Math.round(p.zScoreBbU * 100) / 100 : null,
        zScoreTbU: p.zScoreTbU !== null ? Math.round(p.zScoreTbU * 100) / 100 : null,
        zScoreBbTb: p.zScoreBbTb !== null ? Math.round(p.zScoreBbTb * 100) / 100 : null,
        statusGizi: statusEfektif,
        namaPosyandu: posyanduMap.get(posId) ?? '',
        tanggalPemeriksaan: formatTanggal(new Date(p.tanggalPemeriksaan)),
      }
    })

  return {
    rows,
    stats: {
      totalPemeriksaan: total,
      buruk: sm['buruk'] ?? 0,
      kurang: sm['kurang'] ?? 0,
      normal: sm['normal'] ?? 0,
      lebih: sm['lebih'] ?? 0,
      obesitas: sm['obesitas'] ?? 0,
      pendek: sm['pendek'] ?? 0,
      sangatPendek: sm['sangat_pendek'] ?? 0,
      posyanduList: allPosyandu.map(p => ({ id: p.id, nama: p.namaPosyandu })),
    },
    meta: { total, page, limit },
  }
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

  // 3. Direct query — bypasses antrian chain (handles seed data with antrianId=null)
  const flatRows = await getPemeriksaanData(puskesmasId, startOfMonth, startOfNextMonth)

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

  // Group flatRows by posyanduId for rekap
  const rekapMap = new Map<string, {
    namaPosyandu: string; diperiksa: number; buruk: number; kurang: number
    normal: number; lebihObesi: number; sangatPendek: number; pendek: number
  }>()
  for (const row of flatRows) {
    if (!rekapMap.has(row.posyanduId)) {
      rekapMap.set(row.posyanduId, {
        namaPosyandu: row.namaPosyandu, diperiksa: 0, buruk: 0, kurang: 0,
        normal: 0, lebihObesi: 0, sangatPendek: 0, pendek: 0,
      })
    }
    const r = rekapMap.get(row.posyanduId)!
    r.diperiksa++
    const status = row.pem.statusGiziOverride ?? row.pem.statusGizi ?? ''
    if (status === 'buruk') r.buruk++
    else if (status === 'kurang') r.kurang++
    else if (status === 'normal') r.normal++
    else if (status === 'lebih' || status === 'obesitas') r.lebihObesi++
    else if (status === 'sangat_pendek') r.sangatPendek++
    else if (status === 'pendek') r.pendek++
  }

  let rekapNo = 1
  for (const r of rekapMap.values()) {
    sheet2.addRow({
      no: rekapNo++,
      namaPosyandu: safeCell(r.namaPosyandu),
      diperiksa: r.diperiksa,
      buruk: r.buruk,
      kurang: r.kurang,
      normal: r.normal,
      lebihObesi: r.lebihObesi,
      sangatPendek: r.sangatPendek,
      pendek: r.pendek,
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
 * Layout: A4 landscape, margin 30pt, font 7pt.
 * Content: individual child rows (1 row per pemeriksaan) with pagination.
 * Columns: No, Nama Anak, Tgl Lahir, JK, Umur(bln), BB, TB, LILA,
 *          Z BB/U, Z TB/U, Z BB/TB, Status Gizi, Posyandu, Tgl Periksa
 *
 * @param puskesmasId  From req.user!.userId (JWT) — never from client. (T-05-01)
 * @param bulan        YYYY-MM format string.
 */
export async function generateLaporanBulananPdf(puskesmasId: string, bulan: string): Promise<Buffer> {
  const puskesmas = await prisma.puskesmas.findUnique({
    where: { id: puskesmasId },
    select: { namaPuskesmas: true },
  })
  if (!puskesmas) {
    throw Object.assign(new Error('Puskesmas tidak ditemukan'), { code: 'PUSKESMAS_TIDAK_DITEMUKAN' })
  }
  const { namaPuskesmas } = puskesmas

  const { startOfMonth, startOfNextMonth } = parseBulan(bulan)
  const flatRows = await getPemeriksaanData(puskesmasId, startOfMonth, startOfNextMonth)

  // A4 landscape: 841.89 x 595.28pt, margin 30pt → usable width ~781pt
  const MARGIN = 30
  const PAGE_BOTTOM = 595.28 - MARGIN - 16 // reserve 16pt for footer
  const ROW_H = 11 // row height in pt

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // Column x positions (left edge) and widths — total ~781pt
  // No(22) Nama Anak(105) Tgl Lahir(52) JK(18) Umur(28) BB(28) TB(28) LILA(28) ZBB/U(36) ZTB/U(36) ZBB/TB(38) Status(62) Posyandu(90) Tgl Periksa(52)
  const C = {
    no:      { x: MARGIN,       w: 22  },
    nama:    { x: MARGIN + 22,  w: 105 },
    tglLahir:{ x: MARGIN + 127, w: 52  },
    jk:      { x: MARGIN + 179, w: 18  },
    umur:    { x: MARGIN + 197, w: 28  },
    bb:      { x: MARGIN + 225, w: 28  },
    tb:      { x: MARGIN + 253, w: 28  },
    lila:    { x: MARGIN + 281, w: 28  },
    zBbU:    { x: MARGIN + 309, w: 36  },
    zTbU:    { x: MARGIN + 345, w: 36  },
    zBbTb:   { x: MARGIN + 381, w: 38  },
    status:  { x: MARGIN + 419, w: 62  },
    posyandu:{ x: MARGIN + 481, w: 90  },
    tglPeriksa:{ x: MARGIN + 571, w: 52 },
  }
  const TABLE_RIGHT = MARGIN + 623

  const drawPageHeader = () => {
    // Document title block
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000')
      .text('Laporan Data Pemantauan Gizi Balita (e-PPGBM)', MARGIN, MARGIN, { align: 'center', width: TABLE_RIGHT - MARGIN })
    doc.fontSize(8).font('Helvetica')
      .text(`Puskesmas: ${namaPuskesmas}   |   Periode: ${formatTanggalBulan(bulan)}`, MARGIN, MARGIN + 17, { align: 'center', width: TABLE_RIGHT - MARGIN })

    const hY = MARGIN + 33
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
    const headers: [keyof typeof C, string][] = [
      ['no', 'No'], ['nama', 'Nama Anak'], ['tglLahir', 'Tgl Lahir'],
      ['jk', 'JK'], ['umur', 'Umur\n(bln)'], ['bb', 'BB\n(kg)'],
      ['tb', 'TB\n(cm)'], ['lila', 'LILA\n(cm)'], ['zBbU', 'Z\nBB/U'],
      ['zTbU', 'Z\nTB/U'], ['zBbTb', 'Z\nBB/TB'], ['status', 'Status\nGizi'],
      ['posyandu', 'Posyandu'], ['tglPeriksa', 'Tgl\nPeriksa'],
    ]
    for (const [key, label] of headers) {
      doc.text(label, C[key].x, hY, { width: C[key].w, lineBreak: true, align: 'center' })
    }
    // Header underline
    const lineY = hY + 16
    doc.moveTo(MARGIN, lineY).lineTo(TABLE_RIGHT, lineY).strokeColor('#333333').lineWidth(0.8).stroke()
    // Return Y position for first data row
    return lineY + 3
  }

  let currentY = drawPageHeader()
  doc.fontSize(7).font('Helvetica').fillColor('#000000')

  if (flatRows.length === 0) {
    doc.fontSize(9).text('Tidak ada data pemeriksaan untuk periode ini.', MARGIN, currentY + 10, { align: 'center', width: TABLE_RIGHT - MARGIN })
  } else {
    let rowNo = 1
    for (const row of flatRows) {
      // Pagination: add new page + redraw header when near bottom
      if (currentY + ROW_H > PAGE_BOTTOM) {
        doc.addPage()
        currentY = drawPageHeader()
        doc.fontSize(7).font('Helvetica').fillColor('#000000')
      }

      const { pem } = row
      const usiaB = ageInMonths(new Date(pem.balita.tanggalLahir), new Date(pem.tanggalPemeriksaan))
      const jk = pem.balita.jenisKelamin === 'laki_laki' ? 'L' : 'P'
      const statusEfektif = (pem.statusGiziOverride ?? pem.statusGizi ?? '').replace('_', ' ')
      const fz = (v: number | null) => v !== null ? Number(v.toFixed(1)).toString() : '-'
      const fn = (v: number | null) => v !== null ? v.toString() : '-'
      const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s

      const cells: [keyof typeof C, string][] = [
        ['no',         String(rowNo++)],
        ['nama',       trunc(pem.balita.namaBalita, 20)],
        ['tglLahir',   formatTanggal(new Date(pem.balita.tanggalLahir))],
        ['jk',         jk],
        ['umur',       String(usiaB)],
        ['bb',         fn(pem.beratBadan)],
        ['tb',         fn(pem.tinggiBadan)],
        ['lila',       fn(pem.lingkarLengan)],
        ['zBbU',       fz(pem.zScoreBbU)],
        ['zTbU',       fz(pem.zScoreTbU)],
        ['zBbTb',      fz(pem.zScoreBbTb)],
        ['status',     trunc(statusEfektif, 12)],
        ['posyandu',   trunc(row.namaPosyandu, 18)],
        ['tglPeriksa', formatTanggal(new Date(pem.tanggalPemeriksaan))],
      ]

      for (const [key, val] of cells) {
        doc.text(val, C[key].x, currentY, { width: C[key].w, lineBreak: false, align: 'left' })
      }

      // Alternating row background (draw before text — too late here, so use light divider instead)
      currentY += ROW_H
      doc.moveTo(MARGIN, currentY - 1).lineTo(TABLE_RIGHT, currentY - 1).strokeColor('#eeeeee').lineWidth(0.3).stroke()
    }

    // Total row
    currentY += 2
    doc.fontSize(7).font('Helvetica-Bold')
      .text(`Total: ${flatRows.length} pemeriksaan`, MARGIN, currentY)
  }

  // Footer on last page
  doc.fontSize(7).font('Helvetica').fillColor('#888888')
    .text(`Dicetak oleh SISPOS pada ${formatTanggal(new Date())}`, MARGIN, PAGE_BOTTOM + 2, { align: 'right', width: TABLE_RIGHT - MARGIN })

  doc.end()
  const buffer = await bufferPromise
  logger.debug({ puskesmasId, bulan, rows: flatRows.length }, 'Laporan bulanan PDF generated')
  return buffer
}
