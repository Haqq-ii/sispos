import type { Response } from 'express'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { getKaderList, unlockKader } from './users.service'

// ── getKaderListHandler ───────────────────────────────────────────────────────
// T-04-02-04: puskesmasId dari JWT (req.user!.userId), BUKAN dari query params

export async function getKaderListHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const puskesmasId = req.user!.userId
    const result = await getKaderList(puskesmasId)
    res.status(200).json({ success: true, data: result })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal memuat daftar kader.',
    })
  }
}

// ── unlockKaderHandler ────────────────────────────────────────────────────────
// T-04-02-01: IDOR guard dilakukan di service layer (kader.posyandu.puskesmasId === JWT)
// T-04-02-03: requireRole('puskesmas') di routes — citizen/kader JWT → 403

export async function unlockKaderHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const kaderId = req.params.id
    const puskesmasId = req.user!.userId
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    }

    await unlockKader(kaderId, puskesmasId, meta)
    res.status(200).json({ success: true, message: 'Kader berhasil dibuka kuncinya.' })
  } catch (err) {
    const code = (err as { code?: string }).code

    if (code === 'KADER_TIDAK_DITEMUKAN') {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Kader tidak ditemukan.',
      })
      return
    }

    if (code === 'AKSES_DITOLAK') {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Akses ditolak.',
      })
      return
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal membuka kunci kader.',
    })
  }
}
