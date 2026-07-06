/**
 * child.routes.ts — Routes untuk balita (child profile) endpoints.
 *
 * Semua route dilindungi authMiddleware + requireRole('citizen').
 * T-02-24 Mitigation: requireRole('citizen') mencegah kader/puskesmas akses data balita.
 */
import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import { getBalitaSayaHandler, createBalitaHandler } from './child.controller'

export const childRouter = Router()

// GET /api/balita — Daftar balita milik citizen yang sedang login
childRouter.get('/', authMiddleware, requireRole('citizen'), getBalitaSayaHandler)

// POST /api/balita — Tambah profil balita baru oleh citizen
childRouter.post('/', authMiddleware, requireRole('citizen'), createBalitaHandler)
