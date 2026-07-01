import { Worker } from 'bullmq'
import pino from 'pino'
import { env } from '../../config/env'
import type { OtpJobData } from './otp.job'
import { OTP_JOB_NAME } from './otp.job'
import type { AntrianJobData } from './antrian.job'
import { ANTRIAN_WA_JOB_NAME } from './antrian.job'

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
    } else if (job.name === ANTRIAN_WA_JOB_NAME) {
      // ── Antrian confirmation WhatsApp notification ──────────────────
      const data = job.data as AntrianJobData
      const { nomorPonsel, nomorUrut, estimasiMenit, namaPosyandu, tanggalPelaksanaan, labelSesi } =
        data

      // nomorUrut zero-padded 2 digit per CONTEXT.md §Specifics
      const nomorUrutFormatted = String(nomorUrut).padStart(2, '0')

      const message =
        `Konfirmasi Antrian SISPOS\n\n` +
        `Nomor antrian Anda: *${nomorUrutFormatted}*\n` +
        `Posyandu: ${namaPosyandu}\n` +
        `Tanggal: ${tanggalPelaksanaan}\n` +
        `${labelSesi}\n` +
        `Estimasi tunggu: ±${estimasiMenit} menit\n\n` +
        `Harap hadir tepat waktu. Terima kasih.`

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

      logger.info({ nomorPonsel, jobId: job.id, nomorUrut }, 'Antrian WA berhasil dikirim via Fonnte')
    }
  },
  {
    connection: parseBullMQConnection(),
  }
)

notificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, jobName: job?.name, err }, 'Notification WA job gagal')
})
