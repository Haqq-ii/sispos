import { z } from 'zod'

// Regex validasi nomor ponsel Indonesia: 08xxx atau +628xxx, panjang 10-13 digit total
const phoneRegex = /^(08|\+628)\d{8,11}$/

export const RegisterSchema = z.object({
  nikIbu: z
    .string()
    .length(16, { message: 'NIK harus tepat 16 digit' })
    .regex(/^\d{16}$/, { message: 'NIK harus berupa 16 digit angka' }),
  namaLengkap: z
    .string()
    .min(2, { message: 'Nama lengkap minimal 2 karakter' })
    .max(200, { message: 'Nama lengkap maksimal 200 karakter' }),
  nomorPonsel: z
    .string()
    .regex(phoneRegex, { message: 'Nomor ponsel tidak valid (format: 08xxx atau +628xxx)' }),
  password: z
    .string()
    .min(8, { message: 'Password minimal 8 karakter' }),
})

export const OtpSendSchema = z.object({
  nomorPonsel: z
    .string()
    .regex(phoneRegex, { message: 'Nomor ponsel tidak valid (format: 08xxx atau +628xxx)' }),
})

export const OtpVerifySchema = z.object({
  nomorPonsel: z
    .string()
    .regex(phoneRegex, { message: 'Nomor ponsel tidak valid (format: 08xxx atau +628xxx)' }),
  kodeOtp: z
    .string()
    .length(6, { message: 'Kode OTP harus tepat 6 digit' })
    .regex(/^\d{6}$/, { message: 'Kode OTP harus berupa 6 digit angka' }),
})

export const UpdateLokasiSchema = z.object({
  provinsi: z.string().min(1, { message: 'Provinsi wajib diisi' }),
  kabupaten: z.string().min(1, { message: 'Kabupaten/kota wajib diisi' }),
  kecamatan: z.string().min(1, { message: 'Kecamatan wajib diisi' }),
  kelurahan: z.string().min(1, { message: 'Kelurahan wajib diisi' }),
  rw: z.string().max(10).optional(),
  rt: z.string().max(10).optional(),
})
