import IORedis from 'ioredis'
import { createAdapter } from '@socket.io/redis-adapter'
import { env } from './env'
import pino from 'pino'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// Client utama untuk publish + general use
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

// Client terpisah untuk subscribe — diperlukan oleh @socket.io/redis-adapter
const subClient = redis.duplicate()

redis.on('connect', () => {
  logger.info('Redis terhubung')
})

redis.on('error', (err: Error) => {
  logger.error({ err }, 'Redis error')
})

subClient.on('error', (err: Error) => {
  logger.error({ err }, 'Redis subClient error')
})

export function createRedisAdapter() {
  return createAdapter(redis, subClient)
}
