import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import {
  createPemeriksaanHandler,
  getPemeriksaanHistoryHandler,
  updatePemeriksaanHandler,
} from './growth.controller'

export const growthRouter = Router()

// POST /api/growth/pemeriksaan — Simpan hasil timbang/ukur (Meja 2)
growthRouter.post(
  '/pemeriksaan',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  createPemeriksaanHandler
)

// GET /api/growth/balita/:balitaId/history — Riwayat pemeriksaan untuk grafik Z-Score (Meja 3)
growthRouter.get(
  '/balita/:balitaId/history',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  getPemeriksaanHistoryHandler
)

// PATCH /api/growth/pemeriksaan/:pemeriksaanId — Update tanda klinis, statusGiziOverride, rekomendasiAi (Meja 3 + Meja 4)
growthRouter.patch(
  '/pemeriksaan/:pemeriksaanId',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  updatePemeriksaanHandler
)
