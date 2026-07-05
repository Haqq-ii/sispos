import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import { getImunisasiByBalitaHandler, createImunisasiHandler, getCitizenImunisasiHandler } from './immunization.controller'

export const immunizationRouter = Router()

// GET /api/immunization/riwayat — Riwayat imunisasi untuk citizen (TumbuhKembangPage)
// IDOR-safe: wargaId dari JWT, bukan dari request params
immunizationRouter.get(
  '/riwayat',
  authMiddleware,
  requireRole('citizen'),
  getCitizenImunisasiHandler
)

// GET /api/immunization/balita/:balitaId — Riwayat imunisasi untuk Meja 3
immunizationRouter.get(
  '/balita/:balitaId',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  getImunisasiByBalitaHandler
)

// POST /api/immunization — Catat imunisasi baru (Meja 4)
immunizationRouter.post(
  '/',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  createImunisasiHandler
)
