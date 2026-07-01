/**
 * antrian.routes.ts — Router untuk /api/antrian
 *
 * Semua route dilindungi authMiddleware + requireRole('citizen').
 * T-02-13 Mitigation: requireRole('citizen') — puskesmas/kader mendapat 403 FORBIDDEN.
 *
 * PENTING: GET '/saya' harus didaftarkan SEBELUM GET '/:id' untuk menghindari
 * route conflict (Express akan mencocokkan '/:id' dengan 'saya' jika urutan terbalik).
 */
import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import {
  ambilAntrianHandler,
  batalkanAntrianHandler,
  getAntrianSayaHandler,
  getAntrianByIdHandler,
} from './antrian.controller'

export const antrianRouter = Router()

// POST /api/antrian/ambil — citizen mengambil slot antrian (SELECT FOR UPDATE)
antrianRouter.post('/ambil', authMiddleware, requireRole('citizen'), ambilAntrianHandler)

// PATCH /api/antrian/:id/batalkan — citizen membatalkan antrian miliknya
antrianRouter.patch('/:id/batalkan', authMiddleware, requireRole('citizen'), batalkanAntrianHandler)

// GET /api/antrian/saya — antrian aktif citizen hari ini
// WAJIB didaftarkan SEBELUM '/:id' untuk menghindari Express route conflict
antrianRouter.get('/saya', authMiddleware, requireRole('citizen'), getAntrianSayaHandler)

// GET /api/antrian/:id — detail antrian (tiket screen, ownership enforced)
antrianRouter.get('/:id', authMiddleware, requireRole('citizen'), getAntrianByIdHandler)
