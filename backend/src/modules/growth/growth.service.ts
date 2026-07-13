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
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/db'
import { env } from '../../config/env'
import { encrypt, decrypt } from '../../shared/utils/encrypt'
import { computeZScore, ageInMonths, determineStatusGizi } from '../../shared/utils/zscore'
import { broadcastQueueUpdate } from '../antrian/antrian.service'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

function decryptNullable(value: string | null): string | null {
  if (!value) return null
  try {
    return decrypt(value)
  } catch (err) {
    logger.warn({ err }, 'Gagal decrypt field konsultasi pemeriksaan')
    return null
  }
}

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

  // 1b. Cegah duplikasi pemeriksaan: antrianId yang sama tidak boleh punya >1 pemeriksaan
  if (data.antrianId) {
    const existing = await prisma.pemeriksaan.findFirst({
      where: { antrianId: data.antrianId, beratBadan: { not: null } },
      select: { id: true },
    })
    if (existing) {
      throw Object.assign(
        new Error('Pemeriksaan untuk antrian ini sudah ada. Gunakan data yang sudah disimpan.'),
        { code: 'PEMERIKSAAN_SUDAH_ADA' }
      )
    }
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

  // 6. Transaction: pemeriksaan.create + auditLog.create + statusAntrian update (WAJIB bersamaan)
  let slotIdForBroadcast: string | null = null
  const pemeriksaan = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
        dataSebelum: Prisma.JsonNull,
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

    // Update statusAntrian → sedang_dilayani setelah BB/TB berhasil disimpan
    if (data.antrianId) {
      const updated = await tx.antrian.update({
        where: { id: data.antrianId },
        data: { statusAntrian: 'sedang_dilayani' },
        select: { slotId: true },
      })
      slotIdForBroadcast = updated.slotId
    }

    return record
  })

  // Broadcast WAJIB di luar transaksi (CLAUDE.md §Antrian)
  if (slotIdForBroadcast) void broadcastQueueUpdate(slotIdForBroadcast)

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

// ── updatePemeriksaan ─────────────────────────────────────────────────────

/**
 * UpdatePemeriksaanInput — partial update untuk Meja 3 (tanda klinis) dan Meja 4 (rekomendasiAi)
 *
 * Security (T-03-05-01, T-03-05-04):
 *   - IDOR guard: verifikasi pemeriksaan.antrian.slotSesi.jadwal.posyanduId === kader.posyanduId
 *   - rekomendasiAi dan catatanKonsultasi WAJIB dienkripsi sebelum simpan
 *   - AuditLog.dataSesudah TIDAK boleh menyertakan rekomendasiAi/catatanKonsultasi (enkripsi PDP)
 */
export interface UpdatePemeriksaanInput {
  tandaKlinis?: {
    rambutKemerahan: boolean
    perutBuncit: boolean
    edema: boolean
    pucat: boolean
    lainnya?: string | null
  }
  statusGiziOverride?: string | null
  catatanKlinis?: string
  rekomendasiAi?: string // akan dienkripsi
  catatanKonsultasi?: string // akan dienkripsi
}

