import { Queue } from 'bullmq'
import { env } from '../../config/env'
import type { OtpJobData } from './otp.job'
import { OTP_JOB_NAME } from './otp.job'
import type { AntrianJobData } from './antrian.job'
import { ANTRIAN_WA_JOB_NAME } from './antrian.job'
import type { KonsultasiJobData } from './konsultasi.job'
import { KONSULTASI_WA_JOB_NAME } from './konsultasi.job'

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

export const notificationQueue = new Queue('notification', {
  connection: parseBullMQConnection(),
})

/**
 * Enqueue OTP WhatsApp job ke BullMQ.
 * Retry 3x dengan exponential backoff (1s, 5s, 30s) — CLAUDE.md WA rule.
 */
export async function enqueueOtpJob(nomorPonsel: string, kodeOtp: string): Promise<void> {
  const data: OtpJobData = { nomorPonsel, kodeOtp }
  await notificationQueue.add(OTP_JOB_NAME, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  })
}

/**
 * Enqueue antrian WhatsApp confirmation job ke BullMQ.
 *
 * CLAUDE.md §WhatsApp: SELALU enqueue — tidak pernah panggil Fonnte langsung.
 * Retry 3x dengan exponential backoff: 1s → 5s → 30s.
 *
 * T-02-12 Mitigation: nomorPonsel dalam AntrianJobData berasal dari DB (warga.nomorPonsel),
 * bukan dari request body — attacker tidak bisa mengarahkan WA ke nomor lain.
 */
export async function enqueueAntrianWaJob(data: AntrianJobData): Promise<void> {
  await notificationQueue.add(ANTRIAN_WA_JOB_NAME, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  })
}

/**
 * Enqueue WhatsApp ringkasan konsultasi Meja 4.
 * Nomor ponsel harus berasal dari DB, bukan request body.
 */
export async function enqueueKonsultasiWaJob(data: KonsultasiJobData): Promise<void> {
  await notificationQueue.add(KONSULTASI_WA_JOB_NAME, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  })
}