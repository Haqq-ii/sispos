import type { Response } from 'express'
import { z } from 'zod'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { createPemeriksaan, getPemeriksaanHistory } from './growth.service'

const CreatePemeriksaanSchema = z.object({
  antrianId: z.string().uuid().optional(),
  balitaId: z.string().uuid({ message: 'balitaId wajib diisi dan harus berupa UUID' }),
  beratBadan: z.number({ required_error: 'beratBadan wajib diisi' }).positive().max(100, { message: 'Berat badan tidak valid (maks 100 kg)' }),
  tinggiBadan: z.number().positive().max(200, { message: 'Tinggi badan tidak valid (maks 200 cm)' }).optional(),
  lingkarKepala: z.number().positive().optional(),
  lingkarLengan: z.number().positive().optional(),
  catatanKonsultasi: z.string().optional(),
})

const ERROR_MAP: Record<string, number> = {
  BALITA_TIDAK_DITEMUKAN: 404,
  ANTRIAN_TIDAK_DITEMUKAN: 404,
  PEMERIKSAAN_SUDAH_ADA: 409,
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

export async function getPemeriksaanHistoryHandler(req: AuthRequest, res: Response): Promise<void> {
  const { balitaId } = req.params
  try {
    const data = await getPemeriksaanHistory(balitaId)
    res.status(200).json({ success: true, data, message: 'Riwayat pemeriksaan berhasil diambil.' })
  } catch {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.' })
  }
}
