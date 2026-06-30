import { PrismaClient } from '@prisma/client'
import { env } from './env'
import pino from 'pino'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// Singleton global pattern — mencegah multiple PrismaClient saat ts-node hot-reload
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect()
    logger.info('Database PostgreSQL terhubung')
  } catch (err) {
    logger.error({ err }, 'Gagal terhubung ke database PostgreSQL')
    throw err
  }
}
