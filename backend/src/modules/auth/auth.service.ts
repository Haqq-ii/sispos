import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import type { RolePengguna } from '@prisma/client'
import { prisma } from '../../config/db'
import { env } from '../../config/env'
import { enqueueOtpJob } from '../notification/notification.queue'
import type { RegisterSchema, OtpSendSchema, OtpVerifySchema, UpdateLokasiSchema } from '../../shared/schemas/auth.schema'

// ── Auth types ────────────────────────────────────────────────
export interface AuthUser {
  id: string
  namaLengkap: string
  role: RolePengguna
}

interface AuthError extends Error {
  code: string
  terkunciSampai?: Date
  gagalLogin?: number
  maxGagal?: number
}

// ── Helper: masking nomor ponsel ─────────────────────────────────
function maskPhoneNumber(nomorPonsel: string): string {
  // Contoh: "081234567890" → "0812****7890"
  return nomorPonsel.slice(0, 4) + '****' + nomorPonsel.slice(8)
}

// ── Helper: generate + simpan OTP baru ───────────────────────────
async function createAndEnqueueOtp(nomorPonsel: string, tujuan: 'registrasi' | 'reset_password'): Promise<void> {
  const kodeOtp = crypto.randomInt(100000, 999999).toString()
  const kedaluwarsaPada = new Date(Date.now() + 5 * 60 * 1000)

  // Invalidasi OTP lama yang belum dipakai
  await prisma.otp.updateMany({
    where: { nomorPonsel, tujuan, sudahDipakai: false },
    data: { sudahDipakai: true },
  })

  // Simpan OTP baru
  await prisma.otp.create({
    data: { nomorPonsel, kodeOtp, tujuan, sudahDipakai: false, kedaluwarsaPada },
  })

  // Enqueue job WA via BullMQ — CLAUDE.md: JANGAN kirim langsung ke Fonnte
  await enqueueOtpJob(nomorPonsel, kodeOtp)
}

// ── issueTokens ───────────────────────────────────────────────────
export function issueTokens(
  userId: string,
  role: string
): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign({ userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
  })
  // role disimpan di refresh token agar refreshAccessToken bisa regenerate access token dengan role yang benar
  const refreshToken = jwt.sign({ userId, role }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
  })
  return { accessToken, refreshToken }
}

// ── registerWarga ─────────────────────────────────────────────────
export async function registerWarga(
  data: z.infer<typeof RegisterSchema>
): Promise<{ nomorPonselMasked: string }> {
  // Cek duplikasi NIK. Registrasi pending boleh dilanjutkan ulang.
  const existingByNik = await prisma.warga.findUnique({ where: { nikIbu: data.nikIbu } })
  if (existingByNik && existingByNik.statusVerifikasi !== 'belum_verifikasi') {
    const err = new Error('NIK sudah terdaftar')
    ;(err as NodeJS.ErrnoException).code = 'NIK_SUDAH_TERDAFTAR'
    throw err
  }

  // Cek duplikasi nomor ponsel. Registrasi pending boleh dikirimi OTP baru.
  const existingByPhone = await prisma.warga.findUnique({ where: { nomorPonsel: data.nomorPonsel } })
  if (existingByPhone && existingByPhone.statusVerifikasi !== 'belum_verifikasi') {
    const err = new Error('Nomor ponsel sudah terdaftar')
    ;(err as NodeJS.ErrnoException).code = 'HP_SUDAH_TERDAFTAR'
    throw err
  }

  if (existingByNik && existingByPhone && existingByNik.id !== existingByPhone.id) {
    const err = new Error('NIK atau nomor ponsel sedang digunakan pada registrasi lain')
    ;(err as NodeJS.ErrnoException).code = 'DATA_REGISTRASI_BENTROK'
    throw err
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS)

  const pendingWarga = existingByNik ?? existingByPhone
  if (pendingWarga) {
    await prisma.warga.update({
      where: { id: pendingWarga.id },
      data: {
        nikIbu: data.nikIbu,
        namaLengkap: data.namaLengkap,
        nomorPonsel: data.nomorPonsel,
        passwordHash,
        statusVerifikasi: 'belum_verifikasi',
      },
    })
  } else {
    // Buat akun Warga pending sampai OTP berhasil diverifikasi.
    await prisma.warga.create({
      data: {
        nikIbu: data.nikIbu,
        namaLengkap: data.namaLengkap,
        nomorPonsel: data.nomorPonsel,
        passwordHash,
        statusVerifikasi: 'belum_verifikasi',
      },
    })
  }

  // Generate + enqueue OTP registrasi
  await createAndEnqueueOtp(data.nomorPonsel, 'registrasi')

  return { nomorPonselMasked: maskPhoneNumber(data.nomorPonsel) }
}

