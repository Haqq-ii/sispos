import type { Response } from 'express'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { getAuditLog } from './audit.service'

// ── getAuditLogHandler ────────────────────────────────────────────────────────
// T-04-02-05: puskesmasId dari JWT (req.user!.userId), BUKAN dari query params
// T-04-02-06: scope by kaderIds dihitung server-side di service layer

export async function getAuditLogHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const puskesmasId = req.user!.userId

    const page = parseInt(req.query.page as string ?? '1', 10) || 1
    const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10) || 20, 100)

    const result = await getAuditLog(puskesmasId, page, limit)

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal memuat audit log.',
    })
  }
}
