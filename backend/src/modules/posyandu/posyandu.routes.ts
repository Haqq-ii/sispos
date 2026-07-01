import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import { getPosyanduListHandler } from './posyandu.controller'

export const posyanduRouter = Router()

// GET /api/posyandu — hanya puskesmas (D-08)
posyanduRouter.get(
  '/',
  authMiddleware,
  requireRole('puskesmas'),
  getPosyanduListHandler
)
