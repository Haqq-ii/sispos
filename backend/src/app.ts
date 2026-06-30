import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import pino from 'pino'
import { env } from './config/env'
import { healthRouter } from './modules/health/health.routes'
import { authRouter } from './modules/auth/auth.routes'

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
})

const app = express()

// Logging HTTP requests — redact JWT dan cookie agar tidak bocor ke log
app.use(
  pinoHttp({
    logger,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  })
)

// CORS — hanya izinkan origin dari FRONTEND_URL dengan credentials (httpOnly cookie)
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
)

// Parse cookies (dipakai oleh JWT httpOnly cookie middleware di Phase 1)
app.use(cookieParser())

// Parse JSON body
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Routes ──────────────────────────────────────────────────
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
// TODO Phase 1+: mount module routers here
// app.use('/api/queue', queueRouter)
// dst.

// ── 404 Handler ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'Endpoint tidak ditemukan',
  })
})

export default app
