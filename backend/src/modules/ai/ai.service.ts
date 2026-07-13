/**
 * ai.service.ts - GPT-4o Early Warning generation (Meja 4)
 *
 * Security:
 *   - OPENAI_API_KEY hanya ada di server, tidak pernah ke browser
 *   - namaBalita dari DB, bukan raw body
 *   - System prompt hardcoded server-side
 *   - rekomendasiAi disimpan encrypted oleh growth.service
 */
import pino from 'pino'
import { env } from '../../config/env'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

export interface EarlyWarningInput {
  namaBalita: string
  usiaBulan: number
  jenisKelamin: 'laki_laki' | 'perempuan'
  tanggalPemeriksaan?: string | null
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
  detailAnalisis?: string
  halPerluDikonfirmasi?: string
  tindakLanjut?: string
  kalimatUntukIbu?: string
}

export interface ConsultationSummaryInput {
  transcript: string
  namaBalita?: string
  tanggalPemeriksaan?: string | null
  beratBadan?: number | null
  tinggiBadan?: number | null
  zScoreTbU?: number | null
  zScoreBbTb?: number | null
}

function formatRiskLevel(input: EarlyWarningInput): EarlyWarningResult['level'] {
  const hasCriticalZ = [input.zScoreBbU, input.zScoreTbU, input.zScoreBbTb].some((z) => z !== null && z < -3)
  const hasWarningZ = [input.zScoreBbU, input.zScoreTbU, input.zScoreBbTb].some((z) => z !== null && z < -2)
  if (hasCriticalZ || input.tandaKlinis.edema) return 'kritis'
  if (hasWarningZ || input.tandaKlinis.rambutKemerahan || input.tandaKlinis.perutBuncit || input.tandaKlinis.pucat || !!input.tandaKlinis.lainnya) return 'waspada'
  return 'normal'
}

function fallbackEarlyWarning(input: EarlyWarningInput): EarlyWarningResult {
  const level = formatRiskLevel(input)
  return {
    level,
    ringkasan: 'AI tidak tersedia. Data pemeriksaan sudah diterima, tetapi analisis otomatis belum dapat dibuat.',
    rekomendasi: 'Gunakan z-score TB/U untuk menilai risiko stunting dan BB/TB untuk menilai wasting, gizi lebih, atau obesitas. Konfirmasi pola makan, riwayat sakit, dan pantau ulang bulan depan.',
    detailAnalisis: `Data hari ini: BB ${input.beratBadan ?? 'tidak tersedia'} kg, TB/PB ${input.tinggiBadan ?? 'tidak tersedia'} cm, zScore TB/U ${input.zScoreTbU ?? 'tidak tersedia'}, zScore BB/TB ${input.zScoreBbTb ?? 'tidak tersedia'}.`,
    halPerluDikonfirmasi: 'Tanyakan asupan makan 24 jam terakhir, frekuensi protein hewani, riwayat sakit/diare/batuk lama, nafsu makan, dan kendala pemberian makan.',
    tindakLanjut: 'Catat hasil konseling, berikan edukasi sesuai masalah utama, dan anjurkan kontrol rutin Posyandu bulan berikutnya atau konsultasi Puskesmas bila ada tanda risiko.',
    kalimatUntukIbu: 'Bu, hasil hari ini perlu kita pantau bersama. Kita lihat pola makan dan pertumbuhan bulan depan agar anak tetap tumbuh optimal.',
  }
}

