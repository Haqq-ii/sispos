import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL harus berupa URL valid (contoh: postgresql://user:pass@host:5432/db)' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL harus berupa URL valid (contoh: redis://:password@host:6379)' }),
  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET minimal 32 karakter' }),
  JWT_REFRESH_SECRET: z.string().min(32, { message: 'JWT_REFRESH_SECRET minimal 32 karakter' }),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
