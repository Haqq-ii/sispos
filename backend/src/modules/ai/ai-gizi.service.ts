/**
 * ai-gizi.service.ts — Chatbot Gizi Citizen (GPT-4o + Redis rate limiting)
 *
 * CLAUDE.md §AI Chatbot Citizen (Gizi):
 *   - Temperature: 0.6, max_tokens: 300
 *   - Hanya jawab: gizi balita, tumbuh kembang, imunisasi, posyandu
 *   - Rate limit: 20 pesan/hari per citizen (Redis INCR + EXPIREAT)
 *
 * Security (T-04-03-01, T-04-03-02, T-04-03-03, T-04-03-04):
 *   - wargaId SELALU dari JWT req.user!.userId (bukan dari body)
 *   - GIZI_SYSTEM_PROMPT hardcoded server-side — tidak pernah dari client
 *   - Redis key menyertakan wargaId dari JWT — client tidak bisa manipulasi counter
 *   - RiwayatChat query menggunakan WHERE wargaId = wargaId dari JWT
 *   - Rate limit key menggunakan WIB date (UTC+7) sesuai Pitfall 5
 *   - Hanya 'user' dan 'assistant' roles disimpan ke RiwayatChat (Pitfall 6)
 */
import pino from 'pino'
import { redis } from '../../config/redis'
import { prisma } from '../../config/db'
import { env } from '../../config/env'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Constants ─────────────────────────────────────────────────────────────────

export const DAILY_LIMIT = 20

// System prompt hardcoded server-side (T-04-03-03 — user input treated as data, not instructions)
export const GIZI_SYSTEM_PROMPT =
  'Anda adalah asisten gizi Posyandu Indonesia yang membantu orang tua balita. ' +
  'Hanya jawab pertanyaan tentang: gizi balita, tumbuh kembang anak, imunisasi, dan posyandu. ' +
  'Jika ditanya tentang topik lain (politik, selebriti, berita, presiden, atau hal lainnya), ' +
  'tolak dengan sopan dalam Bahasa Indonesia: \'Maaf, saya hanya bisa membantu pertanyaan seputar gizi balita, tumbuh kembang, imunisasi, dan posyandu. ' +
  'Ada yang bisa saya bantu terkait topik tersebut?\' ' +
  'Jawab dalam Bahasa Indonesia yang ramah dan mudah dipahami orang tua. ' +
  'Maksimum respons: 300 token.'

// ── checkAndIncrementRateLimit ────────────────────────────────────────────────

/**
 * Atomically increment daily message counter for citizen.
 * Key uses WIB date (UTC+7) per Pitfall 5 — citizens in WIB timezone
 * don't get their day reset at UTC midnight (which would be 07:00 WIB).
 * EXPIREAT is set to 17:00 UTC = 00:00 WIB next day.
 *
 * @throws Error with code 'RATE_LIMIT_EXCEEDED' if citizen has sent > 20 messages today
 */
export async function checkAndIncrementRateLimit(wargaId: string): Promise<void> {
  // WIB date (UTC+7) per Pitfall 5
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const key = `chatbot:citizen:${wargaId}:${today}`

  const count = await redis.incr(key)

  if (count === 1) {
    // First message of the day — set expiry to end of WIB day (17:00 UTC = 00:00 WIB next day)
    const endOfDayWIB = new Date(Date.now() + 7 * 60 * 60 * 1000)
    endOfDayWIB.setUTCHours(17, 0, 0, 0) // 17:00 UTC = 00:00 WIB next day
    if (endOfDayWIB.getTime() <= Date.now()) {
      endOfDayWIB.setUTCDate(endOfDayWIB.getUTCDate() + 1)
    }
    await redis.expireat(key, Math.floor(endOfDayWIB.getTime() / 1000))
  }

  if (count > DAILY_LIMIT) {
    throw Object.assign(
      new Error('Batas 20 pesan per hari telah tercapai. Coba lagi besok.'),
      { code: 'RATE_LIMIT_EXCEEDED' }
    )
  }
}

// ── chatGizi ──────────────────────────────────────────────────────────────────

/**
 * chatGizi — GPT-4o conversation with topic guardrail + Redis rate limiting.
 *
 * Flow:
 * 1. checkAndIncrementRateLimit — throws RATE_LIMIT_EXCEEDED before OpenAI if over limit
 * 2. Load last 10 messages from RiwayatChat for conversation context
 * 3. Graceful degradation if OPENAI_API_KEY not set
 * 4. Lazy import OpenAI → call GPT-4o (temp 0.6, max_tokens 300)
 * 5. Persist both user + assistant turns to RiwayatChat
 * 6. Return reply
 *
 * @param wargaId  From JWT req.user!.userId — NEVER from request body (T-04-03-01)
 * @param message  User's question
 */
export async function chatGizi(wargaId: string, message: string): Promise<string> {
  // 1. Rate limit check (BEFORE OpenAI call — T-04-03-02)
  await checkAndIncrementRateLimit(wargaId)

  // 2. Load conversation history (last 10 messages, ordered oldest first)
  const history = await prisma.riwayatChat.findMany({
    where: { wargaId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { role: true, pesan: true },
  })
  history.reverse()

  // 3. Graceful degradation when OPENAI_API_KEY is not configured
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set — AI gizi chatbot disabled, returning stub')
    return 'Asisten AI tidak tersedia saat ini. Silakan hubungi posyandu langsung.'
  }

  // 4. Lazy import OpenAI (consistent with ai.service.ts pattern)
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Build messages: system prompt + history + current user message
  const messages = [
    { role: 'system' as const, content: GIZI_SYSTEM_PROMPT },
    ...history.map((h: { role: string; pesan: string }) => ({
      role: h.role as 'user' | 'assistant',
      content: h.pesan,
    })),
    { role: 'user' as const, content: message },
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.6, // CLAUDE.md §AI Chatbot Citizen (Gizi)
    max_tokens: 300, // CLAUDE.md §AI Chatbot Citizen (Gizi)
    messages,
  })

  const reply =
    response.choices[0]?.message?.content ?? 'Maaf, tidak bisa memproses permintaan saat ini.'

  // 5. Persist both turns to RiwayatChat
  //    Only 'user' and 'assistant' roles stored (T-04-03-05, Pitfall 6 — tool_call not applicable here)
  await prisma.riwayatChat.createMany({
    data: [
      { wargaId, role: 'user', pesan: message },
      { wargaId, role: 'assistant', pesan: reply },
    ],
  })

  logger.info({ wargaId }, 'chatGizi: AI response generated and persisted')

  return reply
}