export async function generateEarlyWarning(input: EarlyWarningInput): Promise<EarlyWarningResult> {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set - AI early warning disabled')
    return fallbackEarlyWarning(input)
  }

  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const tandaKlinisList = [
    input.tandaKlinis.rambutKemerahan && 'Rambut kemerahan/kusam',
    input.tandaKlinis.perutBuncit && 'Perut buncit',
    input.tandaKlinis.edema && 'Edema/bengkak kaki atau tangan',
    input.tandaKlinis.pucat && 'Pucat/anemia',
  ].filter(Boolean).join(', ')

  const systemPrompt = `Anda adalah asisten early warning gizi balita untuk bidan, dokter, dan kader Posyandu Indonesia.
Tugas: analisis data pemeriksaan hari pelayanan dan berikan panduan praktis. Jangan membuat diagnosis final medis.
Gunakan TB/U untuk risiko stunting, BB/TB untuk wasting/gizi kurang/gizi lebih/obesitas, dan BB/U hanya sebagai indikator tambahan.
Jangan mengarang angka. Jika data kurang, sebutkan data yang kurang.

Respons HARUS JSON valid dengan format:
{
  "level": "normal|waspada|kritis",
  "ringkasan": "Status Risiko dan ringkasan utama",
  "rekomendasi": "Rekomendasi konseling utama",
  "detailAnalisis": "Bagian terstruktur: Ringkasan Data Hari Ini dan Interpretasi Indikator",
  "halPerluDikonfirmasi": "Pertanyaan yang perlu ditanyakan ke ibu",
  "tindakLanjut": "Tindak lanjut dan pemantauan bulan berikutnya",
  "kalimatUntukIbu": "Kalimat sederhana, empatik, non-menghakimi untuk ibu"
}

Kategori risiko:
- normal: indikator utama normal dan tidak ada tanda klinis bermakna
- waspada: z-score antara -3 sampai < -2, z-score BB/TB > 1, atau ada tanda klinis yang perlu dikonfirmasi
- kritis: z-score < -3, edema, atau kombinasi masalah yang perlu konsultasi Puskesmas segera

Buat jawaban cukup lengkap, praktis, dan membantu keputusan hari itu.`

  const userPrompt = `Data balita:
- Nama: ${input.namaBalita}
- Umur: ${input.usiaBulan} bulan
- Jenis kelamin: ${input.jenisKelamin === 'laki_laki' ? 'Laki-laki' : 'Perempuan'}
- Tanggal pemeriksaan: ${input.tanggalPemeriksaan ?? 'tidak tersedia'}
- BB: ${input.beratBadan ?? 'tidak tersedia'} kg
- TB/PB: ${input.tinggiBadan ?? 'tidak tersedia'} cm
- Z-Score BB/U: ${input.zScoreBbU !== null ? input.zScoreBbU.toFixed(2) : 'tidak tersedia'}
- Z-Score TB/U: ${input.zScoreTbU !== null ? input.zScoreTbU.toFixed(2) : 'tidak tersedia'}
- Z-Score BB/TB: ${input.zScoreBbTb !== null ? input.zScoreBbTb.toFixed(2) : 'tidak tersedia'}
- Status legacy bila ada: ${input.statusGizi ?? 'tidak tersedia'}
- Tanda klinis: ${tandaKlinisList || 'tidak ada'}${input.tandaKlinis.lainnya ? `\n- Tanda lainnya: ${input.tandaKlinis.lainnya}` : ''}

Susun analisis dengan bagian: Status Risiko, Ringkasan Data Hari Ini, Interpretasi Indikator, Hal yang Perlu Dikonfirmasi ke Ibu, Rekomendasi Konseling, Tindak Lanjut, Kalimat Sederhana untuk Ibu.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.4,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content ?? '{}'

  try {
    const parsed = JSON.parse(content) as EarlyWarningResult
    const validLevels = ['normal', 'waspada', 'kritis']
    if (!validLevels.includes(parsed.level)) parsed.level = formatRiskLevel(input)
    parsed.ringkasan = parsed.ringkasan || 'Analisis berhasil dibuat, tetapi ringkasan kosong.'
    parsed.rekomendasi = parsed.rekomendasi || 'Lanjutkan konseling sesuai data pemeriksaan hari ini.'
    logger.info({ level: parsed.level, namaBalita: input.namaBalita }, 'AI early warning generated')
    return parsed
  } catch {
    logger.error({ content }, 'Failed to parse OpenAI response as JSON')
    return fallbackEarlyWarning(input)
  }
}

export async function summarizeConsultation(input: ConsultationSummaryInput): Promise<string> {
  const transcript = input.transcript.trim()
  if (!transcript) {
    throw Object.assign(new Error('Transkrip konsultasi kosong.'), { code: 'TRANSKRIP_KOSONG' })
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set - consultation summarization disabled')
    return [
      '1. Keluhan utama / hal yang dibahas: Ringkasan otomatis belum tersedia karena AI belum dikonfigurasi.',
      '2. Temuan penting: Gunakan transkrip asli sebagai acuan.',
      '3. Edukasi yang diberikan: Lengkapi manual bila diperlukan.',
      '4. Saran makan/gizi: Lengkapi manual sesuai hasil konseling.',
      '5. Rencana tindak lanjut: Pantau kembali pada kunjungan berikutnya.',
      '6. Catatan untuk kunjungan berikutnya: Periksa ulang pertumbuhan dan keluhan ibu.',
    ].join('\n')
  }

  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const context = [
    input.namaBalita && `Balita: ${input.namaBalita}`,
    input.tanggalPemeriksaan && `Tanggal pemeriksaan: ${input.tanggalPemeriksaan}`,
    input.beratBadan !== undefined && `BB: ${input.beratBadan ?? 'tidak tersedia'} kg`,
    input.tinggiBadan !== undefined && `TB/PB: ${input.tinggiBadan ?? 'tidak tersedia'} cm`,
    input.zScoreTbU !== undefined && `zScore TB/U: ${input.zScoreTbU ?? 'tidak tersedia'}`,
    input.zScoreBbTb !== undefined && `zScore BB/TB: ${input.zScoreBbTb ?? 'tidak tersedia'}`,
  ].filter(Boolean).join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 700,
    messages: [
      {
        role: 'system',
        content:
          'Anda membantu kader merangkum percakapan konsultasi Posyandu. Jawab dalam Bahasa Indonesia sederhana untuk ibu balita. Jangan mengarang fakta yang tidak ada di transkrip. Gunakan format bernomor 1 sampai 6 sesuai instruksi.',
      },
      {
        role: 'user',
        content:
          `Konteks pemeriksaan:\n${context || 'Tidak ada konteks tambahan.'}\n\n` +
          `Transkrip asli:\n${transcript}\n\n` +
          'Buat rangkuman dengan format:\n' +
          '1. Keluhan utama / hal yang dibahas\n' +
          '2. Temuan penting\n' +
          '3. Edukasi yang diberikan\n' +
          '4. Saran makan/gizi\n' +
          '5. Rencana tindak lanjut\n' +
          '6. Catatan untuk kunjungan berikutnya',
      },
    ],
  })

  return response.choices[0]?.message?.content?.trim() || 'Rangkuman tidak tersedia. Silakan coba lagi.'
}