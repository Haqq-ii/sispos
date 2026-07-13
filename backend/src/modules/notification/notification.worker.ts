import { Worker } from 'bullmq'
import pino from 'pino'
import { env } from '../../config/env'
import type { OtpJobData } from './otp.job'
import { OTP_JOB_NAME } from './otp.job'
import type { AntrianJobData } from './antrian.job'
import { ANTRIAN_WA_JOB_NAME } from './antrian.job'
import type { KonsultasiJobData } from './konsultasi.job'
import { KONSULTASI_WA_JOB_NAME } from './konsultasi.job'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })
function maskPhoneNumber(nomorPonsel: string): string {
  if (nomorPonsel.length <= 4) return '****'
  return nomorPonsel.slice(0, 4) + '****' + nomorPonsel.slice(-4)
}

function normalizeFonnteTarget(nomorPonsel: string): string {
  if (nomorPonsel.startsWith('08')) return `62${nomorPonsel.slice(1)}`
  if (nomorPonsel.startsWith('+628')) return nomorPonsel.slice(1)
  return nomorPonsel
}

function getProviderError(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  const reason = record.reason ?? record.message ?? record.detail
  return typeof reason === 'string' ? reason : undefined
}

async function sendFonnteMessage(nomorPonsel: string, message: string): Promise<void> {
  const target = normalizeFonnteTarget(nomorPonsel)
  const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      Authorization: env.FONNTE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target, message }),
  })

  const responseText = await response.text()
  let payload: unknown
  try {
    payload = responseText ? JSON.parse(responseText) : undefined
  } catch {
    payload = undefined
  }

  const providerStatus =
    payload && typeof payload === 'object' && 'status' in payload
      ? (payload as { status?: unknown }).status
      : undefined
  const providerError = getProviderError(payload)

  if (!response.ok || providerStatus === false) {
    logger.error(
      {
        httpStatus: response.status,
        providerStatus,
        providerError,
        targetMasked: maskPhoneNumber(target),
      },
      'Fonnte WA send gagal'
    )
    throw new Error(
      providerError
        ? `Fonnte API error: ${providerError}`
        : `Fonnte API error: HTTP ${response.status}`
    )
  }

  logger.debug(
    {
      httpStatus: response.status,
      providerStatus,
      targetMasked: maskPhoneNumber(target),
    },
    'Fonnte WA send diterima provider'
  )
}

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

      await sendFonnteMessage(nomorPonsel, message)

      logger.info({ nomorPonsel: maskPhoneNumber(nomorPonsel), jobId: job.id }, 'OTP WA berhasil dikirim via Fonnte')
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

      await sendFonnteMessage(nomorPonsel, message)

      logger.info(
        { nomorPonsel: maskPhoneNumber(nomorPonsel), jobId: job.id, nomorUrut },
        'Antrian WA berhasil dikirim via Fonnte'
      )
    } else if (job.name === KONSULTASI_WA_JOB_NAME) {
      const data = job.data as KonsultasiJobData
      const message =
        `SISPOS - Ringkasan Konsultasi\n\n` +
        `Balita: ${data.namaBalita}\n` +
        `Tanggal: ${data.tanggalPemeriksaan}\n\n` +
        `Ringkasan:\n${data.ringkasan}\n\n` +
        `Saran:\n${data.saranUtama}\n\n` +
        `Mohon lakukan pemantauan rutin di Posyandu.`

      await sendFonnteMessage(data.nomorPonsel, message)

      logger.info(
        { nomorPonsel: maskPhoneNumber(data.nomorPonsel), jobId: job.id, namaBalita: data.namaBalita },
        'Konsultasi WA berhasil dikirim via Fonnte'
      )
    }
  },
  {
    connection: parseBullMQConnection(),
  }
)

logger.info('Notification WA worker aktif')

notificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, jobName: job?.name, err }, 'Notification WA job gagal')
})
