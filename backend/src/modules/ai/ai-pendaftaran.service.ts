/**
 * ai-pendaftaran.service.ts — Chatbot Pendaftaran Antrian (GPT-4o + 5 Function Tools)
 *
 * CLAUDE.md §AI Chatbot Citizen (Pendaftaran Antrian — Function Calling):
 *   - Temperature: 0.4 (lebih deterministik untuk aksi nyata)
 *   - Tools: get_jadwal_tersedia, get_profil_balita, daftar_antrian, batalkan_antrian, reschedule_antrian
 *   - daftar_antrian HANYA dipanggil setelah citizen konfirmasi eksplisit
 *   - batalkan_antrian dan reschedule_antrian WAJIB minta konfirmasi eksplisit
 *
 * Security (T-04-04-01..T-04-04-05):
 *   - T-04-04-01: parallel_tool_calls:false WAJIB — mencegah bypass konfirmasi gate
 *   - T-04-04-02: IDOR guard — executeToolCall passes wargaId dari JWT ke antrian.service
 *   - T-04-04-03: clientHistory hanya mempengaruhi text generation; semua aksi validasi ownership via JWT
 *   - T-04-04-04: MAX_ITERATIONS = 5 — hard cap, throw AI_TIMEOUT setelah 5 iterasi
 *   - T-04-04-05: wargaId SELALU dari JWT req.user!.userId, TIDAK dari body
 *   - PENDAFTARAN_SYSTEM_PROMPT hardcoded server-side — tidak pernah dari client
 *   - Hanya 'user' dan 'assistant' turns disimpan ke RiwayatChat (Pitfall 6)
 */
import pino from 'pino'
import type OpenAI from 'openai'
import { prisma } from '../../config/db'
import { ambilAntrian, batalkanAntrian } from '../antrian/antrian.service'
import { env } from '../../config/env'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 5

// System prompt hardcoded server-side — tidak pernah dari client (T-04-04-01)
export const PENDAFTARAN_SYSTEM_PROMPT =
  'Anda adalah asisten pendaftaran antrian Posyandu Indonesia. ' +
  'Anda membantu citizen mendaftar, membatalkan, atau menjadwal ulang antrian posyandu untuk balita mereka. ' +
  'ATURAN WAJIB: ' +
  '- SELALU tampilkan ringkasan lengkap (nama posyandu, tanggal, sesi jam, nama balita) SEBELUM minta konfirmasi citizen. ' +
  '- Panggil daftar_antrian, batalkan_antrian, atau reschedule_antrian HANYA setelah citizen mengonfirmasi dengan kata ' +
  '\'ya\', \'oke\', \'setuju\', \'benar\', \'daftar\', \'batalkan\', atau ungkapan serupa. ' +
  '- Jika citizen TIDAK mengonfirmasi secara eksplisit, JANGAN panggil fungsi aksi tersebut — tanyakan kembali. ' +
  '- Untuk get_jadwal_tersedia dan get_profil_balita, kamu BOLEH memanggil tanpa konfirmasi eksplisit karena ini hanya membaca data. ' +
  '- JANGAN gunakan markdown formatting seperti **bold**, *italic*, atau bullet point dengan tanda -. Tulis dalam teks biasa dengan baris baru untuk pemisah. ' +
  '- Saat menampilkan jadwal, tulis setiap sesi di baris baru. Saat menampilkan ringkasan, tulis setiap field di baris baru. ' +
  '- Data jadwal dari get_jadwal_tersedia: gunakan field "slotId" (bukan "jadwalId") saat memanggil daftar_antrian. ' +
  'Jawab dalam Bahasa Indonesia yang ramah dan profesional.'

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
          slotId: {
            type: 'string',
            description: 'ID slot sesi',
          },
          balitaId: {
            type: 'string',
            description: 'ID balita',
          },
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
          antrianId: {
            type: 'string',
            description: 'ID antrian yang akan dibatalkan',
          },
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
          antrianId: {
            type: 'string',
            description: 'ID antrian lama',
          },
          slotId: {
            type: 'string',
            description: 'ID slot sesi baru',
          },
        },
        required: ['antrianId', 'slotId'],
      },
    },
  },
]

// ── Internal: getJadwalTersedia ───────────────────────────────────────────────

/**
 * Mengambil jadwal posyandu aktif dalam 7 hari ke depan dari posyandu utama citizen.
 * IDOR guard: posyanduId diambil dari DB via wargaId dari JWT — tidak dari args.
 */
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
        select: {
          id: true,
          labelSesi: true,
          jamMulai: true,
          kuota: true,
          terisi: true,
        },
      },
      posyandu: {
        select: { namaPosyandu: true },
      },
    },
    orderBy: { tanggalPelaksanaan: 'asc' },
  })

  return jadwalList.map((j: typeof jadwalList[0]) => ({
    jadwalId: j.id,
    namaPosyandu: j.posyandu.namaPosyandu,
    tanggalPelaksanaan: j.tanggalPelaksanaan,
    sesi: j.slotSesi.map((s: typeof jadwalList[0]['slotSesi'][0]) => ({
      slotId: s.id,
      labelSesi: s.labelSesi,
      jamMulai: s.jamMulai,
      tersedia: s.kuota - s.terisi,
    })),
  }))
}

// ── Internal: getProfilBalita ─────────────────────────────────────────────────

/**
 * Mengambil daftar balita milik citizen.
 * IDOR guard: wargaId dari JWT — balita milik citizen lain tidak akan muncul.
 */
async function getProfilBalita(wargaId: string): Promise<object> {
  return prisma.balita.findMany({
    where: { wargaId },
    select: {
      id: true,
      namaBalita: true,
      tanggalLahir: true,
      jenisKelamin: true,
    },
  })
}

