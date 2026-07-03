/**
 * ai-assistant.service.ts — AI Assistant Citizen (GPT-4o + Redis rate limit + 5 Function Tools)
 *
 * Menggabungkan dua layanan sebelumnya:
 *   - Konsultasi gizi & tumbuh kembang (tanya jawab, guardrail topik)
 *   - Pendaftaran antrian (daftar, batalkan, reschedule via function calling)
 *
 * CLAUDE.md constraints yang diterapkan:
 *   - Temperature: 0.4 (deterministik untuk function calling)
 *   - Rate limit: 20 pesan/hari per citizen (Redis INCR + EXPIREAT, WIB timezone)
 *   - parallel_tool_calls: false (T-04-04-01 — mencegah bypass konfirmasi gate)
 *   - MAX_ITERATIONS: 5 — hard cap tool calling loop
 *   - wargaId SELALU dari JWT, TIDAK dari body (T-04-04-05)
 *   - ASSISTANT_SYSTEM_PROMPT hardcoded server-side — tidak pernah dari client
 *   - Hanya 'user' dan 'assistant' turns disimpan ke RiwayatChat
 */
import pino from 'pino'
import type OpenAI from 'openai'
import { redis } from '../../config/redis'
import { prisma } from '../../config/db'
import { ambilAntrian, batalkanAntrian } from '../antrian/antrian.service'
import { env } from '../../config/env'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 5
export const DAILY_LIMIT = 20

// ── System prompt (hardcoded server-side) ─────────────────────────────────────

export const ASSISTANT_SYSTEM_PROMPT =
  'Anda adalah AI Assistant Posyandu Indonesia yang membantu orang tua balita dengan dua layanan:\n' +
  '1. Konsultasi gizi & tumbuh kembang (tanya jawab)\n' +
  '2. Pendaftaran, pembatalan, dan penjadwalan ulang antrian posyandu\n' +
  '\nTOPIK YANG DIIZINKAN:\n' +
  '- Gizi balita, tumbuh kembang anak, imunisasi, informasi posyandu\n' +
  '- Pendaftaran, pembatalan, dan reschedule antrian posyandu\n' +
  '\nTOPIK YANG DITOLAK:\n' +
  'Jika ditanya topik lain (politik, selebriti, berita, ekonomi, dsb), tolak sopan:\n' +
  '"Maaf, saya hanya bisa membantu seputar gizi balita, tumbuh kembang, imunisasi, posyandu, ' +
  'dan pendaftaran antrian. Ada yang bisa saya bantu terkait topik tersebut?"\n' +
  '\nATURAN KONFIRMASI (WAJIB untuk aksi antrian):\n' +
  '- SELALU tampilkan ringkasan sebelum meminta konfirmasi.\n' +
  '- Panggil daftar_antrian, batalkan_antrian, atau reschedule_antrian HANYA setelah citizen ' +
  'mengonfirmasi dengan kata \'ya\', \'oke\', \'setuju\', \'benar\', \'daftar\', \'batalkan\', atau ungkapan serupa.\n' +
  '- Jika citizen TIDAK mengonfirmasi secara eksplisit, JANGAN panggil fungsi aksi — tanyakan kembali.\n' +
  '- get_jadwal_tersedia dan get_profil_balita boleh dipanggil tanpa konfirmasi (hanya baca data).\n' +
  '- Gunakan field "slotId" saat memanggil daftar_antrian.\n' +
  '\nATURAN FORMAT (WAJIB):\n' +
  '- JANGAN gunakan markdown seperti **bold**, *italic*, atau # heading.\n' +
  '- Gunakan karakter • untuk setiap poin dalam daftar.\n' +
  '- Saat menampilkan daftar jadwal, gunakan format ini:\n' +
  '  📅 [Hari, Tanggal] — [Nama Posyandu]\n' +
  '  • [Label Sesi]: [HH:MM]–[HH:MM] ([N] slot tersisa)\n' +
  '  (ulangi baris • untuk setiap sesi)\n' +
  '- Saat menampilkan ringkasan pendaftaran, gunakan format ini:\n' +
  '  Ringkasan Pendaftaran:\n' +
  '  • Posyandu: [nama]\n' +
  '  • Tanggal: [tanggal]\n' +
  '  • Sesi: [label sesi] ([HH:MM]–[HH:MM])\n' +
  '  • Balita: [nama balita]\n' +
  '  • Estimasi tunggu: ±[N] menit\n\n' +
  '  Apakah Anda setuju untuk mendaftar?\n' +
  '- Saat menampilkan ringkasan pembatalan, gunakan format ini:\n' +
  '  Ringkasan Pembatalan:\n' +
  '  • Antrian: No. [nomorUrut]\n' +
  '  • Posyandu: [nama]\n' +
  '  • Tanggal: [tanggal]\n\n' +
  '  Apakah Anda yakin ingin membatalkan?\n' +
  '- Pisahkan setiap bagian dengan baris kosong.\n' +
  '- Jaga respons singkat dan mudah dibaca di layar HP.\n' +
  '- Untuk konsultasi gizi: maksimum 300 kata per respons.\n' +
  '\nJawab dalam Bahasa Indonesia yang ramah dan profesional.'

