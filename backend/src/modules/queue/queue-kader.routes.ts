/**
 * queue-kader.routes.ts — Kader antrian operations + Redis lock-screen
 *
 * Mount di /api (bukan /api/kader atau /api/antrian) sehingga path penuh:
 *   GET    /api/kader/active-meja
 *   PATCH  /api/kader/active-meja
 *   DELETE /api/kader/active-meja
 *   GET    /api/kader/slot/:slotId/antrian
 *   PATCH  /api/antrian/:id/hadir
 *   PATCH  /api/antrian/:id/tangguhkan
 *   POST   /api/kader/go-show
 */
import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import {
  getActiveMejaHandler,
  setActiveMejaHandler,
  clearActiveMejaHandler,
  getSlotAntrianHandler,
  getTodaySlotsHandler,
  hadirAntrianHandler,
  tangguhkanAntrianHandler,
  goShowAntrianHandler,
} from './queue-kader.controller'

export const queueKaderRouter = Router()

const kaderAuth = [authMiddleware, requireRole('kader', 'ketua_kader')]

// Lock-screen: Redis activeMeja state
queueKaderRouter.get('/kader/active-meja', ...kaderAuth, getActiveMejaHandler)
queueKaderRouter.patch('/kader/active-meja', ...kaderAuth, setActiveMejaHandler)
queueKaderRouter.delete('/kader/active-meja', ...kaderAuth, clearActiveMejaHandler)

// Today's jadwal + slots for kader's posyandu (kader dashboard)
queueKaderRouter.get('/kader/today-slots', ...kaderAuth, getTodaySlotsHandler)

// Slot antrian list
queueKaderRouter.get('/kader/slot/:slotId/antrian', ...kaderAuth, getSlotAntrianHandler)

// Antrian status transitions (Meja 1)
queueKaderRouter.patch('/antrian/:id/hadir', ...kaderAuth, hadirAntrianHandler)
queueKaderRouter.patch('/antrian/:id/tangguhkan', ...kaderAuth, tangguhkanAntrianHandler)

// Go-show: daftar manual oleh kader
queueKaderRouter.post('/kader/go-show', ...kaderAuth, goShowAntrianHandler)
