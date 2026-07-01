/**
 * requireRole — Middleware factory untuk role-based access control
 *
 * ASVS V4: Akses ke endpoint jadwal/antrian dibatasi per role.
 * Selalu gunakan setelah authMiddleware karena membutuhkan req.user.
 *
 * Penggunaan:
 *   router.post('/jadwal', authMiddleware, requireRole('puskesmas'), handler)
 *   router.post('/antrian/ambil', authMiddleware, requireRole('citizen'), handler)
 *
 * T-02-02 Mitigation:
 *   - Cek !req.user (unauthenticated) DAN !roles.includes(req.user.role) (wrong role)
 *   - Return 403 FORBIDDEN (bukan 401) — membedakan authz dari authn
 */
import type { Response, NextFunction, RequestHandler } from 'express'
import type { RolePengguna } from '@prisma/client'
import type { AuthRequest } from './auth.middleware'

export function requireRole(...roles: RolePengguna[]): RequestHandler {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Anda tidak memiliki akses ke endpoint ini.',
      })
      return
    }
    next()
  }
}
