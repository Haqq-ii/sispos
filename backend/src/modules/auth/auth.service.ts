import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../../config/db'
import { env } from '../../config/env'
import { enqueueOtpJob } from '../notification/notification.queue'
import type { RegisterSchema, OtpSendSchema, OtpVerifySchema, UpdateLokasiSchema } from '../../shared/schemas/auth.schema'

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
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
  })
  return { accessToken, refreshToken }
}

// ── registerWarga ─────────────────────────────────────────────────
export async function registerWarga(
  data: z.infer<typeof RegisterSchema>
): Promise<{ nomorPonselMasked: string }> {
  // Cek duplikasi NIK
  const existingByNik = await prisma.warga.findUnique({ where: { nikIbu: data.nikIbu } })
  if (existingByNik) {
    const err = new Error('NIK sudah terdaftar')
    ;(err as NodeJS.ErrnoException).code = 'NIK_SUDAH_TERDAFTAR'
    throw err
  }

  // Cek duplikasi nomor ponsel
  const existingByPhone = await prisma.warga.findUnique({ where: { nomorPonsel: data.nomorPonsel } })
  if (existingByPhone) {
    const err = new Error('Nomor ponsel sudah terdaftar')
    ;(err as NodeJS.ErrnoException).code = 'HP_SUDAH_TERDAFTAR'
    throw err
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS)

  // Buat akun Warga
  await prisma.warga.create({
    data: {
      nikIbu: data.nikIbu,
      namaLengkap: data.namaLengkap,
      nomorPonsel: data.nomorPonsel,
      passwordHash,
      statusVerifikasi: 'belum_verifikasi',
    },
  })

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
