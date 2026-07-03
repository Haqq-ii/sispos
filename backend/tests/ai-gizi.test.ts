/**
 * ai-gizi.test.ts — Unit tests untuk AI Chatbot Gizi service
 *
 * Tests:
 * 1. checkAndIncrementRateLimit: tidak throw saat count <= 20 (expireat dipanggil saat count=1)
 * 2. checkAndIncrementRateLimit: throw RATE_LIMIT_EXCEEDED saat count > 20
 * 3. GIZI_SYSTEM_PROMPT: mengandung 4 topik wajib (gizi balita, tumbuh kembang, imunisasi, posyandu)
 * 4. chatGizi: returns stub saat OPENAI_API_KEY tidak di-set
 *
 * Path mocks: '../src/' (satu level naik ke backend/, lalu masuk src/)
 * Sesuai pola yang diverifikasi di 04-02 (users.test.ts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../src/config/db', () => ({
  prisma: {
    riwayatChat: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  },
}))

vi.mock('../src/config/redis', () => ({
  redis: {
    incr: vi.fn(),
    expireat: vi.fn(),
  },
}))

vi.mock('../src/config/env', () => ({
  env: { NODE_ENV: 'test' },
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import {
  checkAndIncrementRateLimit,
  chatGizi,
  GIZI_SYSTEM_PROMPT,
} from '../src/modules/ai/ai-gizi.service'
import { redis } from '../src/config/redis'

// ── Tests: checkAndIncrementRateLimit ─────────────────────────────────────────

describe('checkAndIncrementRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not throw when count <= 20, and calls expireat on first message', async () => {
    // Mock: first message of the day (count = 1)
    vi.mocked(redis.incr).mockResolvedValue(1)
    vi.mocked(redis.expireat).mockResolvedValue(1)

    // Should not throw
    await expect(checkAndIncrementRateLimit('warga-1')).resolves.toBeUndefined()

    // expireat MUST be called on first message to set TTL
    expect(redis.expireat).toHaveBeenCalledTimes(1)
    expect(redis.expireat).toHaveBeenCalledWith(
      expect.stringContaining('chatbot:gizi:citizen:warga-1:'),
      expect.any(Number)
    )
  })

  it('throws RATE_LIMIT_EXCEEDED when count > 20', async () => {
    // Mock: 21st message (over limit)
    vi.mocked(redis.incr).mockResolvedValue(21)

    await expect(checkAndIncrementRateLimit('warga-over')).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
    })
  })
})

// ── Tests: chatGizi ───────────────────────────────────────────────────────────

describe('chatGizi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GIZI_SYSTEM_PROMPT contains all 4 required topics', () => {
    expect(GIZI_SYSTEM_PROMPT).toContain('gizi balita')
    expect(GIZI_SYSTEM_PROMPT).toContain('tumbuh kembang')
    expect(GIZI_SYSTEM_PROMPT).toContain('imunisasi')
    expect(GIZI_SYSTEM_PROMPT).toContain('posyandu')
  })

  it('returns stub message when OPENAI_API_KEY is not set', async () => {
    // Setup: rate limit ok (count = 1)
    vi.mocked(redis.incr).mockResolvedValue(1)
    vi.mocked(redis.expireat).mockResolvedValue(1)

    // Temporarily remove API key
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    try {
      const result = await chatGizi('w-1', 'test pertanyaan')
      // Should return graceful degradation stub
      expect(result).toContain('tidak tersedia')
    } finally {
      // Restore env
      if (originalKey !== undefined) {
        process.env.OPENAI_API_KEY = originalKey
      }
    }
  })
})
