import { Router } from 'express'
import {
  getProvinsiHandler,
  getKabupatenHandler,
  getKecamatanHandler,
  getKelurahanHandler,
} from './wilayah.controller'

/**
 * Wilayah Router — endpoint referensi geografis publik.
 * Tidak memerlukan authMiddleware: data provinsi/kabupaten/kecamatan/kelurahan
 * bersifat publik dan tidak mengandung PII.
 */
export const wilayahRouter = Router()

// GET /api/wilayah/provinsi
wilayahRouter.get('/provinsi', getProvinsiHandler)

// GET /api/wilayah/kabupaten?provinsi=...
wilayahRouter.get('/kabupaten', getKabupatenHandler)

// GET /api/wilayah/kecamatan?kabupaten=...&provinsi=...
wilayahRouter.get('/kecamatan', getKecamatanHandler)

// GET /api/wilayah/kelurahan?kecamatan=...&kabupaten=...&provinsi=...
wilayahRouter.get('/kelurahan', getKelurahanHandler)
