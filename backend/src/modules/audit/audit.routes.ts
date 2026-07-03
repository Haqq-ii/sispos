import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import { getAuditLogHandler } from './audit.controller'

export const auditRouter = Router()

// T-04-02-05: GET /api/audit-log?page=1&limit=20 — paginated, puskesmas only
auditRouter.get('/', authMiddleware, requireRole('puskesmas'), getAuditLogHandler)
