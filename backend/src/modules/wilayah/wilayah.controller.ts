import { Request, Response } from 'express'
import { getProvinsi, getKabupaten, getKecamatan, getKelurahan } from './wilayah.service'

/**
 * GET /api/wilayah/provinsi
 * Mengembalikan daftar provinsi yang tersedia.
 * Endpoint publik — tidak memerlukan autentikasi.
 */
export async function getProvinsiHandler(_req: Request, res: Response): Promise<void> {
  try {
    const data = await getProvinsi()
    res.json({ success: true, data })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal mengambil data provinsi',
    })
  }
}

/**
 * GET /api/wilayah/kabupaten?provinsi=...
 * Mengembalikan daftar kabupaten/kota berdasarkan provinsi.
 */
export async function getKabupatenHandler(req: Request, res: Response): Promise<void> {
  const provinsi = req.query.provinsi as string | undefined

  if (!provinsi) {
    res.status(400).json({
      success: false,
      error: 'PROVINSI_REQUIRED',
      message: 'Parameter provinsi wajib diisi',
    })
    return
  }

  try {
    const data = await getKabupaten(provinsi)
    res.json({ success: true, data })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal mengambil data kabupaten',
    })
  }
}

/**
 * GET /api/wilayah/kecamatan?kabupaten=...&provinsi=...
 * Mengembalikan daftar kecamatan berdasarkan kabupaten dan provinsi.
 */
export async function getKecamatanHandler(req: Request, res: Response): Promise<void> {
  const kabupaten = req.query.kabupaten as string | undefined
  const provinsi = req.query.provinsi as string | undefined

  if (!kabupaten || !provinsi) {
    res.status(400).json({
      success: false,
      error: 'PARAMS_REQUIRED',
      message: 'Parameter kabupaten dan provinsi wajib diisi',
    })
    return
  }

  try {
    const data = await getKecamatan(kabupaten, provinsi)
    res.json({ success: true, data })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal mengambil data kecamatan',
    })
  }
}

/**
 * GET /api/wilayah/kelurahan?kecamatan=...&kabupaten=...&provinsi=...
 * Mengembalikan daftar kelurahan/desa berdasarkan kecamatan, kabupaten, dan provinsi.
 */
export async function getKelurahanHandler(req: Request, res: Response): Promise<void> {
  const kecamatan = req.query.kecamatan as string | undefined
  const kabupaten = req.query.kabupaten as string | undefined
  const provinsi = req.query.provinsi as string | undefined

  if (!kecamatan || !kabupaten || !provinsi) {
    res.status(400).json({
      success: false,
      error: 'PARAMS_REQUIRED',
      message: 'Parameter kecamatan, kabupaten, dan provinsi wajib diisi',
    })
    return
  }

  try {
    const data = await getKelurahan(kecamatan, kabupaten, provinsi)
    res.json({ success: true, data })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal mengambil data kelurahan',
    })
  }
}
