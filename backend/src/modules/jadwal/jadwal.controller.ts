import type { Response } from 'express'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { CreateJadwalSchema } from '../../shared/schemas/jadwal.schema'
import {
  createJadwal,
  getJadwalList,
  getJadwalTersedia,
  getCitizenPosyanduId,
  getSesiList,
} from './jadwal.service'

// ── POST /api/jadwal ──────────────────────────────────────────────
export async function createJadwalHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = CreateJadwalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  try {
    const result = await createJadwal(parsed.data, req.user!.userId)
    res.status(201).json({ success: true, data: result, message: 'Jadwal berhasil dibuat.' })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'POSYANDU_TIDAK_DITEMUKAN') {
      res.status(403).json({
        success: false,
        error: 'POSYANDU_TIDAK_DITEMUKAN',
        message: 'Posyandu tidak ditemukan atau bukan milik akun Anda.',
      })
      return
    }
    if (code === 'JADWAL_SUDAH_ADA') {
      res.status(409).json({
        success: false,
        error: 'JADWAL_SUDAH_ADA',
        message: 'Jadwal untuk posyandu dan tanggal ini sudah ada.',
      })
      return
    }
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}

// ── GET /api/jadwal ───────────────────────────────────────────────
export async function getJadwalListHandler(req: AuthRequest, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10))

  try {
    const { data, total } = await getJadwalList(req.user!.userId, page, limit)
    res.status(200).json({
      success: true,
      data,
      meta: { total, page, limit },
    })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}

// ── GET /api/jadwal/tersedia ──────────────────────────────────────
export async function getJadwalTersediaHandler(req: AuthRequest, res: Response): Promise<void> {
  const { bulan } = req.query as { bulan?: string }

  if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: 'Parameter bulan wajib diisi (format: YYYY-MM).',
    })
    return
  }

  try {
    // D-01: gunakan posyanduUtamaId citizen — citizen tidak bisa switch posyandu di flow antrian
    const posyanduId = await getCitizenPosyanduId(req.user!.userId)
    if (!posyanduId) {
      res.status(422).json({
        success: false,
        error: 'POSYANDU_BELUM_DIPILIH',
        message: 'Posyandu utama belum dipilih. Silakan perbarui lokasi Anda terlebih dahulu.',
      })
      return
    }

    const result = await getJadwalTersedia(posyanduId, bulan)
    res.status(200).json({ success: true, data: result })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}

// ── GET /api/sesi?jadwalId=... ────────────────────────────────────
export async function getSesiListHandler(req: AuthRequest, res: Response): Promise<void> {
  const { jadwalId } = req.query as { jadwalId?: string }

  if (!jadwalId) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: 'Parameter jadwalId wajib diisi.',
    })
    return
  }

  try {
    const sesiList = await getSesiList(jadwalId)

    // Format jamMulai dan jamSelesai ke HH:MM (UTC — menghindari timezone pitfall)
    const formatted = sesiList.map(({ jamMulai, jamSelesai, ...rest }) => ({
      ...rest,
      jamMulai: jamMulai.toISOString().substring(11, 16),
      jamSelesai: jamSelesai.toISOString().substring(11, 16),
    }))

    res.status(200).json({ success: true, data: formatted })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}
