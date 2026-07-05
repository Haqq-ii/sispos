import type { Response } from 'express'
import { z } from 'zod'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { createPemeriksaan, getPemeriksaanHistory, updatePemeriksaan, getRiwayatForCitizen, getCitizenGrowthRiwayat } from './growth.service'

const CreatePemeriksaanSchema = z.object({
  antrianId: z.string().uuid().optional(),
  balitaId: z.string().uuid({ message: 'balitaId wajib diisi dan harus berupa UUID' }),
  beratBadan: z.number({ required_error: 'beratBadan wajib diisi' }).positive().max(100, { message: 'Berat badan tidak valid (maks 100 kg)' }),
  tinggiBadan: z.number().positive().max(200, { message: 'Tinggi badan tidak valid (maks 200 cm)' }).optional(),
  lingkarKepala: z.number().positive().optional(),
  lingkarLengan: z.number().positive().optional(),
  catatanKonsultasi: z.string().optional(),
})

// UpdatePemeriksaanSchema — semua field optional (partial update Meja 3 + Meja 4)
const UpdatePemeriksaanSchema = z.object({
  tandaKlinis: z
    .object({
      rambutKemerahan: z.boolean(),
      perutBuncit: z.boolean(),
      edema: z.boolean(),
      pucat: z.boolean(),
      lainnya: z.string().nullable().optional(),
    })
    .optional(),
  statusGiziOverride: z
    .enum(['normal', 'kurang', 'buruk', 'lebih', 'obesitas', 'pendek', 'sangat_pendek'])
    .nullable()
    .optional(),
  catatanKlinis: z.string().optional(),
  rekomendasiAi: z.string().optional(), // akan dienkripsi sebelum simpan
  catatanKonsultasi: z.string().optional(), // akan dienkripsi sebelum simpan
})

const ERROR_MAP: Record<string, number> = {
  BALITA_TIDAK_DITEMUKAN: 404,
  ANTRIAN_TIDAK_DITEMUKAN: 404,
  PEMERIKSAAN_TIDAK_DITEMUKAN: 404,
  PEMERIKSAAN_SUDAH_ADA: 409,
  AKSES_DITOLAK: 403,
  VALIDASI_BIOLOGIS_PERLU_KONFIRMASI: 400,
}

function getHttpStatus(code: string | undefined): number {
  return ERROR_MAP[code ?? ''] ?? 500
}

export async function createPemeriksaanHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = CreatePemeriksaanSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }
  try {
    const result = await createPemeriksaan(parsed.data, req.user!.userId, {
      headers: req.headers,
      ip: req.ip,
    })
    res.status(201).json({ success: true, data: result, message: 'Pemeriksaan berhasil disimpan.' })
  } catch (err) {
    const e = err as { code?: string }
    res.status(getHttpStatus(e.code)).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}

export async function getCitizenRiwayatHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId
  try {
    const result = await getCitizenGrowthRiwayat(userId)
    res.json({ success: true, data: result })
  } catch {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.' })
  }
}

export async function getRiwayatCitizenHandler(req: AuthRequest, res: Response): Promise<void> {
  const wargaId = req.user!.userId
  try {
    const data = await getRiwayatForCitizen(wargaId)
    res.status(200).json({ success: true, data, message: 'Riwayat pemeriksaan berhasil diambil.' })
  } catch {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.' })
  }
}

export async function getPemeriksaanHistoryHandler(req: AuthRequest, res: Response): Promise<void> {
  const { balitaId } = req.params
  try {
    const data = await getPemeriksaanHistory(balitaId)
    res.status(200).json({ success: true, data, message: 'Riwayat pemeriksaan berhasil diambil.' })
  } catch {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.' })
  }
}

export async function updatePemeriksaanHandler(req: AuthRequest, res: Response): Promise<void> {
  const { pemeriksaanId } = req.params
  const parsed = UpdatePemeriksaanSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }
  try {
    const result = await updatePemeriksaan(pemeriksaanId, parsed.data, req.user!.userId)
    res.status(200).json({ success: true, data: result, message: 'Pemeriksaan berhasil diperbarui.' })
  } catch (err) {
    const e = err as { code?: string }
    res.status(getHttpStatus(e.code)).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}
