import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { RolePengguna } from '@prisma/client'
import { env } from '../../config/env'

// ── AuthRequest: extends Express Request with verified user payload ──
export interface AuthRequest extends Request {
  user?: {
    userId: string
    role: RolePengguna
  }
}

// ── authMiddleware ────────────────────────────────────────────────
// CLAUDE.md: Setiap endpoint dilindungi authMiddleware kecuali /api/auth/*
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token as string | undefined

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHENTICATED',
      message: 'Sesi tidak ditemukan. Silakan login kembali.',
    })
    return
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: RolePengguna }
    req.user = { userId: decoded.userId, role: decoded.role }
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Sesi telah kedaluwarsa. Silakan login kembali.',
      })
      return
    }
    res.status(401).json({
      success: false,
      error: 'TOKEN_INVALID',
      message: 'Token autentikasi tidak valid.',
    })
  }
}
