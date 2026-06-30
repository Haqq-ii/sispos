// NOTE: Validation rules must be kept manually in sync with
// backend/src/shared/schemas/auth.schema.ts (RegisterSchema).
// Docker container separation prevents direct import per CLAUDE.md /shared/schemas intent.
// Sync on any change to NIK length, phone regex, or password policy.

import { z } from 'zod'

export const registerSchema = z
  .object({
    nikIbu: z
      .string()
      .length(16, 'NIK harus 16 digit')
      .regex(/^\d{16}$/, 'NIK hanya boleh angka'),
    namaLengkap: z.string().min(2, 'Nama minimal 2 karakter').max(200, 'Nama terlalu panjang'),
    nomorPonsel: z
      .string()
      .regex(/^(08|\+628)\d{8,11}$/, 'Format nomor HP tidak valid'),
    password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
    konfirmasi: z.string(),
  })
  .refine((d) => d.password === d.konfirmasi, {
    message: 'Kata sandi tidak cocok',
    path: ['konfirmasi'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>
