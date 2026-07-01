/**
 * growth.service.ts — Business logic for Pemeriksaan (Meja 2: Timbang/Ukur)
 *
 * Security (CLAUDE.md §Keamanan):
 *   - catatanKonsultasi WAJIB dienkripsi sebelum simpan (UU PDP No. 27/2022)
 *   - AuditLog WAJIB ditulis dalam transaksi yang sama dengan pemeriksaan.create/update
 *   - catatanKonsultasi dan rekomendasiAi TIDAK boleh masuk ke dataSesudah AuditLog
 *
 * Z-Score (CLAUDE.md §Z-Score WHO):
 *   - Selalu gunakan tabel LMS dari who-growth-tables.json via computeZScore()
 *   - Formula: Z = ((nilai/M)^L - 1) / (L × S)
 *   - Nilai Z-Score dari request body diabaikan (computed server-side)
 */
import pino from 'pino'
import type { IncomingHttpHeaders } from 'http'
import { prisma } from '../../config/db'
import { env } from '../../config/env'
import { encrypt } from '../../shared/utils/encrypt'
import { computeZScore, ageInMonths, determineStatusGizi } from '../../shared/utils/zscore'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Input types ───────────────────────────────────────────────────────────

export interface CreatePemeriksaanInput {
  antrianId?: string
  balitaId: string
  beratBadan: number
  tinggiBadan?: number
  lingkarKepala?: number
  lingkarLengan?: number
  catatanKonsultasi?: string
}

export interface RequestMeta {
  headers: IncomingHttpHeaders
  ip?: string
}

// ── createPemeriksaan ─────────────────────────────────────────────────────

/**
 * createPemeriksaan — Simpan data timbang/ukur balita dengan Z-Score dan AuditLog.
 *
 * Alur:
 *   1. Fetch balita (jenisKelamin, tanggalLahir)
 *   2. Validasi biologis BB (> 30 kg perlu konfirmasi eksplisit)
 *   3. Hitung Z-Score dari tabel WHO 2006
 *   4. Tentukan statusGizi
 *   5. Enkripsi catatanKonsultasi (jika ada)
 *   6. Prisma $transaction: pemeriksaan.create + auditLog.create (WAJIB bersamaan)
 *
 * @param data       Input dari CreatePemeriksaanSchema
 * @param kaderId    ID kader dari JWT (req.user.userId)
 * @param meta       { headers, ip } untuk AuditLog dan konfirmasi biologis
 */
