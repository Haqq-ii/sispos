import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import {
  createJadwalHandler,
  getJadwalListHandler,
  getJadwalTersediaHandler,
  getSesiListHandler,
} from './jadwal.controller'

export const jadwalRouter = Router()

// POST /api/jadwal — hanya puskesmas (T-02-05 mitigation)
jadwalRouter.post('/', authMiddleware, requireRole('puskesmas'), createJadwalHandler)

// GET /api/jadwal — daftar jadwal milik puskesmas (T-02-06 mitigation: WHERE puskesmasId)
jadwalRouter.get('/', authMiddleware, requireRole('puskesmas'), getJadwalListHandler)

// GET /api/jadwal/tersedia — jadwal aktif untuk citizen (D-01: filtered by posyanduUtamaId)
jadwalRouter.get('/tersedia', authMiddleware, requireRole('citizen'), getJadwalTersediaHandler)

// GET /api/jadwal/sesi?jadwalId=... — detail slot (citizen pilih sesi & puskesmas detail)
jadwalRouter.get('/sesi', authMiddleware, getSesiListHandler)
