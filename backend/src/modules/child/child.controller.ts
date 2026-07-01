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
import { prisma } from '../../config/db'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'

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