// ── sendOtp ───────────────────────────────────────────────────────
export async function sendOtp(nomorPonsel: string): Promise<void> {
  const warga = await prisma.warga.findUnique({ where: { nomorPonsel } })
  if (!warga) {
    const err = new Error('Warga tidak ditemukan')
    ;(err as NodeJS.ErrnoException).code = 'WARGA_TIDAK_DITEMUKAN'
    throw err
  }

  await createAndEnqueueOtp(nomorPonsel, 'registrasi')
}

// ── verifyOtpAndLogin ─────────────────────────────────────────────
export async function verifyOtpAndLogin(
  nomorPonsel: string,
  kodeOtp: string
): Promise<{
  tokens: { accessToken: string; refreshToken: string }
  user: { id: string; namaLengkap: string; role: 'citizen' }
}> {
  // Cari OTP valid yang belum dipakai dan belum kedaluwarsa
  const otp = await prisma.otp.findFirst({
    where: {
      nomorPonsel,
      kodeOtp,
      sudahDipakai: false,
      kedaluwarsaPada: { gt: new Date() },
      tujuan: 'registrasi',
    },
  })

  if (!otp) {
    const err = new Error('Kode OTP tidak valid atau sudah kedaluwarsa')
    ;(err as NodeJS.ErrnoException).code = 'OTP_TIDAK_VALID'
    throw err
  }

  // Tandai OTP sudah dipakai
  await prisma.otp.update({
    where: { id: otp.id },
    data: { sudahDipakai: true },
  })

  // Update status verifikasi Warga
  const warga = await prisma.warga.update({
    where: { nomorPonsel },
    data: { statusVerifikasi: 'terverifikasi' },
  })

  const tokens = issueTokens(warga.id, 'citizen')

  return {
    tokens,
    user: { id: warga.id, namaLengkap: warga.namaLengkap, role: 'citizen' },
  }
}

// ── updateLokasi ──────────────────────────────────────────────────
export async function updateLokasi(
  userId: string,
  data: z.infer<typeof UpdateLokasiSchema>
): Promise<void> {
  await prisma.warga.update({
    where: { id: userId },
    data: {
      provinsi: data.provinsi,
      kabupaten: data.kabupaten,
      kecamatan: data.kecamatan,
      kelurahan: data.kelurahan,
      rw: data.rw ?? null,
      rt: data.rt ?? null,
    },
  })
}

// ── detectRole ────────────────────────────────────────────────────
export function detectRole(identifier: string): 'citizen' | 'kader' | 'puskesmas' | null {
  if (/^\d{16}$/.test(identifier)) return 'citizen'
  if (/^(08|\+62)\d{7,12}$/.test(identifier)) return 'kader'
  if (/@/.test(identifier)) return 'puskesmas'
  return null
}

