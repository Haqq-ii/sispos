import { Worker } from 'bullmq'
import pino from 'pino'
import { env } from '../../config/env'
import type { OtpJobData } from './otp.job'
import { OTP_JOB_NAME } from './otp.job'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

/**
 * Parse Redis URL ke BullMQ ConnectionOptions.
 * BullMQ@5 bundles ioredis sendiri sehingga terjadi type conflict
 * jika menggunakan IORedis instance dari top-level package.
 * Solusi: pass plain RedisOptions object (structural typing tetap valid).
 */
function parseBullMQConnection() {
  const url = new URL(env.REDIS_URL)
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  }
}

export const notificationWorker = new Worker(
  'notification',
  async (job) => {
    if (job.name === OTP_JOB_NAME) {
      const data = job.data as OtpJobData
      const { nomorPonsel, kodeOtp } = data

      const message = `Kode OTP SISPOS Anda: ${kodeOtp}. Berlaku 5 menit. Jangan bagikan ke siapapun.`

      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: env.FONNTE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target: nomorPonsel, message }),
      })

      if (!response.ok) {
        throw new Error(`Fonnte API error: HTTP ${response.status}`)
      }

      logger.info({ nomorPonsel, jobId: job.id }, 'OTP WA berhasil dikirim via Fonnte')
    }
  },
  {
    connection: parseBullMQConnection(),
  }
)

notificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'OTP WA job gagal')
})
