import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import {
  getKaderListHandler,
  unlockKaderHandler,
  resetKaderPinHandler,
  getProfilCitizenHandler,
} from './users.controller'

export const usersRouter = Router()

// T-04-02-04: GET /api/users/kader — daftar kader scoped ke puskesmasId dari JWT
usersRouter.get('/kader', authMiddleware, requireRole('puskesmas'), getKaderListHandler)

// T-04-02-03: PATCH /api/users/kader/:id/unlock — master overrule + AuditLog MASTER_OVERRULE
usersRouter.patch('/kader/:id/unlock', authMiddleware, requireRole('puskesmas'), unlockKaderHandler)

// PATCH /api/users/kader/:id/reset-pin — reset PIN kader + AuditLog PIN_RESET
usersRouter.patch('/kader/:id/reset-pin', authMiddleware, requireRole('puskesmas'), resetKaderPinHandler)

// GET /api/users/profil — profil warga (citizen) dari JWT
usersRouter.get('/profil', authMiddleware, requireRole('citizen'), getProfilCitizenHandler)