// ── TOOLS: 5 function tools untuk GPT-4o function calling ────────────────────

export const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_jadwal_tersedia',
      description:
        'Mendapatkan daftar jadwal posyandu yang tersedia untuk posyandu utama citizen dalam 7 hari ke depan atau tanggal tertentu.',
      parameters: {
        type: 'object',
        properties: {
          tanggal: {
            type: 'string',
            description: 'Tanggal opsional dalam format YYYY-MM-DD',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_profil_balita',
      description: 'Mendapatkan daftar balita yang terdaftar di akun citizen.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_antrian',
      description:
        'Mendaftarkan balita ke antrian posyandu. PENTING: HANYA panggil setelah citizen mengonfirmasi eksplisit.',
      parameters: {
        type: 'object',
        properties: {
          slotId: { type: 'string', description: 'ID slot sesi' },
          balitaId: { type: 'string', description: 'ID balita' },
        },
        required: ['slotId', 'balitaId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'batalkan_antrian',
      description:
        'Membatalkan antrian yang sudah ada. PENTING: HANYA panggil setelah citizen mengonfirmasi eksplisit.',
      parameters: {
        type: 'object',
        properties: {
          antrianId: { type: 'string', description: 'ID antrian yang akan dibatalkan' },
        },
        required: ['antrianId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_antrian',
      description:
        'Menjadwal ulang antrian ke sesi lain. PENTING: HANYA panggil setelah citizen mengonfirmasi eksplisit.',
      parameters: {
        type: 'object',
        properties: {
          antrianId: { type: 'string', description: 'ID antrian lama' },
          slotId: { type: 'string', description: 'ID slot sesi baru' },
        },
        required: ['antrianId', 'slotId'],
      },
    },
  },
]

// ── checkAndIncrementRateLimit ─────────────────────────────────────────────────

/**
 * Rate limit: 20 pesan/hari per citizen. Key berbasis WIB date (UTC+7) per Pitfall 5.
 * Key terpisah dari ai-gizi (chatbot:assistant vs chatbot:gizi) agar counter tidak bentrok.
 */
export async function checkAndIncrementRateLimit(wargaId: string): Promise<void> {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const key = `chatbot:assistant:citizen:${wargaId}:${today}`

  const count = await redis.incr(key)

  if (count === 1) {
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

// ── Internal: getJadwalTersedia ───────────────────────────────────────────────

async function getJadwalTersedia(wargaId: string, tanggal?: string): Promise<object> {
  const warga = await prisma.warga.findUnique({
    where: { id: wargaId },
    select: { posyanduUtamaId: true },
  })

  if (!warga?.posyanduUtamaId) {
    return { error: 'Citizen belum memilih posyandu utama.' }
  }

  const dateFrom = tanggal ? new Date(tanggal) : new Date()
  const dateTo = new Date(dateFrom)
  dateTo.setDate(dateTo.getDate() + 7)

  const jadwalList = await prisma.jadwal.findMany({
    where: {
      posyanduId: warga.posyanduUtamaId,
      statusJadwal: 'aktif',
      tanggalPelaksanaan: { gte: dateFrom, lte: dateTo },
    },
    include: {
      slotSesi: {
        select: { id: true, labelSesi: true, jamMulai: true, kuota: true, terisi: true },
      },
      posyandu: { select: { namaPosyandu: true } },
    },
    orderBy: { tanggalPelaksanaan: 'asc' },
  })

  return jadwalList.map((j: typeof jadwalList[0]) => ({
    jadwalId: j.id,
    namaPosyandu: j.posyandu.namaPosyandu,
    tanggalPelaksanaan: j.tanggalPelaksanaan,
    sesi: j.slotSesi.map((s: typeof j.slotSesi[0]) => ({
      slotId: s.id,
      labelSesi: s.labelSesi,
      jamMulai: s.jamMulai,
      tersedia: s.kuota - s.terisi,
    })),
  }))
}

// ── Internal: getProfilBalita ─────────────────────────────────────────────────

async function getProfilBalita(wargaId: string): Promise<object> {
  return prisma.balita.findMany({
    where: { wargaId },
    select: { id: true, namaBalita: true, tanggalLahir: true, jenisKelamin: true },
  })
}

// ── Internal: executeToolCall ─────────────────────────────────────────────────

type FunctionToolCall = {
  type: 'function'
  id: string
  function: { name: string; arguments: string }
}

async function executeToolCall(
  toolName: string,
  args: Record<string, string>,
  wargaId: string
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_jadwal_tersedia':
        return JSON.stringify(await getJadwalTersedia(wargaId, args.tanggal))

      case 'get_profil_balita':
        return JSON.stringify(await getProfilBalita(wargaId))

      case 'daftar_antrian': {
        const result = await ambilAntrian(args.slotId, args.balitaId, wargaId)
        return JSON.stringify({
          success: true,
          antrianId: result.antrianId,
          nomorUrut: result.nomorUrut,
          estimasiMenit: result.estimasiMenit,
        })
      }

      case 'batalkan_antrian': {
        const result = await batalkanAntrian(args.antrianId, wargaId)
        return JSON.stringify({ success: true, ...result })
      }

      case 'reschedule_antrian': {
        // IDOR guard: pastikan antrian milik citizen ini
        const old = await prisma.antrian.findFirst({
          where: { id: args.antrianId, wargaId },
          select: { balitaId: true },
        })
        if (!old) {
          return JSON.stringify({ error: 'Antrian tidak ditemukan atau bukan milik Anda.' })
        }
        await batalkanAntrian(args.antrianId, wargaId)
        const newResult = await ambilAntrian(args.slotId, old.balitaId, wargaId)
        return JSON.stringify({
          success: true,
          oldAntrianId: args.antrianId,
          newAntrianId: newResult.antrianId,
          nomorUrut: newResult.nomorUrut,
        })
      }

      default:
        return JSON.stringify({ error: 'Unknown tool' })
    }
  } catch (err) {
    const e = err as Error
    logger.warn({ toolName, error: e.message }, 'executeToolCall error')
    return JSON.stringify({ error: e.message ?? 'Tool execution failed' })
  }
}

// ── chatAssistant ─────────────────────────────────────────────────────────────

/**
 * chatAssistant — AI Assistant gabungan gizi + pendaftaran antrian.
 *
 * Flow:
 * 1. checkAndIncrementRateLimit (20/hari, Redis, WIB timezone)
 * 2. Graceful degradation jika OPENAI_API_KEY tidak di-set
 * 3. Tool calling loop (max 5 iterasi, parallel_tool_calls:false)
 * 4. Persist user + assistant turns ke RiwayatChat
 * 5. Return { reply, messages } — messages adalah updated client-side history
 *
 * @param wargaId        Dari JWT req.user!.userId — TIDAK dari body
 * @param userMessage    Pesan dari citizen
 * @param clientHistory  History percakapan dari client (untuk konteks tool calling)
 */
export async function chatAssistant(
  wargaId: string,
  userMessage: string,
  clientHistory: Array<{ role: string; content: string }>
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
  // 1. Rate limit
  await checkAndIncrementRateLimit(wargaId)

  // 2. Graceful degradation
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set — AI Assistant disabled, returning stub')
    const stub = 'AI Assistant tidak tersedia saat ini. Silakan hubungi posyandu langsung.'
    return {
      reply: stub,
      messages: [
        ...clientHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: stub },
      ],
    }
  }

  // 3. Lazy import OpenAI
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Build messages array with system prompt + history + new user message
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    ...(clientHistory as OpenAI.Chat.ChatCompletionMessageParam[]),
    { role: 'user', content: userMessage },
  ]

  let iteration = 0

  while (iteration < MAX_ITERATIONS) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.4,
      messages,
      tools: TOOLS,
      parallel_tool_calls: false, // T-04-04-01: mencegah bypass konfirmasi gate
    })

    const choice = response.choices[0]
    messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)

    if (choice.finish_reason === 'stop') {
      const reply =
        choice.message.content ?? 'Maaf, tidak bisa memproses permintaan saat ini.'

      // Persist hanya user + assistant turns (bukan tool messages — Pitfall 6)
      await prisma.riwayatChat.createMany({
        data: [
          { wargaId, role: 'user', pesan: userMessage },
          { wargaId, role: 'assistant', pesan: reply },
        ],
      })

      logger.info({ wargaId, iteration }, 'chatAssistant: response generated')

      // Return clean client history (tanpa system prompt dan tool messages)
      return {
        reply,
        messages: [
          ...clientHistory,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: reply },
        ],
      }
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        // Type narrowing untuk OpenAI SDK union type (ChatCompletionMessageCustomToolCall)
        if (toolCall.type !== 'function') continue
        const tc = toolCall as unknown as FunctionToolCall
        const args = JSON.parse(tc.function.arguments) as Record<string, string>
        const result = await executeToolCall(tc.function.name, args, wargaId)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        } as OpenAI.Chat.ChatCompletionMessageParam)
      }
    }

    iteration++
  }

  throw Object.assign(new Error('AI tidak bisa menyelesaikan permintaan.'), {
    code: 'AI_TIMEOUT',
  })
}
