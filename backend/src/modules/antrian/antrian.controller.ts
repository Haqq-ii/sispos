/**
 * antrian.controller.ts — HTTP handler untuk antrian endpoints.
 *
 * Thin controller: validasi input → panggil service → map error ke HTTP status.
 *
 * Error code → HTTP status mapping:
 *   SLOT_PENUH              → 409
 *   SUDAH_DAFTAR            → 409
 *   TIDAK_BISA_BATALKAN     → 409
 *   SLOT_TIDAK_DITEMUKAN    → 404
 *   ANTRIAN_TIDAK_DITEMUKAN → 404
 *   P2002 (Prisma unique)   → 409 SUDAH_DAFTAR (double-tap race)
 *   default                 → 500
 */
import type { Response } from 'express'
import { Prisma } from '@prisma/client'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { AmbilAntrianSchema } from '../../shared/schemas/antrian.schema'
import {
  ambilAntrian,
  batalkanAntrian,
  getAntrianSaya,
  getAntrianById,
} from './antrian.service'

// ── Peta error code → HTTP status ────────────────────────────────────────
const ERROR_MAP: Record<string, number> = {
  SLOT_PENUH: 409,
  SUDAH_DAFTAR: 409,
  TIDAK_BISA_BATALKAN: 409,
  SLOT_TIDAK_DITEMUKAN: 404,
  ANTRIAN_TIDAK_DITEMUKAN: 404,
}

function getHttpStatus(code: string | undefined): number {
  return ERROR_MAP[code ?? ''] ?? 500
}

// ── POST /api/antrian/ambil ───────────────────────────────────────────────
export async function ambilAntrianHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = AmbilAntrianSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  try {
    const result = await ambilAntrian(
      parsed.data.slotId,
      parsed.data.balitaId,
      req.user!.userId
    )

    res.status(201).json({
      success: true,
      data: {
        antrianId: result.antrianId,
        nomorUrut: result.nomorUrut,
        estimasiMenit: result.estimasiMenit,
        namaPosyandu: result.namaPosyandu,
        labelSesi: result.labelSesi,
        tanggalPelaksanaan: result.tanggalPelaksanaan,
      },
      message: `Antrian berhasil dibuat. Nomor urut Anda: ${String(result.nomorUrut).padStart(2, '0')}`,
    })
  } catch (err) {
    // Tangani Prisma P2002 (double-tap race: unique constraint violation) → 409 SUDAH_DAFTAR
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'SUDAH_DAFTAR',
        message: 'Balita sudah terdaftar di sesi ini.',
      })
      return
    }

    const e = err as { code?: string }
    const status = getHttpStatus(e.code)
    const messages: Record<string, string> = {
      SLOT_PENUH: 'Slot sesi ini sudah penuh.',
      SUDAH_DAFTAR: 'Balita sudah terdaftar di sesi ini.',
      SLOT_TIDAK_DITEMUKAN: 'Slot sesi tidak ditemukan.',
    }

    res.status(status).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: messages[e.code ?? ''] ?? 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}

// ── PATCH /api/antrian/:id/batalkan ──────────────────────────────────────
export async function batalkanAntrianHandler(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params

  try {
    const result = await batalkanAntrian(id, req.user!.userId)

    res.status(200).json({
      success: true,
      data: result,
      message: 'Antrian berhasil dibatalkan.',
    })
  } catch (err) {
    const e = err as { code?: string }
    const status = getHttpStatus(e.code)

    const messages: Record<string, string> = {
      ANTRIAN_TIDAK_DITEMUKAN: 'Antrian tidak ditemukan.',
      TIDAK_BISA_BATALKAN: 'Antrian tidak bisa dibatalkan karena statusnya bukan menunggu.',
    }

    res.status(status).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: messages[e.code ?? ''] ?? 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}

// ── GET /api/antrian/saya ─────────────────────────────────────────────────
export async function getAntrianSayaHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const balitaId = typeof req.query.balitaId === 'string' ? req.query.balitaId : undefined
    const antrian = await getAntrianSaya(req.user!.userId, balitaId)

    res.status(200).json({
      success: true,
      data: antrian, // null jika tidak ada antrian aktif hari ini
      message: antrian ? 'Antrian aktif ditemukan.' : 'Tidak ada antrian aktif hari ini.',
    })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}

// ── GET /api/antrian/:id ──────────────────────────────────────────────────
export async function getAntrianByIdHandler(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params

  try {
    const antrian = await getAntrianById(id, req.user!.userId)

    res.status(200).json({
      success: true,
      data: antrian,
      message: 'Detail antrian berhasil diambil.',
    })
  } catch (err) {
    const e = err as { code?: string }
    const status = getHttpStatus(e.code)

    res.status(status).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message:
        e.code === 'ANTRIAN_TIDAK_DITEMUKAN'
          ? 'Antrian tidak ditemukan.'
          : 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}