// ── login ─────────────────────────────────────────────────────────
export async function login(
  identifier: string,
  password: string
): Promise<{ tokens: ReturnType<typeof issueTokens>; user: AuthUser }> {
  const role = detectRole(identifier)
  if (!role) {
    const err = Object.assign(new Error('Format identifier tidak valid'), {
      code: 'FORMAT_IDENTIFIER_TIDAK_VALID',
    }) as AuthError
    throw err
  }

  if (role === 'citizen') {
    const warga = await prisma.warga.findUnique({ where: { nikIbu: identifier } })
    if (!warga) {
      const err = Object.assign(new Error('Kredensial salah'), { code: 'KREDENSIAL_SALAH' }) as AuthError
      throw err
    }
    if (warga.statusVerifikasi !== 'terverifikasi') {
      const err = Object.assign(new Error('Akun belum diverifikasi'), {
        code: 'AKUN_BELUM_DIVERIFIKASI',
      }) as AuthError
      throw err
    }
    const valid = await bcrypt.compare(password, warga.passwordHash)
    if (!valid) {
      const err = Object.assign(new Error('Kredensial salah'), { code: 'KREDENSIAL_SALAH' }) as AuthError
      throw err
    }
    const tokens = issueTokens(warga.id, 'citizen')
    return { tokens, user: { id: warga.id, namaLengkap: warga.namaLengkap, role: 'citizen' } }
  }

  if (role === 'kader') {
    const kader = await prisma.kader.findUnique({ where: { nomorPonsel: identifier } })
    if (!kader) {
      const err = Object.assign(new Error('Kredensial salah'), { code: 'KREDENSIAL_SALAH' }) as AuthError
      throw err
    }
    if (!kader.isAktif) {
      const err = Object.assign(new Error('Akun tidak aktif'), { code: 'AKUN_TIDAK_AKTIF' }) as AuthError
      throw err
    }
    // Cek lockout — T-02-05: cek sebelum bcrypt agar tidak buang CPU
    if (kader.terkunciSampai && kader.terkunciSampai > new Date()) {
      const err = Object.assign(new Error('Akun terkunci'), {
        code: 'AKUN_TERKUNCI',
        terkunciSampai: kader.terkunciSampai,
      }) as AuthError
      throw err
    }
    const valid = await bcrypt.compare(password, kader.pinHash)
    if (!valid) {
      const gagalBaru = kader.gagalLogin + 1
      if (gagalBaru >= 10) {
        // T-02-01: 10 kali gagal → kunci 30 menit
        await prisma.kader.update({
          where: { id: kader.id },
          data: { gagalLogin: gagalBaru, terkunciSampai: new Date(Date.now() + 30 * 60 * 1000) },
        })
      } else {
        await prisma.kader.update({
          where: { id: kader.id },
          data: { gagalLogin: gagalBaru },
        })
      }
      const err = Object.assign(new Error('Kredensial salah'), {
        code: 'KREDENSIAL_SALAH',
        gagalLogin: gagalBaru,
        maxGagal: 10,
      }) as AuthError
      throw err
    }
    // Reset gagal login setelah sukses
    await prisma.kader.update({
      where: { id: kader.id },
      data: { gagalLogin: 0, terkunciSampai: null },
    })
    const kaderRole: RolePengguna = kader.isKetua ? 'ketua_kader' : 'kader'
    const tokens = issueTokens(kader.id, kaderRole)
    return { tokens, user: { id: kader.id, namaLengkap: kader.namaLengkap, role: kaderRole } }
  }

  // puskesmas path
  const puskesmas = await prisma.puskesmas.findUnique({ where: { email: identifier } })
  if (!puskesmas) {
    const err = Object.assign(new Error('Kredensial salah'), { code: 'KREDENSIAL_SALAH' }) as AuthError
    throw err
  }
  const valid = await bcrypt.compare(password, puskesmas.passwordHash)
  if (!valid) {
    const err = Object.assign(new Error('Kredensial salah'), { code: 'KREDENSIAL_SALAH' }) as AuthError
    throw err
  }
  const tokens = issueTokens(puskesmas.id, 'puskesmas')
  return {
    tokens,
    user: { id: puskesmas.id, namaLengkap: puskesmas.namaPuskesmas, role: 'puskesmas' },
  }
}

// ── refreshAccessToken ────────────────────────────────────────────
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string; role: string }
  const accessToken = jwt.sign({ userId: decoded.userId, role: decoded.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
  })
  return { accessToken }
}

// ── logout (no-op — cookie clearing done in controller) ───────────
export function logout(): void {
  // intentionally empty — clearCookie handled in logoutHandler
}