export async function updatePemeriksaan(
  pemeriksaanId: string,
  data: UpdatePemeriksaanInput,
  kaderId: string
): Promise<Record<string, unknown>> {
  // 1. Fetch existing pemeriksaan untuk IDOR guard + dataSebelum AuditLog
  const existing = await prisma.pemeriksaan.findUnique({
    where: { id: pemeriksaanId },
    include: {
      antrian: {
        include: {
          slotSesi: {
            include: {
              jadwal: { select: { posyanduId: true } },
            },
          },
        },
      },
    },
  })

  if (!existing) {
    throw Object.assign(new Error('Pemeriksaan tidak ditemukan'), {
      code: 'PEMERIKSAAN_TIDAK_DITEMUKAN',
    })
  }

  // IDOR guard (T-03-05-01): pastikan pemeriksaan milik posyandu kader
  if (existing.antrian) {
    const kader = await prisma.kader.findUnique({
      where: { id: kaderId },
      select: { posyanduId: true },
    })
    const pemPosyanduId = existing.antrian.slotSesi?.jadwal?.posyanduId
    if (kader && pemPosyanduId && kader.posyanduId !== pemPosyanduId) {
      throw Object.assign(new Error('Akses ditolak — pemeriksaan bukan milik posyandu kader'), {
        code: 'AKSES_DITOLAK',
      })
    }
  }

  // 2. Enkripsi field sensitif (WAJIB — UU PDP No. 27/2022)
  const rekomendasiAiEnc = data.rekomendasiAi ? encrypt(data.rekomendasiAi) : undefined
  const catatanKonsultasiEnc = data.catatanKonsultasi ? encrypt(data.catatanKonsultasi) : undefined

  // 3. Transaction: update pemeriksaan + write AuditLog (WAJIB bersamaan — CLAUDE.md §Keamanan)
  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const record = await tx.pemeriksaan.update({
      where: { id: pemeriksaanId },
      data: {
        ...(data.tandaKlinis !== undefined && { tandaKlinis: data.tandaKlinis }),
        ...(data.statusGiziOverride !== undefined && { statusGiziOverride: (data.statusGiziOverride as unknown) as 'normal' | 'kurang' | 'buruk' | 'lebih' | 'obesitas' | 'pendek' | 'sangat_pendek' | null }),
        ...(data.catatanKlinis !== undefined && { catatanKlinis: data.catatanKlinis }),
        ...(rekomendasiAiEnc !== undefined && { rekomendasiAi: rekomendasiAiEnc }),
        ...(catatanKonsultasiEnc !== undefined && { catatanKonsultasi: catatanKonsultasiEnc }),
      },
    })

    // AuditLog — JANGAN masukkan rekomendasiAi/catatanKonsultasi ke dataSesudah (T-03-05-04)
    await tx.auditLog.create({
      data: {
        userId: kaderId,
        userRole: 'kader',
        aksi: 'UPDATE_PEMERIKSAAN',
        tabelTerkait: 'pemeriksaan',
        recordId: pemeriksaanId,
        dataSebelum: { statusGizi: existing.statusGizi },
        dataSesudah: {
          ...(data.tandaKlinis !== undefined && { tandaKlinis: data.tandaKlinis }),
          ...(data.statusGiziOverride !== undefined && { statusGiziOverride: data.statusGiziOverride }),
          ...(data.catatanKlinis !== undefined && { catatanKlinis: data.catatanKlinis }),
          // TIDAK masukkan rekomendasiAi / catatanKonsultasi
        },
        ipAddress: null,
        userAgent: null,
      },
    })

    return record
  })

  logger.info({ pemeriksaanId, kaderId }, 'Pemeriksaan berhasil diperbarui')

  // Return dengan dekripsi rekomendasiAi (jika diupdate) di response
  return {
    ...updated,
    rekomendasiAi: data.rekomendasiAi ?? null,
    catatanKonsultasi: data.catatanKonsultasi ?? null,
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

// ── getCitizenGrowthRiwayat ───────────────────────────────────────────────────

/**
 * getCitizenGrowthRiwayat — Ambil riwayat pemeriksaan balita pertama milik warga
 * (citizen login) dengan semua field Z-Score (BB/U, TB/U, BB/TB) untuk grafik.
 *
 * IDOR-safe: filter via wargaId dari JWT, bukan dari client-supplied balitaId.
 * catatanKonsultasi / rekomendasiAi dikembalikan terdekripsi untuk riwayat warga.
 */
export async function getCitizenGrowthRiwayat(wargaId: string, balitaId?: string): Promise<
  {
    id: string
    tanggalPemeriksaan: string
    beratBadan: number
    tinggiBadan: number
    zScoreBbU: number | null
    zScoreTbU: number | null
    zScoreBbTb: number | null
    statusGizi: string
    catatanKonsultasi: string | null
    rekomendasiAi: string | null
  }[]
> {
  // Jika balitaId disuplai, verifikasi kepemilikan via wargaId (IDOR guard)
  let resolvedBalitaId = balitaId
  if (balitaId) {
    const owned = await prisma.balita.findFirst({ where: { id: balitaId, wargaId }, select: { id: true } })
    resolvedBalitaId = owned?.id
  }
  if (!resolvedBalitaId) {
    // fallback: balita pertama milik warga
    const balita = await prisma.balita.findFirst({ where: { wargaId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    if (!balita) return []
    resolvedBalitaId = balita.id
  }

  const records = await prisma.pemeriksaan.findMany({
    where: { balitaId: resolvedBalitaId },
    orderBy: { tanggalPemeriksaan: 'desc' },
    select: {
      id: true,
      tanggalPemeriksaan: true,
      beratBadan: true,
      tinggiBadan: true,
      zScoreBbU: true,
      zScoreTbU: true,
      zScoreBbTb: true,
      statusGizi: true,
      statusGiziOverride: true,
      catatanKonsultasi: true,
      rekomendasiAi: true,
    },
  })

  return records.map((r) => ({
    id: r.id,
    tanggalPemeriksaan: r.tanggalPemeriksaan.toISOString(),
    beratBadan: r.beratBadan ?? 0,
    tinggiBadan: r.tinggiBadan ?? 0,
    zScoreBbU: r.zScoreBbU ?? null,
    zScoreTbU: r.zScoreTbU ?? null,
    zScoreBbTb: r.zScoreBbTb ?? null,
    statusGizi: (r.statusGiziOverride ?? r.statusGizi ?? 'normal') as string,
    catatanKonsultasi: decryptNullable(r.catatanKonsultasi),
    rekomendasiAi: decryptNullable(r.rekomendasiAi),
  }))
}

// ── getRiwayatForCitizen ──────────────────────────────────────────────────────

/**
 * getRiwayatForCitizen — Ambil semua riwayat pemeriksaan untuk semua balita
 * milik warga yang sedang login (citizen role).
 *
 * Digunakan oleh GET /api/growth/riwayat.
 * Mengekspos catatanKonsultasi/rekomendasiAi terdekripsi untuk riwayat konsultasi warga.
 */
export async function getRiwayatForCitizen(wargaId: string): Promise<
  {
    id: string
    createdAt: string
    tanggalPemeriksaan: string | null
    beratBadan: number
    tinggiBadan: number
    zScore: number
    zScoreBbU: number | null
    zScoreTbU: number | null
    zScoreBbTb: number | null
    statusGizi: string
    catatanKonsultasi: string | null
    rekomendasiAi: string | null
  }[]
> {
  const records = await prisma.pemeriksaan.findMany({
    where: { balita: { wargaId } },
    select: {
      id: true,
      createdAt: true,
      tanggalPemeriksaan: true,
      beratBadan: true,
      tinggiBadan: true,
      zScoreBbU: true,
      zScoreTbU: true,
      zScoreBbTb: true,
      statusGizi: true,
      statusGiziOverride: true,
      catatanKonsultasi: true,
      rekomendasiAi: true,
    },
    orderBy: { tanggalPemeriksaan: 'desc' },
  })

  return records.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    tanggalPemeriksaan: r.tanggalPemeriksaan ? r.tanggalPemeriksaan.toISOString() : null,
    beratBadan: r.beratBadan ?? 0,
    tinggiBadan: r.tinggiBadan ?? 0,
    zScore: r.zScoreBbU ?? 0,
    zScoreBbU: r.zScoreBbU ?? null,
    zScoreTbU: r.zScoreTbU ?? null,
    zScoreBbTb: r.zScoreBbTb ?? null,
    statusGizi: (r.statusGiziOverride ?? r.statusGizi ?? 'normal') as string,
    catatanKonsultasi: decryptNullable(r.catatanKonsultasi),
    rekomendasiAi: decryptNullable(r.rekomendasiAi),
  }))
}
