/**
 * ai.routes.ts — POST /api/ai/early-warning
 *
 * Security (T-03-06-05, T-03-06-06):
 *   - T-03-06-06 IDOR guard: verifikasi posyanduId pemeriksaan === kader.posyanduId
 *     sebelum call generateEarlyWarning — tidak mau panggil API OpenAI dengan data
 *     yang tidak berhak diakses kader
 *   - T-03-06-05 rekomendasiAi disimpan encrypted via updatePemeriksaan
 *   - authMiddleware + requireRole('kader','ketua_kader') sebelum semua logika
 *
 * Flow:
 *   1. Parse schema (pemeriksaanId + optional tandaKlinis)
 *   2. Fetch pemeriksaan dari DB (balita, Z-Scores, statusGizi)
 *   3. IDOR guard: kader.posyanduId === pemeriksaan posyanduId
 *   4. Build EarlyWarningInput
 *   5. Call generateEarlyWarning (GPT-4o)
 *   6. Save rekomendasiAi encrypted via updatePemeriksaan
 *   7. Respond {level, ringkasan, rekomendasi}
 */
import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { prisma } from '../../config/db'
import { generateEarlyWarning } from './ai.service'
import { updatePemeriksaan } from '../growth/growth.service'

export const aiRouter = Router()

// ── Request Schema ────────────────────────────────────────────────────────

const EarlyWarningRequestSchema = z.object({
  pemeriksaanId: z.string().uuid({ message: 'pemeriksaanId wajib berupa UUID yang valid' }),
  tandaKlinis: z
    .object({
      rambutKemerahan: z.boolean(),
      perutBuncit: z.boolean(),
      edema: z.boolean(),
      pucat: z.boolean(),
      lainnya: z.string().nullable().optional(),
    })
    .optional(),
})

// ── Helper: calculate ageInMonths ─────────────────────────────────────────

function ageInMonths(tanggalLahir: Date, reference: Date): number {
  const diffMs = reference.getTime() - tanggalLahir.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375))
}

// ── Handler ───────────────────────────────────────────────────────────────

async function earlyWarningHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = EarlyWarningRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  const { pemeriksaanId, tandaKlinis } = parsed.data
  const kaderId = req.user!.userId

  try {
    // 1. Fetch pemeriksaan dengan balita dan antrian chain (untuk IDOR guard)
    const pemeriksaan = await prisma.pemeriksaan.findUnique({
      where: { id: pemeriksaanId },
      include: {
        balita: {
          select: {
            namaBalita: true,
            tanggalLahir: true,
            jenisKelamin: true,
          },
        },
        antrian: {
          include: {
            slotSesi: {
              include: {
                jadwal: { select: { posyanduId: true } },
              },
            },
          },
        },
      },
    })

    if (!pemeriksaan) {
      res.status(404).json({
        success: false,
        error: 'PEMERIKSAAN_TIDAK_DITEMUKAN',
        message: 'Data pemeriksaan tidak ditemukan.',
      })
      return
    }

    // 2. IDOR guard (T-03-06-06): pastikan pemeriksaan milik posyandu kader
    //    Hanya cek jika antrian chain tersedia
    if (pemeriksaan.antrian) {
      const kader = await prisma.kader.findUnique({
        where: { id: kaderId },
        select: { posyanduId: true },
      })
      const pemPosyanduId = pemeriksaan.antrian.slotSesi?.jadwal?.posyanduId
      if (kader && pemPosyanduId && kader.posyanduId !== pemPosyanduId) {
        res.status(403).json({
          success: false,
          error: 'AKSES_DITOLAK',
          message: 'Akses ditolak — pemeriksaan ini bukan milik posyandu Anda.',
        })
        return
      }
    }

    // 3. Build EarlyWarningInput
    const now = new Date()
    const usiaBulan = ageInMonths(new Date(pemeriksaan.balita.tanggalLahir), now)

    // Default tanda klinis: semua false jika tidak dikirim dari request
    const resolvedTandaKlinis = tandaKlinis ?? {
      rambutKemerahan: false,
      perutBuncit: false,
      edema: false,
      pucat: false,
      lainnya: null,
    }

    const earlyWarningInput = {
      namaBalita: pemeriksaan.balita.namaBalita,
      usiaBulan,
      jenisKelamin: pemeriksaan.balita.jenisKelamin as 'laki_laki' | 'perempuan',
      beratBadan: pemeriksaan.beratBadan,
      tinggiBadan: pemeriksaan.tinggiBadan,
      zScoreBbU: pemeriksaan.zScoreBbU,
      zScoreTbU: pemeriksaan.zScoreTbU,
      zScoreBbTb: pemeriksaan.zScoreBbTb,
      statusGizi: pemeriksaan.statusGizi,
      tandaKlinis: resolvedTandaKlinis,
    }

    // 4. Call GPT-4o generateEarlyWarning
    const result = await generateEarlyWarning(earlyWarningInput)

    // 5. Simpan rekomendasiAi encrypted via updatePemeriksaan
    //    updatePemeriksaan handles encryption (UU PDP No. 27/2022) + AuditLog
    await updatePemeriksaan(
      pemeriksaanId,
      { rekomendasiAi: result.rekomendasi },
      kaderId
    )

    // 6. Respond dengan hasil AI
    res.status(200).json({
      success: true,
      data: {
        level: result.level,
        ringkasan: result.ringkasan,
        rekomendasi: result.rekomendasi,
      },
      message: 'Early warning berhasil di-generate.',
    })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    const statusMap: Record<string, number> = {
      PEMERIKSAAN_TIDAK_DITEMUKAN: 404,
      AKSES_DITOLAK: 403,
    }
    const status = statusMap[e.code ?? ''] ?? 500
    res.status(status).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: 'Gagal generate early warning. Coba lagi beberapa saat.',
    })
  }
}

// ── Route ─────────────────────────────────────────────────────────────────

aiRouter.post(
  '/early-warning',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  earlyWarningHandler
)