export async function createPemeriksaan(
  data: CreatePemeriksaanInput,
  kaderId: string,
  meta: RequestMeta
): Promise<ReturnType<typeof buildPemeriksaanResponse>> {
  // 1. Fetch balita
  const balita = await prisma.balita.findUnique({
    where: { id: data.balitaId },
    select: { jenisKelamin: true, tanggalLahir: true },
  })
  if (!balita) {
    throw Object.assign(new Error('Balita tidak ditemukan'), { code: 'BALITA_TIDAK_DITEMUKAN' })
  }

  // 2. Validasi biologis — BB > 30 kg memerlukan konfirmasi eksplisit kader
  //    (T-03-02-01 in threat model: client-provided BB can be extreme)
  if (data.beratBadan > 30 && meta.headers['x-konfirmasi-biologis'] !== 'true') {
    throw Object.assign(
      new Error('Berat badan tidak wajar (> 30 kg). Konfirmasi diperlukan sebelum menyimpan.'),
      { code: 'VALIDASI_BIOLOGIS_PERLU_KONFIRMASI' }
    )
  }

  // 3. Hitung usia dan Z-Score dari tabel WHO 2006 (CLAUDE.md §Z-Score WHO)
  //    JANGAN gunakan nilai Z-Score dari request body — hitung ulang di sini
  const now = new Date()
  const months = ageInMonths(new Date(balita.tanggalLahir), now)
  const sex = balita.jenisKelamin // 'laki_laki' | 'perempuan'

  // WAZ: Weight-for-Age — berat kg vs usia bulan
  const zScoreBbU = computeZScore('wfa', sex, months, data.beratBadan)

  // HAZ: Height-for-Age — tinggi cm vs usia bulan
  const zScoreTbU =
    data.tinggiBadan !== undefined
      ? computeZScore('lhfa', sex, months, data.tinggiBadan)
      : null

  // WHZ: Weight-for-Height — berat kg vs tinggi cm (tinggi = lookup key untuk wfl)
  const zScoreBbTb =
    data.tinggiBadan !== undefined
      ? computeZScore('wfl', sex, data.tinggiBadan, data.beratBadan)
      : null

  // 4. Tentukan statusGizi berdasarkan Z-Score
  const statusGizi = determineStatusGizi(zScoreBbU, zScoreTbU, zScoreBbTb)

  // 5. Enkripsi catatanKonsultasi (WAJIB — UU PDP No. 27/2022)
  const catatanKonsultasiEnc = data.catatanKonsultasi ? encrypt(data.catatanKonsultasi) : null

  // 6. Transaction: pemeriksaan.create + auditLog.create (WAJIB bersamaan — CLAUDE.md §Keamanan)
  const pemeriksaan = await prisma.$transaction(async (tx) => {
    const record = await tx.pemeriksaan.create({
      data: {
        balitaId: data.balitaId,
        antrianId: data.antrianId ?? null,
        kaderId,
        beratBadan: data.beratBadan,
        tinggiBadan: data.tinggiBadan ?? null,
        lingkarKepala: data.lingkarKepala ?? null,
        lingkarLengan: data.lingkarLengan ?? null,
        zScoreBbU,
        zScoreTbU,
        zScoreBbTb,
        statusGizi,
        catatanKonsultasi: catatanKonsultasiEnc, // Stored encrypted (UU PDP)
      },
    })

    // AuditLog — JANGAN masukkan catatanKonsultasi/rekomendasiAi ke dataSesudah
    await tx.auditLog.create({
      data: {
        userId: kaderId,
        userRole: 'kader',
        aksi: 'CREATE_PEMERIKSAAN',
        tabelTerkait: 'pemeriksaan',
        recordId: record.id,
        dataSebelum: null,
        dataSesudah: {
          beratBadan: data.beratBadan,
          tinggiBadan: data.tinggiBadan ?? null,
          lingkarKepala: data.lingkarKepala ?? null,
          lingkarLengan: data.lingkarLengan ?? null,
          zScoreBbU,
          zScoreTbU,
          zScoreBbTb,
          statusGizi,
        },
        ipAddress: meta.ip ?? null,
        userAgent: (meta.headers['user-agent'] as string | undefined) ?? null,
      },
    })

    return record
  })

  logger.info({ pemeriksaanId: pemeriksaan.id, kaderId }, 'Pemeriksaan berhasil disimpan')

  return buildPemeriksaanResponse(pemeriksaan, data.catatanKonsultasi)
}

/** Return decrypted catatanKonsultasi in API response (encrypted only in DB) */
function buildPemeriksaanResponse(
  pemeriksaan: {
    id: string
    balitaId: string
    kaderId: string | null
    beratBadan: number | null
    [key: string]: unknown
  },
  catatanKonsultasiPlain?: string
) {
  return {
    ...pemeriksaan,
    catatanKonsultasi: catatanKonsultasiPlain ?? null,
  }
}

// ── getPemeriksaanHistory ─────────────────────────────────────────────────

/**
 * getPemeriksaanHistory — Riwayat pemeriksaan balita untuk grafik Z-Score (Meja 3).
 *
 * Note: catatanKonsultasi dan rekomendasiAi TIDAK dikembalikan (encrypted fields,
 * tidak dibutuhkan untuk chart — hanya ditampilkan di Meja 4 detail view).
 *
 * @param balitaId  ID balita
 */
export async function getPemeriksaanHistory(balitaId: string) {
  return prisma.pemeriksaan.findMany({
    where: { balitaId },
    orderBy: { tanggalPemeriksaan: 'asc' },
    select: {
      id: true,
      tanggalPemeriksaan: true,
      beratBadan: true,
      tinggiBadan: true,
      lingkarKepala: true,
      lingkarLengan: true,
      zScoreBbU: true,
      zScoreTbU: true,
      zScoreBbTb: true,
      statusGizi: true,
      statusGiziOverride: true,
      // catatanKonsultasi dan rekomendasiAi: TIDAK — encrypted, tidak untuk chart
    },
  })
}
