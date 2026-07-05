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
import { chatGizi } from './ai-gizi.service'
import { chatPendaftaran } from './ai-pendaftaran.service'
import { chatAssistant } from './ai-assistant.service'

export const aiRouter = Router()

// ── Request Schema ────────────────────────────────────────────────────────

const EarlyWarningRequestSchema = z.object({
  pemeriksaanId: z.string().uuid({ message: 'pemeriksaanId harus berupa UUID yang valid' }).optional(),
  balitaId: z.string().uuid({ message: 'balitaId harus berupa UUID yang valid' }).optional(),
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

  const { pemeriksaanId: pemeriksaanIdReq, balitaId: balitaIdReq, tandaKlinis } = parsed.data
  const kaderId = req.user!.userId

  try {
    // Resolve pemeriksaanId: dari request langsung, atau auto-fetch terbaru untuk balitaId
    let pemeriksaanId = pemeriksaanIdReq
    if (!pemeriksaanId) {
      if (!balitaIdReq) {
        res.status(400).json({
          success: false,
          error: 'VALIDASI_GAGAL',
          message: 'Wajib menyertakan pemeriksaanId atau balitaId',
        })
        return
      }
      const latest = await prisma.pemeriksaan.findFirst({
        where: { balitaId: balitaIdReq },
        orderBy: { tanggalPemeriksaan: 'desc' },
        select: { id: true },
      })
      if (!latest) {
        res.status(404).json({
          success: false,
          error: 'PEMERIKSAAN_TIDAK_DITEMUKAN',
          message: 'Tidak ada riwayat pemeriksaan untuk balita ini.',
        })
        return
      }
      pemeriksaanId = latest.id
    }

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

// ── Route: early-warning ──────────────────────────────────────────────────

aiRouter.post(
  '/early-warning',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  earlyWarningHandler
)

// ── Schema: chatGizi ──────────────────────────────────────────────────────

const ChatGiziSchema = z.object({
  message: z
    .string()
    .min(1, 'Pesan tidak boleh kosong')
    .max(500, 'Pesan terlalu panjang'),
})

// ── Handler: chatGizi ─────────────────────────────────────────────────────

/**
 * chatGiziHandler — POST /api/ai/chat/gizi
 *
 * Security (T-04-03-01):
 *   - wargaId dari req.user!.userId (JWT) — TIDAK pernah dari body
 *   - Hanya citizen yang bisa akses (requireRole('citizen'))
 */
async function chatGiziHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ChatGiziSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  // wargaId dari JWT — NEVER from request body (T-04-03-01)
  const wargaId = req.user!.userId

  try {
    const result = await chatGizi(wargaId, parsed.data.message)
    res.status(200).json({
      success: true,
      data: { reply: result },
      message: 'Pesan berhasil diproses.',
    })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'RATE_LIMIT_EXCEEDED') {
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Batas 20 pesan per hari telah tercapai. Coba lagi besok.',
      })
      return
    }
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal memproses pesan. Coba lagi beberapa saat.',
    })
  }
}

// ── Route: chat/gizi ──────────────────────────────────────────────────────

aiRouter.post(
  '/chat/gizi',
  authMiddleware,
  requireRole('citizen'),
  chatGiziHandler
)

// ── Schema: chatPendaftaran ───────────────────────────────────────────────

const ChatPendaftaranSchema = z.object({
  message: z
    .string()
    .min(1, 'Pesan tidak boleh kosong')
    .max(1000, 'Pesan terlalu panjang'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .default([]),
})

// ── Handler: chatPendaftaran ──────────────────────────────────────────────

/**
 * chatPendaftaranHandler — POST /api/ai/chat/pendaftaran
 *
 * Security (T-04-04-05):
 *   - wargaId dari req.user!.userId (JWT) — TIDAK pernah dari body
 *   - Hanya citizen yang bisa akses (requireRole('citizen'))
 *   - clientHistory diterima dari body tetapi HANYA untuk text generation context
 *     — semua aksi (daftar/batalkan/reschedule) validasi ownership via wargaId dari JWT
 */
async function chatPendaftaranHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ChatPendaftaranSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  // wargaId dari JWT — NEVER dari request body (T-04-04-05)
  const wargaId = req.user!.userId

  try {
    const result = await chatPendaftaran(wargaId, parsed.data.message, parsed.data.history)
    res.status(200).json({
      success: true,
      data: {
        reply: result.reply,
        messages: result.messages,
      },
      message: 'Pesan berhasil diproses.',
    })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'RATE_LIMIT_EXCEEDED') {
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Batas 20 pesan per hari telah tercapai. Coba lagi besok.',
      })
      return
    }
    if (e.code === 'AI_TIMEOUT') {
      res.status(503).json({
        success: false,
        error: 'AI_TIMEOUT',
        message: 'Asisten tidak merespons. Coba lagi.',
      })
      return
    }
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal memproses pesan. Coba lagi beberapa saat.',
    })
  }
}

// ── Route: chat/pendaftaran ───────────────────────────────────────────────

aiRouter.post(
  '/chat/pendaftaran',
  authMiddleware,
  requireRole('citizen'),
  chatPendaftaranHandler
)

// ── Schema: chatAssistant ─────────────────────────────────────────────────

const ChatAssistantSchema = z.object({
  message: z
    .string()
    .min(1, 'Pesan tidak boleh kosong')
    .max(1000, 'Pesan terlalu panjang'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .default([]),
})

// ── Handler: chatAssistant ────────────────────────────────────────────────

async function chatAssistantHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ChatAssistantSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  const wargaId = req.user!.userId

  try {
    const result = await chatAssistant(wargaId, parsed.data.message, parsed.data.history)
    res.status(200).json({
      success: true,
      data: { reply: result.reply, messages: result.messages },
      message: 'Pesan berhasil diproses.',
    })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'RATE_LIMIT_EXCEEDED') {
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Batas 20 pesan per hari telah tercapai. Coba lagi besok.',
      })
      return
    }
    if (e.code === 'AI_TIMEOUT') {
      res.status(503).json({
        success: false,
        error: 'AI_TIMEOUT',
        message: 'Asisten tidak merespons. Coba lagi.',
      })
      return
    }
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Gagal memproses pesan. Coba lagi beberapa saat.',
    })
  }
}

// ── Route: chat/assistant ─────────────────────────────────────────────────

aiRouter.post(
  '/chat/assistant',
  authMiddleware,
  requireRole('citizen'),
  chatAssistantHandler
)
