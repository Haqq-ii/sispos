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
const ASSISTANT_STATE_TTL_SECONDS = 30 * 60
const TIME_ZONE = 'Asia/Jakarta'

type AssistantSlotState = {
  nomor: number
  slotId: string
  tanggalISO: string
  hari: string
  tanggalTampil: string
  posyanduId: string
  namaPosyandu: string
  sesiLabel: string
  jamMulai: string
  jamSelesai: string
  tersedia: number
  kapasitas: number
  terisi: number
}

type AssistantBalitaState = {
  nomor: number
  balitaId: string
  nama: string
}

type AssistantRegistrationState = {
  requestedDate?: string
  requestedLabel?: string
  lastSlots?: AssistantSlotState[]
  selectedSlotId?: string
  selectedSlotLabel?: string
  selectedSlot?: AssistantSlotState
  lastBalita?: AssistantBalitaState[]
  selectedBalitaId?: string
  selectedBalitaName?: string
  confirmationPending?: boolean
}

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
  '- KRITIS: Jangan hitung atau mengarang hari/tanggal. Gunakan field "hari" dan "tanggalTampil" dari tool.\n' +
  '- KRITIS: Jangan mengarang slotId atau balitaId dari teks chat. Pemilihan nomor sesi/balita dipetakan oleh backend state.\n' +
  '- Jika tool mengembalikan fallback jadwal, jelaskan: "Tidak ada jadwal [label]. Jadwal terdekat yang tersedia adalah ..."\n' +
  '- Jika tool mengembalikan { error: "...", code: "..." }, sampaikan penyebab spesifiknya ke citizen.\n' +
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
  const key = `chatbot:citizen:${wargaId}:${today}`

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

function stateKey(wargaId: string): string {
  return `chatbot:assistant:registration:${wargaId}`
}

async function getRegistrationState(wargaId: string): Promise<AssistantRegistrationState> {
  const raw = await redis.get(stateKey(wargaId))
  if (!raw) return {}
  try {
    return JSON.parse(raw) as AssistantRegistrationState
  } catch {
    return {}
  }
}

async function saveRegistrationState(
  wargaId: string,
  patch: Partial<AssistantRegistrationState>
): Promise<AssistantRegistrationState> {
  const current = await getRegistrationState(wargaId)
  const next = { ...current, ...patch }
  await redis.set(stateKey(wargaId), JSON.stringify(next), 'EX', ASSISTANT_STATE_TTL_SECONDS)
  return next
}

async function clearRegistrationState(wargaId: string): Promise<void> {
  await redis.del(stateKey(wargaId))
}

