/**
 * ai.service.ts — GPT-4o Early Warning generation (Meja 4)
 *
 * CLAUDE.md §AI Early Warning: OpenAI GPT-4o, temperature 0.6
 * CLAUDE.md §Keamanan: rekomendasiAi disimpan encrypted
 *
 * Security (T-03-06-02, T-03-06-03):
 *   - OPENAI_API_KEY hanya ada di server — tidak pernah ke browser
 *   - namaBalita dari DB (bukan raw body) — prompt injection risk minimal
 *   - System prompt hardcoded server-side
 *   - Tidak ada function calling di early-warning — hanya text response (JSON)
 */
import pino from 'pino'
import { env } from '../../config/env'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Types ─────────────────────────────────────────────────────────────────

export interface EarlyWarningInput {
  namaBalita: string
  usiaBulan: number
  jenisKelamin: 'laki_laki' | 'perempuan'
  beratBadan: number | null
  tinggiBadan: number | null
  zScoreBbU: number | null
  zScoreTbU: number | null
  zScoreBbTb: number | null
  statusGizi: string | null
  tandaKlinis: {
    rambutKemerahan: boolean
    perutBuncit: boolean
    edema: boolean
    pucat: boolean
    lainnya?: string | null
  }
}

export interface EarlyWarningResult {
  level: 'normal' | 'waspada' | 'kritis'
  ringkasan: string
  rekomendasi: string
}

// ── generateEarlyWarning ──────────────────────────────────────────────────

/**
 * generateEarlyWarning — GPT-4o analysis of growth data and clinical signs.
 *
 * Graceful degradation: jika OPENAI_API_KEY tidak di-set, kembalikan stub agar
 * development bisa berlanjut tanpa API key.
 *
 * @param input  Data pertumbuhan balita + tanda klinis dari Meja 2 & 3
 * @returns      { level: 'normal'|'waspada'|'kritis', ringkasan, rekomendasi }
 */
export async function generateEarlyWarning(input: EarlyWarningInput): Promise<EarlyWarningResult> {
  // Graceful degradation saat env belum dikonfigurasi
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set — AI early warning disabled')
    return {
      level: 'normal',
      ringkasan: '[AI tidak tersedia — konfigurasi OPENAI_API_KEY diperlukan]',
      rekomendasi: '[Konfigurasi OPENAI_API_KEY untuk mengaktifkan fitur early warning]',
    }
  }

  // Lazy import untuk menghindari error jika tidak ada API key
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Build tanda klinis string
  const tandaKlinisList = [
    input.tandaKlinis.rambutKemerahan && 'Rambut kemerahan/kusam',
    input.tandaKlinis.perutBuncit && 'Perut buncit',
    input.tandaKlinis.edema && 'Edema (bengkak kaki/tangan)',
    input.tandaKlinis.pucat && 'Pucat/anemia',
  ]
    .filter(Boolean)
    .join(', ')

  // System prompt — hardcoded server-side (T-03-06-02)
  const systemPrompt = `Anda adalah sistem peringatan dini stunting untuk kader Posyandu Indonesia.
Tugas Anda: analisis data pertumbuhan balita dan berikan early warning dalam Bahasa Indonesia yang sopan dan mudah dipahami kader.
Hanya jawab pertanyaan terkait kesehatan gizi dan pertumbuhan balita.
Respons HARUS berupa JSON dengan format: { "level": "normal|waspada|kritis", "ringkasan": "...", "rekomendasi": "..." }
- level "normal": semua Z-Score antara -2 dan +2, tidak ada tanda klinis berarti
- level "waspada": salah satu Z-Score antara -3 dan -2, atau ada tanda klinis
- level "kritis": Z-Score < -3 pada indikator manapun, atau edema positif`

  // User prompt — namaBalita dari DB bukan raw request (T-03-06-02)
  const userPrompt = `Data balita:
- Nama: ${input.namaBalita} (${input.usiaBulan} bulan, ${input.jenisKelamin === 'laki_laki' ? 'Laki-laki' : 'Perempuan'})
- BB: ${input.beratBadan ?? 'tidak tersedia'} kg, TB: ${input.tinggiBadan ?? 'tidak tersedia'} cm
- Z-Score BB/U: ${input.zScoreBbU !== null ? input.zScoreBbU.toFixed(2) : 'tidak tersedia'}
- Z-Score TB/U: ${input.zScoreTbU !== null ? input.zScoreTbU.toFixed(2) : 'tidak tersedia'}
- Z-Score BB/TB: ${input.zScoreBbTb !== null ? input.zScoreBbTb.toFixed(2) : 'tidak tersedia'}
- Status Gizi Saat Ini: ${input.statusGizi ?? 'tidak tersedia'}
- Tanda Klinis: ${tandaKlinisList || 'tidak ada'}${input.tandaKlinis.lainnya ? `\n- Tanda Lainnya: ${input.tandaKlinis.lainnya}` : ''}

Berikan early warning analysis.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.6, // CLAUDE.md §AI Early Warning
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content ?? '{}'

  let parsed: EarlyWarningResult
  try {
    parsed = JSON.parse(content) as EarlyWarningResult

    // Validasi level enum
    const validLevels = ['normal', 'waspada', 'kritis']
    if (!validLevels.includes(parsed.level)) {
      parsed.level = 'normal'
    }
  } catch {
    logger.error({ content }, 'Failed to parse OpenAI response as JSON')
    return {
      level: 'normal',
      ringkasan: 'Gagal memparse respons AI.',
      rekomendasi: 'Silakan coba generate ulang atau input catatan secara manual.',
    }
  }

  logger.info({ level: parsed.level, namaBalita: input.namaBalita }, 'AI early warning generated')

  return parsed
}
