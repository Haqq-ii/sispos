import { Queue } from 'bullmq'
import { env } from '../../config/env'
import type { OtpJobData } from './otp.job'
import { OTP_JOB_NAME } from './otp.job'

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
