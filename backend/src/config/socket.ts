import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { createRedisAdapter } from './redis'
import { env } from './env'
import pino from 'pino'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// io tidak diinisialisasi saat modul diload — hanya tersedia setelah initSocket() dipanggil
export let io: Server | undefined

export function initSocket(httpServer: HttpServer): Server {
  const server = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    path: '/socket.io',
  })

  // Attach Redis adapter untuk horizontal scaling
  server.adapter(createRedisAdapter())

  server.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket.IO client terhubung')

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket.IO client terputus')
    })
  })

  // Set module-level io variable agar bisa diakses dari modul lain
  io = server

  logger.info('Socket.IO server siap')
  return server
}
