import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import {
  RegisterSchema,
  OtpSendSchema,
  OtpVerifySchema,
  UpdateLokasiSchema,
} from '../../shared/schemas/auth.schema'
import {
  registerWarga,
  sendOtp,
  verifyOtpAndLogin,
  updateLokasi,
} from './auth.service'

// ── POST /api/auth/register ───────────────────────────────────────
export async function registerHandler(req: Request, res: Response): Promise<void> {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  try {
    const result = await registerWarga(parsed.data)
    res.status(201).json({
      success: true,
      data: { nomorPonselMasked: result.nomorPonselMasked },
      message: `OTP telah dikirim ke nomor ${result.nomorPonselMasked}. Masukkan kode OTP untuk verifikasi.`,
    })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'NIK_SUDAH_TERDAFTAR' || code === 'HP_SUDAH_TERDAFTAR') {
      res.status(409).json({
        success: false,
        error: code,
        message: code === 'NIK_SUDAH_TERDAFTAR'
          ? 'NIK sudah terdaftar. Silakan login atau gunakan NIK yang berbeda.'
          : 'Nomor ponsel sudah terdaftar. Silakan login atau gunakan nomor yang berbeda.',
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

// ── POST /api/auth/otp/send ───────────────────────────────────────
export async function otpSendHandler(req: Request, res: Response): Promise<void> {
  const parsed = OtpSendSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  try {
    await sendOtp(parsed.data.nomorPonsel)
    res.status(200).json({
      success: true,
      data: null,
      message: 'OTP berhasil dikirim ulang.',
    })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'WARGA_TIDAK_DITEMUKAN') {
      res.status(404).json({
        success: false,
        error: 'WARGA_TIDAK_DITEMUKAN',
        message: 'Nomor ponsel tidak terdaftar.',
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

// ── POST /api/auth/otp/verify ─────────────────────────────────────
export async function otpVerifyHandler(req: Request, res: Response): Promise<void> {
  const parsed = OtpVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  try {
    const { tokens, user } = await verifyOtpAndLogin(
      parsed.data.nomorPonsel,
      parsed.data.kodeOtp
    )

    // Set httpOnly cookies — aman dari XSS (CLAUDE.md: JWT httpOnly cookie)
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15 menit
    })
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    })

    res.status(200).json({
      success: true,
      data: { user },
      message: 'Verifikasi berhasil. Selamat datang di SISPOS!',
    })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'OTP_TIDAK_VALID') {
      res.status(400).json({
        success: false,
        error: 'OTP_TIDAK_VALID',
        message: 'Kode OTP tidak valid atau sudah kedaluwarsa.',
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

// ── PATCH /api/auth/lokasi ────────────────────────────────────────
export async function updateLokasiHandler(req: Request, res: Response): Promise<void> {
  // Verifikasi JWT dari cookie httpOnly secara manual
  const token = req.cookies?.access_token as string | undefined
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'TIDAK_TERAUTENTIKASI',
      message: 'Token autentikasi tidak ditemukan. Silakan login.',
    })
    return
  }

  let userId: string
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string }
    userId = payload.userId
  } catch {
    res.status(401).json({
      success: false,
      error: 'TOKEN_TIDAK_VALID',
      message: 'Token autentikasi tidak valid atau sudah kedaluwarsa.',
    })
    return
  }

  const parsed = UpdateLokasiSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }

  try {
    await updateLokasi(userId, parsed.data)
    res.status(200).json({
      success: true,
      data: null,
      message: 'Lokasi berhasil diperbarui.',
    })
  } catch {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}
