/**
 * child.controller.ts — HTTP handler untuk balita (child) endpoints.
 *
 * [Rule 2 - Missing Critical Functionality] Endpoint ini diperlukan agar
 * KonfirmasiAntrianPage bisa menampilkan daftar balita citizen untuk dipilih
 * sebelum mendaftarkan antrian. Tanpa endpoint ini, flow antrian Phase 2 tidak
 * bisa diselesaikan.
 *
 * Ownership: GET /api/balita hanya mengembalikan balita milik warga yang login.
 */
import type { Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/db'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'

// ── GET /api/balita ───────────────────────────────────────────────────────────

// ── POST /api/balita ──────────────────────────────────────────────────────────

const CreateBalitaSchema = z.object({
  namaBalita: z.string().min(2, 'Nama balita minimal 2 karakter').max(200),
  tanggalLahir: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  jenisKelamin: z.enum(['laki_laki', 'perempuan'], { required_error: 'Jenis kelamin wajib diisi' }),
  nikBalita: z
    .string()
    .length(16, 'NIK harus 16 digit')
    .regex(/^\d{16}$/, 'NIK harus berupa 16 angka')
    .optional(),
})

export async function createBalitaHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = CreateBalitaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }
  try {
    const { namaBalita, tanggalLahir, jenisKelamin, nikBalita } = parsed.data
    const wargaId = req.user!.userId
    const balita = await prisma.balita.create({
      data: {
        wargaId,
        namaBalita,
        tanggalLahir: new Date(tanggalLahir + 'T00:00:00'),
        jenisKelamin: jenisKelamin as 'laki_laki' | 'perempuan',
        nikBalita: nikBalita ?? null,
      },
      select: {
        id: true,
        namaBalita: true,
        tanggalLahir: true,
        jenisKelamin: true,
        nikBalita: true,
      },
    })
    res.status(201).json({
      success: true,
      data: balita,
      message: 'Profil balita berhasil ditambahkan.',
    })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'NIK_SUDAH_TERDAFTAR',
        message: 'NIK balita sudah terdaftar di sistem.',
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

// ── GET /api/balita ───────────────────────────────────────────────────────────

/**
 * getBalitaSayaHandler — Ambil semua balita milik citizen yang sedang login.
 *
 * T-02-SC Mitigation: where: { wargaId: req.user!.userId } — citizen hanya
 * mendapat balita miliknya sendiri (tidak bisa enumerate balita warga lain).
 */
export async function getBalitaSayaHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const balitaList = await prisma.balita.findMany({
      where: { wargaId: req.user!.userId },
      select: {
        id: true,
        namaBalita: true,
        tanggalLahir: true,
        jenisKelamin: true,
      },
      orderBy: { namaBalita: 'asc' },
    })

    res.status(200).json({
      success: true,
      data: balitaList,
      message: 'Daftar balita berhasil diambil.',
    })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}