// ── Internal: executeToolCall ─────────────────────────────────────────────────

/**
 * Eksekusi function call dari GPT-4o dengan IDOR guard via wargaId dari JWT.
 *
 * Security:
 *   - wargaId SELALU dari JWT — tidak dari args (T-04-04-05)
 *   - ambilAntrian dan batalkanAntrian sudah punya IDOR guard di antrian.service
 *   - reschedule_antrian: IDOR guard tambahan via prisma.antrian.findFirst({ wargaId })
 */
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
        // IDOR guard: pastikan antrian milik citizen sebelum batalkan (T-04-04-02)
        const old = await prisma.antrian.findFirst({
          where: { id: args.antrianId, wargaId },
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
  } catch (e) {
    const err = e as { message?: string }
    logger.warn({ toolName, wargaId, error: err.message }, 'executeToolCall error')
    return JSON.stringify({ error: err.message ?? 'Tool execution failed' })
  }
}

// ── chatPendaftaran ───────────────────────────────────────────────────────────

/**
 * chatPendaftaran — GPT-4o function-calling loop untuk pendaftaran antrian.
 *
 * Flow:
 * 1. Graceful degradation jika OPENAI_API_KEY tidak ada
 * 2. Lazy import OpenAI (konsisten dengan ai-gizi.service.ts pattern)
 * 3. Build messages: system prompt + clientHistory + userMessage
 * 4. While loop (max 5 iterasi):
 *    - finish_reason='stop' → persist user+assistant ke RiwayatChat, return clean client messages
 *    - finish_reason='tool_calls' → executeToolCall per tool, tambah tool results ke messages
 * 5. Setelah 5 iterasi tanpa stop → throw AI_TIMEOUT
 *
 * Security:
 *   - wargaId dari JWT — tidak pernah dari clientHistory atau body (T-04-04-05)
 *   - clientHistory TIDAK dipercaya untuk wargaId; hanya untuk text generation context (T-04-04-03)
 *   - parallel_tool_calls:false — mencegah simultaneous tool execution yang bisa bypass gate (T-04-04-01)
 *   - MAX_ITERATIONS = 5 — DoS protection (T-04-04-04)
 *
 * @param wargaId       Dari JWT req.user!.userId — NEVER dari body
 * @param userMessage   Pesan citizen saat ini
 * @param clientHistory Riwayat conversation sebelumnya (dari frontend state)
 */
export async function chatPendaftaran(
  wargaId: string,
  userMessage: string,
  clientHistory: Array<{ role: string; content: string }>
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
  // 1. Graceful degradation ketika OPENAI_API_KEY tidak ada (development/test env)
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set — AI pendaftaran chatbot disabled, returning stub')
    const stubReply = 'Asisten pendaftaran tidak tersedia saat ini.'
    return {
      reply: stubReply,
      messages: [
        ...clientHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: stubReply },
      ],
    }
  }

  // 2. Lazy import OpenAI (konsisten dengan ai-gizi.service.ts — tidak load jika key tidak ada)
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // 3. Build messages array — SELALU mulai dengan system prompt (tidak pernah dari client)
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: PENDAFTARAN_SYSTEM_PROMPT },
    // clientHistory: map ke type yang tepat (role dari Zod enum sudah validated di route)
    ...clientHistory.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: userMessage },
  ]

  let iteration = 0

  // 4. Tool-calling loop — max MAX_ITERATIONS untuk DoS protection (T-04-04-04)
  while (iteration < MAX_ITERATIONS) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.4, // CLAUDE.md §AI Chatbot Citizen (Pendaftaran Antrian)
      messages,
      tools: TOOLS,
      parallel_tool_calls: false, // T-04-04-01: WAJIB — sequential tool execution untuk konfirmasi gate
    })

    const choice = response.choices[0]
    messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)

    if (choice.finish_reason === 'stop') {
      const reply = choice.message.content ?? 'Maaf, tidak bisa memproses permintaan.'

      // Persist HANYA user + assistant content turns ke RiwayatChat
      // (Pitfall 6: tool_call messages tidak disimpan — VarChar(10) role constraint)
      await prisma.riwayatChat.createMany({
        data: [
          { wargaId, role: 'user', pesan: userMessage },
          { wargaId, role: 'assistant', pesan: reply },
        ],
      })

      // Return messages yang bersih — tanpa system prompt, tanpa tool messages
      // Frontend hanya perlu user + assistant turns untuk rendering dan history berikutnya
      const clientMessages = [
        ...clientHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: reply },
      ]

      logger.info({ wargaId, iteration }, 'chatPendaftaran: AI response generated and persisted')

      return { reply, messages: clientMessages }
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      // Type helper: OpenAI SDK union includes custom tool calls; narrow to function type
      type FunctionToolCall = {
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }
      for (const toolCall of choice.message.tool_calls) {
        // Only process function-type tool calls (all TOOLS are function type)
        if (toolCall.type !== 'function') continue
        const ftc = toolCall as unknown as FunctionToolCall
        const args = JSON.parse(ftc.function.arguments) as Record<string, string>
        const result = await executeToolCall(ftc.function.name, args, wargaId)
        messages.push({
          role: 'tool',
          tool_call_id: ftc.id,
          content: result,
        } as OpenAI.Chat.ChatCompletionMessageParam)
      }
    }

    iteration++
  }

  // 5. Exceeded MAX_ITERATIONS — DoS protection (T-04-04-04)
  throw Object.assign(new Error('AI tidak bisa menyelesaikan permintaan.'), { code: 'AI_TIMEOUT' })
}
