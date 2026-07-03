import type { Response } from 'express'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { getStuntingMapData, getDashboardStats } from './dashboard.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentBulanWIB(): string {
  // WIB = UTC+7; offset 7 jam agar tanggal sesuai zona waktu Indonesia
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

// ── getStuntingMapHandler ─────────────────────────────────────────────────────
// T-04-01-01: puskesmasId dari JWT (req.user!.userId), BUKAN dari query params

export async function getStuntingMapHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const bulan =
      typeof req.query.bulan === 'string' && /^\d{4}-\d{2}$/.test(req.query.bulan)
        ? req.query.bulan
        : getCurrentBulanWIB()

    const puskesmasId = req.user!.userId

    const data = await getStuntingMapData(puskesmasId, bulan)

    res.status(200).json({ success: true, data })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal memuat data peta stunting.',
    })
  }
}

// ── getDashboardStatsHandler ──────────────────────────────────────────────────
// T-04-01-03: puskesmasId dari JWT (req.user!.userId), BUKAN dari query params

export async function getDashboardStatsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const bulan =
      typeof req.query.bulan === 'string' && /^\d{4}-\d{2}$/.test(req.query.bulan)
        ? req.query.bulan
        : getCurrentBulanWIB()

    const puskesmasId = req.user!.userId

    const data = await getDashboardStats(puskesmasId, bulan)

    res.status(200).json({ success: true, data })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal memuat statistik dashboard.',
    })
  }
}