function isoDateInWIB(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function addDaysISO(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function startOfWIBDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+07:00`)
}

function formatTanggalWIB(isoDate: string): { hari: string; tanggalTampil: string } {
  const date = startOfWIBDate(isoDate)
  return {
    hari: date.toLocaleDateString('id-ID', { weekday: 'long', timeZone: TIME_ZONE }),
    tanggalTampil: date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: TIME_ZONE,
    }),
  }
}

function formatTimeUTC(date: Date): string {
  return date.toISOString().substring(11, 16)
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function resolveRelativeDateFromText(message: string): { date: string; label: string } | null {
  const normalized = normalizeText(message)
  const today = isoDateInWIB()
  if (/\blusa\b/.test(normalized)) return { date: addDaysISO(today, 2), label: 'lusa' }
  if (/\bbesok\b/.test(normalized)) return { date: addDaysISO(today, 1), label: 'besok' }
  if (/\bhari ini\b/.test(normalized) || /\bsekarang\b/.test(normalized)) {
    return { date: today, label: 'hari ini' }
  }
  const isoMatch = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (isoMatch) return { date: isoMatch[1], label: isoMatch[1] }
  return null
}

function isScheduleRequest(message: string): boolean {
  const normalized = normalizeText(message)
  return /(daftar|antrian|jadwal|posyandu)/.test(normalized) && !!resolveRelativeDateFromText(message)
}

function parseNumberChoice(message: string): number | null {
  const normalized = normalizeText(message)
  const match = normalized.match(/(?:sesi\s*)?(\d+)/)
  if (!match) return null
  return Number(match[1])
}

function isConfirmation(message: string): boolean {
  return /\b(ya|iya|y|oke|ok|setuju|benar|daftar|lanjut)\b/.test(normalizeText(message))
}

type JadwalResult = {
  requestedDate: string
  requestedLabel: string
  isExactMatch: boolean
  fallbackReason?: string
  jadwal: Array<{
    jadwalId: string
    tanggalISO: string
    hari: string
    tanggalTampil: string
    posyanduId: string
    namaPosyandu: string
    sesi: Array<{
      nomor: number
      slotId: string
      sesiLabel: string
      labelSesi: string
      jamMulai: string
      jamSelesai: string
      tersedia: number
      kapasitas: number
      terisi: number
    }>
  }>
  slots: AssistantSlotState[]
}

async function getJadwalTersedia(
  wargaId: string,
  tanggal?: string,
  requestedLabel = tanggal ?? 'hari ini'
): Promise<JadwalResult | { error: string; code?: string }> {
  const warga = await prisma.warga.findUnique({
    where: { id: wargaId },
    select: { posyanduUtamaId: true },
  })

  if (!warga?.posyanduUtamaId) {
    return { error: 'Citizen belum memilih posyandu utama.', code: 'POSYANDU_BELUM_DIPILIH' }
  }

  const posyanduUtamaId = warga.posyanduUtamaId
  const todayWIB = isoDateInWIB()
  const requestedDate = tanggal ?? todayWIB

  async function queryRange(fromISO: string, toISOExclusive: string) {
    return prisma.jadwal.findMany({
      where: {
        posyanduId: posyanduUtamaId,
        statusJadwal: 'aktif',
        tanggalPelaksanaan: { gte: startOfWIBDate(fromISO), lt: startOfWIBDate(toISOExclusive) },
      },
      include: {
        slotSesi: {
          select: {
            id: true,
            nomorSesi: true,
            labelSesi: true,
            jamMulai: true,
            jamSelesai: true,
            kuota: true,
            terisi: true,
          },
          orderBy: { nomorSesi: 'asc' },
        },
        posyandu: { select: { id: true, namaPosyandu: true } },
      },
      orderBy: { tanggalPelaksanaan: 'asc' },
    })
  }

  let isExactMatch = true
  let fallbackReason: string | undefined
  let jadwalList = await queryRange(requestedDate, addDaysISO(requestedDate, 1))

  if (jadwalList.length === 0) {
    isExactMatch = false
    fallbackReason = `Tidak ada jadwal ${requestedLabel}.`
    jadwalList = await queryRange(todayWIB, addDaysISO(todayWIB, 30))
  }

  let nomor = 1
  const slots: AssistantSlotState[] = []
  const jadwal = jadwalList.map((j) => {
    const tanggalISO = j.tanggalPelaksanaan.toISOString().slice(0, 10)
    const { hari, tanggalTampil } = formatTanggalWIB(tanggalISO)
    const sesi = j.slotSesi
      .filter((s) => s.kuota - s.terisi > 0)
      .map((s) => {
        const slot: AssistantSlotState = {
          nomor,
          slotId: s.id,
          tanggalISO,
          hari,
          tanggalTampil,
          posyanduId: j.posyandu.id,
          namaPosyandu: j.posyandu.namaPosyandu,
          sesiLabel: s.labelSesi,
          jamMulai: formatTimeUTC(s.jamMulai),
          jamSelesai: formatTimeUTC(s.jamSelesai),
          tersedia: s.kuota - s.terisi,
          kapasitas: s.kuota,
          terisi: s.terisi,
        }
        slots.push(slot)
        nomor += 1
        return {
          nomor: slot.nomor,
          slotId: slot.slotId,
          sesiLabel: slot.sesiLabel,
          labelSesi: slot.sesiLabel,
          jamMulai: slot.jamMulai,
          jamSelesai: slot.jamSelesai,
          tersedia: slot.tersedia,
          kapasitas: slot.kapasitas,
          terisi: slot.terisi,
        }
      })

    return {
      jadwalId: j.id,
      tanggalISO,
      hari,
      tanggalTampil,
      posyanduId: j.posyandu.id,
      namaPosyandu: j.posyandu.namaPosyandu,
      sesi,
    }
  }).filter((j) => j.sesi.length > 0)

  await saveRegistrationState(wargaId, {
    requestedDate,
    requestedLabel,
    lastSlots: slots,
    selectedSlotId: undefined,
    selectedSlotLabel: undefined,
    selectedSlot: undefined,
    selectedBalitaId: undefined,
    selectedBalitaName: undefined,
    confirmationPending: false,
  })

  return { requestedDate, requestedLabel, isExactMatch, fallbackReason, jadwal, slots }
}
async function getProfilBalita(wargaId: string): Promise<AssistantBalitaState[]> {
  const balita = await prisma.balita.findMany({
    where: { wargaId },
    select: { id: true, namaBalita: true, tanggalLahir: true, jenisKelamin: true },
    orderBy: { namaBalita: 'asc' },
  })

  const lastBalita = balita.map((b, index) => ({
    nomor: index + 1,
    balitaId: b.id,
    nama: b.namaBalita,
  }))
  await saveRegistrationState(wargaId, { lastBalita })

  return lastBalita
}

function formatScheduleReply(result: JadwalResult): string {
  if (result.slots.length === 0 || result.jadwal.length === 0) {
    return `Tidak ada jadwal ${result.requestedLabel} atau slot yang masih tersedia. Silakan coba tanggal lain.`
  }

  const lines: string[] = []
  if (!result.isExactMatch) {
    lines.push(`Tidak ada jadwal ${result.requestedLabel}. Jadwal terdekat yang tersedia adalah:`)
  } else {
    lines.push('Berikut jadwal posyandu yang tersedia:')
  }
  lines.push('')

  for (const jadwal of result.jadwal) {
    lines.push(`${jadwal.tanggalTampil} - ${jadwal.namaPosyandu}`)
    for (const sesi of jadwal.sesi) {
      lines.push(`${sesi.nomor}. ${sesi.sesiLabel}: ${sesi.jamMulai}-${sesi.jamSelesai} (${sesi.tersedia} slot tersisa)`)
    }
    lines.push('')
  }

  lines.push('Silakan pilih sesi yang Anda inginkan, misalnya: sesi 4.')
  return lines.join('\n').trim()
}

function formatBalitaListReply(slot: AssistantSlotState, balita: AssistantBalitaState[]): string {
  if (balita.length === 0) return 'Tidak ada balita yang terdaftar di akun Anda.'

  const lines = [
    `Sesi dipilih: ${slot.sesiLabel} di ${slot.namaPosyandu}, ${slot.tanggalTampil} (${slot.jamMulai}-${slot.jamSelesai}).`,
    '',
    'Silakan pilih balita:',
    ...balita.map((b) => `${b.nomor}. ${b.nama}`),
  ]
  return lines.join('\n')
}

function formatRegistrationSummary(slot: AssistantSlotState, balitaName: string): string {
  return [
    'Ringkasan Pendaftaran:',
    `- Posyandu: ${slot.namaPosyandu}`,
    `- Tanggal: ${slot.tanggalTampil}`,
    `- Sesi: ${slot.sesiLabel} (${slot.jamMulai}-${slot.jamSelesai})`,
    `- Balita: ${balitaName}`,
    '- Estimasi tunggu: akan dihitung setelah nomor antrian dibuat',
    '',
    'Apakah Anda setuju untuk mendaftar?',
  ].join('\n')
}

function formatSuccessReply(result: Awaited<ReturnType<typeof ambilAntrian>>): string {
  return [
    'Pendaftaran antrian berhasil.',
    '',
    `- Nomor antrian: ${result.nomorUrut}`,
    `- Posyandu: ${result.namaPosyandu}`,
    `- Tanggal: ${result.tanggalPelaksanaan}`,
    `- Sesi: ${result.labelSesi}`,
    `- Estimasi tunggu: sekitar ${result.estimasiMenit} menit`,
    '- Status: menunggu',
  ].join('\n')
}

function formatToolError(err: { message?: string; code?: string }): string {
  switch (err.code) {
    case 'SLOT_TIDAK_DITEMUKAN':
      return 'Slot tidak ditemukan. Silakan pilih ulang sesi yang tersedia.'
    case 'SLOT_PENUH':
      return 'Slot yang dipilih sudah penuh. Silakan pilih sesi lain.'
    case 'ANTRIAN_AKTIF':
      return 'Balita sudah memiliki antrian aktif pada jadwal ini.'
    case 'SUDAH_DAFTAR':
      return 'Balita sudah terdaftar di sesi ini.'
    default:
      return err.message ?? 'Terjadi kesalahan server saat mendaftarkan antrian.'
  }
}

async function persistAssistantTurn(
  wargaId: string,
  userMessage: string,
  clientHistory: Array<{ role: string; content: string }>,
  reply: string
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
  await prisma.riwayatChat.createMany({
    data: [
      { wargaId, role: 'user', pesan: userMessage },
      { wargaId, role: 'assistant', pesan: reply },
    ],
  })

  return {
    reply,
    messages: [
      ...clientHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: reply },
    ],
  }
}

async function handleScheduleRequest(
  wargaId: string,
  userMessage: string,
  clientHistory: Array<{ role: string; content: string }>
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> } | null> {
  if (!isScheduleRequest(userMessage)) return null
  const relative = resolveRelativeDateFromText(userMessage)
  if (!relative) return null
  const result = await getJadwalTersedia(wargaId, relative.date, relative.label)
  const reply = 'error' in result ? result.error : formatScheduleReply(result)
  return persistAssistantTurn(wargaId, userMessage, clientHistory, reply)
}

async function handleSlotSelection(
  wargaId: string,
  userMessage: string,
  clientHistory: Array<{ role: string; content: string }>
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> } | null> {
  const state = await getRegistrationState(wargaId)
  if (!state.lastSlots?.length || state.selectedSlotId) return null

  const nomor = parseNumberChoice(userMessage)
  if (!nomor) return null
  const selectedSlot = state.lastSlots.find((slot) => slot.nomor === nomor)
  if (!selectedSlot || selectedSlot.tersedia <= 0) {
    return persistAssistantTurn(
      wargaId,
      userMessage,
      clientHistory,
      'Sesi tersebut tidak tersedia. Silakan pilih salah satu sesi yang tersedia.'
    )
  }

  const balita = await getProfilBalita(wargaId)
  if (balita.length === 0) {
    return persistAssistantTurn(wargaId, userMessage, clientHistory, 'Tidak ada balita yang terdaftar di akun Anda.')
  }

  if (balita.length === 1) {
    await saveRegistrationState(wargaId, {
      selectedSlotId: selectedSlot.slotId,
      selectedSlotLabel: selectedSlot.sesiLabel,
      selectedSlot,
      selectedBalitaId: balita[0].balitaId,
      selectedBalitaName: balita[0].nama,
      confirmationPending: true,
    })
    return persistAssistantTurn(
      wargaId,
      userMessage,
      clientHistory,
      formatRegistrationSummary(selectedSlot, balita[0].nama)
    )
  }

  await saveRegistrationState(wargaId, {
    selectedSlotId: selectedSlot.slotId,
    selectedSlotLabel: selectedSlot.sesiLabel,
    selectedSlot,
    confirmationPending: false,
  })

  return persistAssistantTurn(wargaId, userMessage, clientHistory, formatBalitaListReply(selectedSlot, balita))
}

async function handleBalitaSelection(
  wargaId: string,
  userMessage: string,
  clientHistory: Array<{ role: string; content: string }>
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> } | null> {
  const state = await getRegistrationState(wargaId)
  if (!state.selectedSlot || !state.lastBalita?.length || state.selectedBalitaId) return null

  const normalized = normalizeText(userMessage)
  const nomor = parseNumberChoice(userMessage)
  const selectedBalita = nomor
    ? state.lastBalita.find((b) => b.nomor === nomor)
    : state.lastBalita.find((b) => normalizeText(b.nama).includes(normalized))

  if (!selectedBalita) {
    return persistAssistantTurn(
      wargaId,
      userMessage,
      clientHistory,
      'Balita tersebut tidak ditemukan dalam daftar. Silakan pilih nomor atau nama balita yang tersedia.'
    )
  }

  await saveRegistrationState(wargaId, {
    selectedBalitaId: selectedBalita.balitaId,
    selectedBalitaName: selectedBalita.nama,
    confirmationPending: true,
  })

  return persistAssistantTurn(
    wargaId,
    userMessage,
    clientHistory,
    formatRegistrationSummary(state.selectedSlot, selectedBalita.nama)
  )
}

async function handleRegistrationConfirmation(
  wargaId: string,
  userMessage: string,
  clientHistory: Array<{ role: string; content: string }>
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> } | null> {
  const state = await getRegistrationState(wargaId)
  if (!state.confirmationPending || !isConfirmation(userMessage)) return null

  if (!state.selectedSlotId || !state.selectedBalitaId) {
    return persistAssistantTurn(
      wargaId,
      userMessage,
      clientHistory,
      'Pilihan sesi atau balita belum lengkap. Silakan pilih sesi dan balita terlebih dahulu.'
    )
  }

  const [slot, balita] = await Promise.all([
    prisma.slotSesi.findUnique({
      where: { id: state.selectedSlotId },
      select: {
        id: true,
        kuota: true,
        terisi: true,
        jadwal: { select: { statusJadwal: true } },
      },
    }),
    prisma.balita.findFirst({
      where: { id: state.selectedBalitaId, wargaId },
      select: { id: true },
    }),
  ])

  if (!slot || slot.jadwal.statusJadwal !== 'aktif') {
    return persistAssistantTurn(wargaId, userMessage, clientHistory, 'Slot tidak ditemukan atau tidak aktif. Silakan pilih ulang sesi yang tersedia.')
  }
  if (slot.terisi >= slot.kuota) {
    return persistAssistantTurn(wargaId, userMessage, clientHistory, 'Slot yang dipilih sudah penuh. Silakan pilih sesi lain.')
  }
  if (!balita) {
    return persistAssistantTurn(wargaId, userMessage, clientHistory, 'Balita tidak valid untuk akun Anda. Silakan pilih balita yang terdaftar di akun ini.')
  }

  try {
    const result = await ambilAntrian(state.selectedSlotId, state.selectedBalitaId, wargaId)
    await clearRegistrationState(wargaId)
    return persistAssistantTurn(wargaId, userMessage, clientHistory, formatSuccessReply(result))
  } catch (e) {
    const err = e as { message?: string; code?: string }
    logger.warn({ wargaId, error: err.message, code: err.code }, 'AI deterministic daftar_antrian error')
    await saveRegistrationState(wargaId, { confirmationPending: false })
    return persistAssistantTurn(wargaId, userMessage, clientHistory, formatToolError(err))
  }
}
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
      case 'get_jadwal_tersedia': {
        const result = await getJadwalTersedia(wargaId, args.tanggal, args.tanggal ?? 'tanggal yang diminta')
        return JSON.stringify(result)
      }

      case 'get_profil_balita':
        return JSON.stringify(await getProfilBalita(wargaId))

      case 'daftar_antrian': {
        const state = await getRegistrationState(wargaId)
        if (!state.confirmationPending || !state.selectedSlotId || !state.selectedBalitaId) {
          return JSON.stringify({
            error: 'Pilihan sesi dan balita belum tersimpan. Silakan pilih sesi dan balita terlebih dahulu.',
            code: 'STATE_TIDAK_LENGKAP',
          })
        }
        const result = await ambilAntrian(state.selectedSlotId, state.selectedBalitaId, wargaId)
        await clearRegistrationState(wargaId)
        return JSON.stringify({
          success: true,
          antrianId: result.antrianId,
          nomorUrut: result.nomorUrut,
          estimasiMenit: result.estimasiMenit,
          namaPosyandu: result.namaPosyandu,
          tanggalPelaksanaan: result.tanggalPelaksanaan,
          labelSesi: result.labelSesi,
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
          return JSON.stringify({ error: 'Antrian tidak ditemukan atau bukan milik Anda.', code: 'ANTRIAN_TIDAK_DITEMUKAN' })
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
        return JSON.stringify({ error: 'Unknown tool', code: 'UNKNOWN_TOOL' })
    }
  } catch (err) {
    const e = err as { message?: string; code?: string }
    logger.warn({ toolName, error: e.message, code: e.code }, 'executeToolCall error')
    return JSON.stringify({ error: e.message ?? 'Tool execution failed', code: e.code ?? 'UNKNOWN' })
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

  const deterministicReply =
    (await handleRegistrationConfirmation(wargaId, userMessage, clientHistory)) ??
    (await handleBalitaSelection(wargaId, userMessage, clientHistory)) ??
    (await handleSlotSelection(wargaId, userMessage, clientHistory)) ??
    (await handleScheduleRequest(wargaId, userMessage, clientHistory))

  if (deterministicReply) return deterministicReply

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
  const todayISO = isoDateInWIB()
  const runtimeContext =
    `Tanggal hari ini dalam zona waktu Asia/Jakarta adalah ${formatTanggalWIB(todayISO).tanggalTampil} (${todayISO}). ` +
    `Besok adalah ${formatTanggalWIB(addDaysISO(todayISO, 1)).tanggalTampil} (${addDaysISO(todayISO, 1)}). ` +
    `Lusa adalah ${formatTanggalWIB(addDaysISO(todayISO, 2)).tanggalTampil} (${addDaysISO(todayISO, 2)}).`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    { role: 'system', content: runtimeContext },
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
