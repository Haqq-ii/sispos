import { z } from 'zod'

export const CreateJadwalSchema = z.object({
  posyanduId: z.string().uuid('posyanduId harus UUID valid'),
  tanggalPelaksanaan: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  estimasiDurasiMenit: z
    .number()
    .int('estimasiDurasiMenit harus bilangan bulat')
    .min(5, 'Minimal 5 menit')
    .max(30, 'Maksimal 30 menit'),
})

export type CreateJadwalInput = z.infer<typeof CreateJadwalSchema>
