import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import { getStuntingMapHandler, getDashboardStatsHandler } from './dashboard.controller'

export const dashboardRouter = Router()

// T-04-01-02: authMiddleware + requireRole('puskesmas') — IDOR guard
// GET /api/dashboard/stunting?bulan=YYYY-MM
dashboardRouter.get('/stunting', authMiddleware, requireRole('puskesmas'), getStuntingMapHandler)

// GET /api/dashboard/stats?bulan=YYYY-MM
dashboardRouter.get('/stats', authMiddleware, requireRole('puskesmas'), getDashboardStatsHandler)
