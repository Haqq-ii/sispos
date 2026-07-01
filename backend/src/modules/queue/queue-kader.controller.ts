import type { Response } from 'express'
import { z } from 'zod'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import {
  getActiveMeja,
  setActiveMeja,
  clearActiveMeja,
  getSlotAntrian,
  getTodaySlots,
  hadirAntrian,
  tangguhkanAntrian,
  goShowAntrian,
} from './queue-kader.service'

const SetActiveMejaSchema = z.object({
  mejaNumber: z.number({ required_error: 'mejaNumber wajib diisi' }).int().min(1).max(5, { message: 'Nomor meja harus 1-5' }),
  slotId: z.string().uuid({ message: 'slotId harus berupa UUID valid' }),
})

const GoShowSchema = z.object({
  slotId: z.string().uuid({ message: 'slotId harus berupa UUID valid' }),
  balitaId: z.string().uuid({ message: 'balitaId harus berupa UUID valid' }),
  wargaId: z.string().uuid({ message: 'wargaId harus berupa UUID valid' }),
})

const ERROR_MAP: Record<string, number> = {
  ANTRIAN_TIDAK_DITEMUKAN: 404,
  SLOT_TIDAK_DITEMUKAN: 404,
  KADER_TIDAK_DITEMUKAN: 404,
  SLOT_PENUH: 409,
  SUDAH_DAFTAR: 409,
  ANTRIAN_STATUS_TIDAK_VALID: 409,
  FORBIDDEN_POSYANDU: 403,
}

function getStatus(code: string | undefined): number {
  return ERROR_MAP[code ?? ''] ?? 500
}

function handleErr(err: unknown, res: Response): void {
  const e = err as { code?: string }
  res.status(getStatus(e.code)).json({
    success: false,
    error: e.code ?? 'INTERNAL_ERROR',
    message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
  })
}

export async function getActiveMejaHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await getActiveMeja(req.user!.userId)
    res.status(200).json({ success: true, data, message: data ? 'Meja aktif ditemukan.' : 'Tidak ada meja aktif.' })
  } catch (err) { handleErr(err, res) }
}

export async function setActiveMejaHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = SetActiveMejaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'VALIDASI_GAGAL', message: parsed.error.errors.map(e => e.message).join('; ') })
    return
  }
  try {
    await setActiveMeja(req.user!.userId, parsed.data.mejaNumber, parsed.data.slotId)
    res.status(200).json({ success: true, data: { activeMeja: parsed.data.mejaNumber, slotId: parsed.data.slotId }, message: 'Meja aktif berhasil diset.' })
  } catch (err) { handleErr(err, res) }
}

export async function clearActiveMejaHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    await clearActiveMeja(req.user!.userId)
    res.status(200).json({ success: true, data: null, message: 'Meja aktif berhasil dihapus.' })
  } catch (err) { handleErr(err, res) }
}

export async function getSlotAntrianHandler(req: AuthRequest, res: Response): Promise<void> {
  const { slotId } = req.params
  try {
    const data = await getSlotAntrian(slotId)
    res.status(200).json({ success: true, data, message: 'Daftar antrian berhasil diambil.' })
  } catch (err) { handleErr(err, res) }
}

export async function getTodaySlotsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await getTodaySlots(req.user!.userId)
    res.status(200).json({ success: true, data, message: data ? 'Jadwal hari ini ditemukan.' : 'Tidak ada jadwal hari ini.' })
  } catch (err) { handleErr(err, res) }
}

export async function hadirAntrianHandler(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  try {
    const result = await hadirAntrian(id, req.user!.userId)
    res.status(200).json({ success: true, data: result, message: 'Antrian berhasil dipanggil.' })
  } catch (err) { handleErr(err, res) }
}

export async function tangguhkanAntrianHandler(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  try {
    const result = await tangguhkanAntrian(id, req.user!.userId)
    res.status(200).json({ success: true, data: result, message: 'Antrian berhasil ditangguhkan.' })
  } catch (err) { handleErr(err, res) }
}

export async function goShowAntrianHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = GoShowSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'VALIDASI_GAGAL', message: parsed.error.errors.map(e => e.message).join('; ') })
    return
  }
  try {
    const result = await goShowAntrian(parsed.data.slotId, parsed.data.balitaId, parsed.data.wargaId, req.user!.userId)
    res.status(201).json({ success: true, data: result, message: 'Antrian go-show berhasil dibuat.' })
  } catch (err) { handleErr(err, res) }
}
