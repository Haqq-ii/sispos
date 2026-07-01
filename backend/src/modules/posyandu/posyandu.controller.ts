import type { Response } from 'express'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { getPosyanduList } from './posyandu.service'

// ── GET /api/posyandu ─────────────────────────────────────────────
export async function getPosyanduListHandler(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const result = await getPosyanduList(req.user!.userId)
    res.status(200).json({ success: true, data: result })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}
