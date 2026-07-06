/**
 * laporan-bulanan.routes.ts — Laporan Bulanan e-PPGBM export routes
 *
 * Mounted at /api/reports in app.ts.
 * Full paths:
 *   GET /api/reports/laporan-bulanan?bulan=YYYY-MM&format=xlsx → download .xlsx
 *   GET /api/reports/laporan-bulanan?bulan=YYYY-MM&format=pdf  → download .pdf
 *
 * Auth: authMiddleware + requireRole('puskesmas')
 * IDOR: puskesmasId ALWAYS from req.user!.userId (JWT) — NEVER from req.query (T-05-01)
 * Path traversal guard: format validated as strict enum ['xlsx','pdf'] (T-05-03)
 *
 * Download via window.open (same-origin request — JWT httpOnly cookie sent automatically)
 */
import { Router } from 'express'
import type { Response } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { generateLaporanBulananXlsx, generateLaporanBulananPdf, getPreviewBulanan } from './laporan-bulanan.service'

export const laporanBulananRouter = Router()

const puskesmasAuth = [authMiddleware, requireRole('puskesmas')]

/**
 * GET /laporan-bulanan
 * Query params:
 *   bulan  (required): YYYY-MM format
 *   format (required): 'xlsx' | 'pdf'
 */
async function laporanBulananHandler(req: AuthRequest, res: Response): Promise<void> {
  const { bulan, format } = req.query as { bulan?: string; format?: string }

  // Validate bulan param
  if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: "Parameter 'bulan' wajib diisi dalam format YYYY-MM.",
    })
    return
  }

  // Validate format param — T-05-03 path traversal guard
  if (!format || !['xlsx', 'pdf'].includes(format)) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: "Parameter 'format' harus 'xlsx' atau 'pdf'.",
    })
    return
  }

  // IDOR guard: puskesmasId from JWT only — T-05-01
  const puskesmasId = req.user!.userId

  try {
    if (format === 'xlsx') {
      const buffer = await generateLaporanBulananXlsx(puskesmasId, bulan)
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader('Content-Disposition', `attachment; filename="laporan-${bulan}.xlsx"`)
      res.send(buffer)
    } else {
      const buffer = await generateLaporanBulananPdf(puskesmasId, bulan)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="laporan-${bulan}.pdf"`)
      res.send(buffer)
    }
  } catch (err) {
    const e = err as { code?: string }
    const errorMap: Record<string, number> = {
      PUSKESMAS_TIDAK_DITEMUKAN: 404,
    }
    const status = errorMap[e.code ?? ''] ?? 500
    res.status(status).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: 'Gagal generate laporan. Coba lagi.',
    })
  }
}

laporanBulananRouter.get('/laporan-bulanan', ...puskesmasAuth, laporanBulananHandler)

/**
 * GET /preview-bulanan
 * Query params:
 *   bulan      (required): YYYY-MM format
 *   posyanduId (optional): filter per posyandu
 *   page       (optional, default 1)
 *   limit      (optional, default 20, max 50)
 */
async function previewBulananHandler(req: AuthRequest, res: Response): Promise<void> {
  const { bulan, posyanduId, page: pageStr, limit: limitStr } =
    req.query as Record<string, string | undefined>

  if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: "Parameter 'bulan' wajib diisi dalam format YYYY-MM.",
    })
    return
  }

  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const limit = Math.min(50, Math.max(1, parseInt(limitStr ?? '20') || 20))
  const puskesmasId = req.user!.userId

  try {
    const result = await getPreviewBulanan(puskesmasId, bulan, posyanduId, page, limit)
    res.json({ success: true, data: result.rows, stats: result.stats, meta: result.meta })
  } catch (err) {
    const e = err as { code?: string }
    res.status(500).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: 'Gagal memuat preview laporan.',
    })
  }
}

laporanBulananRouter.get('/preview-bulanan', ...puskesmasAuth, previewBulananHandler)
