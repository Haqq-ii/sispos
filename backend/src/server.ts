import http from 'http'
import app, { logger } from './app'
import { connectDB } from './config/db'
import { initSocket } from './config/socket'
import { env } from './config/env'
import './modules/notification/notification.worker'

const httpServer = http.createServer(app)

// Guard: unhandled rejections dari library eksternal (Google STT, OpenAI) tidak boleh crash proses
process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, 'Unhandled promise rejection — dicatat, proses tetap berjalan')
})

process.on('uncaughtException', (err: Error) => {
  logger.error({ err }, 'Uncaught exception — dicatat, proses tetap berjalan')
})

// Inisialisasi Socket.IO + Redis adapter sebelum listen
initSocket(httpServer)

async function main(): Promise<void> {
  // Pastikan database terhubung sebelum menerima request
  await connectDB()

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      'SISPOS backend started'
    )
  })
}

main().catch((err: unknown) => {
  logger.error(err, 'Fatal startup error')
  process.exit(1)
})
