/**
 * kader.routes.ts — Kader self-service operations
 *
 * Mount di /api/kader sehingga path penuh:
 *   POST /api/kader/verify-ketua-pin
 *
 * T-08-07-02 Mitigation: authMiddleware + requireRole(['kader','ketua_kader'])
 *   memastikan citizen dan puskesmas JWT ditolak (403)
 */
import { Router } from 'express'
import type { Response } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { verifyKetuaPin } from './kader.service'

export const kaderRouter = Router()

/**
 * verifyKetuaPinHandler — POST /api/kader/verify-ketua-pin
 *
 * Validates the 6-digit PIN against the ketua kader of the requesting kader's posyandu.
 * Returns 200 {verified:true} on match, 403 KETUA_PIN_SALAH on mismatch.
 * PIN value is NEVER included in any log output (T-08-07-01).
 */
async function verifyKetuaPinHandler(req: AuthRequest, res: Response): Promise<void> {
  const kaderId = req.user!.userId
  const pin = req.body.pin as string

  // Validate PIN format: must be exactly 6 digits
  if (!pin || !/^\d{6}$/.test(pin)) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: 'PIN harus 6 digit angka',
    })
    return
  }

  try {
    const result = await verifyKetuaPin(kaderId, pin)

    if (!result.verified) {
      res.status(403).json({
        success: false,
        error: 'KETUA_PIN_SALAH',
        message: 'PIN Ketua Kader salah',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: { verified: true },
      message: 'PIN Ketua Kader terverifikasi.',
    })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    const code = e.code ?? (err instanceof Error ? err.message : undefined)

    if (code === 'KADER_TIDAK_DITEMUKAN' || code === 'KETUA_TIDAK_DITEMUKAN') {
      res.status(404).json({
        success: false,
        error: code,
        message: 'Data tidak ditemukan',
      })
      return
    }

    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}

kaderRouter.post('/verify-ketua-pin', authMiddleware, requireRole('kader', 'ketua_kader'), verifyKetuaPinHandler)
