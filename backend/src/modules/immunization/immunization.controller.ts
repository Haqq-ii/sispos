import type { Response } from 'express'
import { z } from 'zod'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { getImunisasiByBalita, createImunisasi, getImunisasiForCitizen } from './immunization.service'

const CreateImunisasiSchema = z.object({
  balitaId: z.string().uuid({ message: 'balitaId harus berupa UUID valid' }),
  namaVaksin: z.string().min(1, { message: 'Nama vaksin wajib diisi' }),
  dosisKe: z.number({ required_error: 'dosisKe wajib diisi' }).int().min(1).max(10),
  tanggalInjeksi: z.string().datetime({ message: 'tanggalInjeksi harus berformat ISO 8601' }),
  keterangan: z.string().optional(),
})

export async function getImunisasiByBalitaHandler(req: AuthRequest, res: Response): Promise<void> {
  const { balitaId } = req.params
  try {
    const data = await getImunisasiByBalita(balitaId)
    res.status(200).json({ success: true, data, message: 'Riwayat imunisasi berhasil diambil.' })
  } catch {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.' })
  }
}

/**
 * getCitizenImunisasiHandler — GET /api/immunization/riwayat
 *
 * Hanya untuk role citizen. Mengembalikan riwayat imunisasi semua balita milik warga.
 * IDOR-safe: wargaId diambil dari JWT, bukan dari request params.
 */
export async function getCitizenImunisasiHandler(req: AuthRequest, res: Response): Promise<void> {
  const wargaId = req.user!.userId
  try {
    const data = await getImunisasiForCitizen(wargaId)
    res.status(200).json({ success: true, data, message: 'Riwayat imunisasi berhasil diambil.' })
  } catch {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.' })
  }
}

export async function createImunisasiHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = CreateImunisasiSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }
  try {
    const result = await createImunisasi(parsed.data, req.user!.userId, {
      headers: req.headers,
      ip: req.ip,
    })
    res.status(201).json({ success: true, data: result, message: 'Imunisasi berhasil disimpan.' })
  } catch {
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.' })
  }
}
