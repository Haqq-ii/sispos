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
  selesaikanAntrianHandler,
  goShowAntrianHandler,
  getAntrianDetailHandler,
  getKaderDashboardStatsHandler,
  searchBalitaHandler,
} from './queue-kader.controller'

export const queueKaderRouter = Router()

const kaderAuth = [authMiddleware, requireRole('kader', 'ketua_kader')]

// Lock-screen: Redis activeMeja state
queueKaderRouter.get('/kader/active-meja', ...kaderAuth, getActiveMejaHandler)
queueKaderRouter.patch('/kader/active-meja', ...kaderAuth, setActiveMejaHandler)
queueKaderRouter.delete('/kader/active-meja', ...kaderAuth, clearActiveMejaHandler)

// Today's jadwal + slots for kader's posyandu (kader dashboard)
queueKaderRouter.get('/kader/today-slots', ...kaderAuth, getTodaySlotsHandler)

// Dashboard stats: total balita, risiko stunting, hadir hari ini, tren gizi, distribusi
// T-08-06-01: kaderId dari JWT; T-08-06-04: kaderAuth middleware (kader + ketua_kader only)
queueKaderRouter.get('/kader/dashboard-stats', ...kaderAuth, getKaderDashboardStatsHandler)

// Slot antrian list
queueKaderRouter.get('/kader/slot/:slotId/antrian', ...kaderAuth, getSlotAntrianHandler)

// Antrian status transitions (Meja 1 + Meja 5)
queueKaderRouter.patch('/antrian/:id/hadir', ...kaderAuth, hadirAntrianHandler)
queueKaderRouter.patch('/antrian/:id/tangguhkan', ...kaderAuth, tangguhkanAntrianHandler)
// Meja 5: selesaikan antrian → update statusAntrian='selesai' + CMA durasiRataAktual + broadcast
queueKaderRouter.patch('/antrian/:id/selesai', ...kaderAuth, selesaikanAntrianHandler)

// Go-show: daftar manual oleh kader
queueKaderRouter.post('/kader/go-show', ...kaderAuth, goShowAntrianHandler)

// Search balita by nama/NIK/nama warga/HP — untuk form go-show Meja 1
queueKaderRouter.get('/kader/search-balita', ...kaderAuth, searchBalitaHandler)

// Antrian detail (Meja 2: balita info) — WAJIB setelah /antrian/:id/hadir & /tangguhkan
// agar Express tidak matching 'hadir' atau 'tangguhkan' sebagai ':id'
queueKaderRouter.get('/kader/antrian/:id', ...kaderAuth, getAntrianDetailHandler)
