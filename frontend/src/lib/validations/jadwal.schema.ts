import { z } from 'zod'

export const CreateJadwalFESchema = z.object({
  posyanduId: z.string().min(1, 'Pilih posyandu terlebih dahulu'),
  tanggalPelaksanaan: z.date({ error: 'Pilih tanggal pelaksanaan' }),
  estimasiDurasiMenit: z
    .number({ error: 'Isi estimasi durasi' })
    .int()
    .min(5, 'Minimal 5 menit')
    .max(30, 'Maksimal 30 menit'),
})

export type CreateJadwalFEInput = z.infer<typeof CreateJadwalFESchema>
