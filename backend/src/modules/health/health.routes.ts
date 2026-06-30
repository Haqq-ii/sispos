import { Router } from 'express'
import { prisma } from '../../config/db'
import { redis } from '../../config/redis'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  let dbStatus = 'disconnected'
  let redisStatus = 'disconnected'
  let socketStatus = 'not_initialized'

  // Cek koneksi PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'connected'
  } catch {
    // dbStatus tetap 'disconnected'
  }

  // Cek koneksi Redis
  try {
    const pong = await redis.ping()
    if (pong === 'PONG') redisStatus = 'connected'
  } catch {
    // redisStatus tetap 'disconnected'
  }

  // Cek status Socket.IO — dynamic import untuk menghindari circular dependency
  // socket.ts menggunakan module-level variable `io` yang di-set oleh initSocket()
  try {
    const socketModule = await import('../../config/socket')
    socketStatus = socketModule.io ? 'ready' : 'not_initialized'
  } catch {
    // socketStatus tetap 'not_initialized'
  }

  const allHealthy =
    dbStatus === 'connected' &&
    redisStatus === 'connected' &&
    socketStatus === 'ready'

  return res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: { db: dbStatus, redis: redisStatus, socket: socketStatus },
    message: allHealthy
      ? 'Semua service berjalan normal'
      : 'Beberapa service belum siap',
  })
})
