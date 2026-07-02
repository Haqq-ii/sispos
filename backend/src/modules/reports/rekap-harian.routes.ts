/**
 * rekap-harian.routes.ts — Rekap Harian export routes
 *
 * Mounted at /api/reports in app.ts.
 * Full paths:
 *   GET /api/reports/rekap-harian?slotId=<uuid>&format=xlsx → download .xlsx
 *   GET /api/reports/rekap-harian?slotId=<uuid>&format=pdf  → download .pdf
 *
 * Auth: authMiddleware + requireRole('kader', 'ketua_kader')
 * IDOR: slotSesi must belong to kader's posyanduId (enforced in service)
 *
 * Download via window.open (same-origin request — JWT httpOnly cookie sent automatically)
 */
import { Router } from 'express'
import type { Response } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { generateRekapHarianXlsx, generateRekapHarianPdf } from './rekap-harian.service'

export const rekapHarianRouter = Router()

const kaderAuth = [authMiddleware, requireRole('kader', 'ketua_kader')]

/**
 * GET /rekap-harian
 * Query params:
 *   slotId (required): UUID of the SlotSesi
 *   format (required): 'xlsx' | 'pdf'
 */
async function rekapHarianHandler(req: AuthRequest, res: Response): Promise<void> {
  const { slotId, format } = req.query as { slotId?: string; format?: string }

  // Validate required params
  if (!slotId) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: 'Parameter slotId wajib diisi.',
    })
    return
  }

  if (!format || !['xlsx', 'pdf'].includes(format)) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: "Parameter format harus 'xlsx' atau 'pdf'.",
    })
    return
  }

  const kaderId = req.user!.userId

  try {
    if (format === 'xlsx') {
      const buffer = await generateRekapHarianXlsx(slotId, kaderId)
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader('Content-Disposition', 'attachment; filename="rekap-harian.xlsx"')
      res.send(buffer)
    } else {
      const buffer = await generateRekapHarianPdf(slotId, kaderId)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="rekap-harian.pdf"')
      res.send(buffer)
    }
  } catch (err) {
    const e = err as { code?: string }
    const errorMap: Record<string, number> = {
      KADER_TIDAK_DITEMUKAN: 404,
      SLOT_TIDAK_DITEMUKAN: 404,
      FORBIDDEN_POSYANDU: 403,
    }
    const status = errorMap[e.code ?? ''] ?? 500
    res.status(status).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: 'Gagal generate rekap harian. Coba lagi.',
    })
  }
}

rekapHarianRouter.get('/rekap-harian', ...kaderAuth, rekapHarianHandler)
