import { z } from 'zod'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

const CreateJadwalSessionSchema = z.object({
  jamMulai: z.string().regex(TIME_PATTERN, 'Format jamMulai harus HH:mm'),
  jamSelesai: z.string().regex(TIME_PATTERN, 'Format jamSelesai harus HH:mm'),
  kuota: z
    .number()
    .int('kuota harus bilangan bulat')
    .min(1, 'Kuota minimal 1')
    .max(200, 'Kuota maksimal 200'),
})

export const CreateJadwalSchema = z
  .object({
    posyanduId: z.string().uuid('posyanduId harus UUID valid'),
    tanggalPelaksanaan: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    estimasiDurasiMenit: z
      .number()
      .int('estimasiDurasiMenit harus bilangan bulat')
      .min(5, 'Minimal 5 menit')
      .max(30, 'Maksimal 30 menit')
      .optional(),
    sessions: z.array(CreateJadwalSessionSchema).min(1, 'Minimal 1 sesi').max(8, 'Maksimal 8 sesi').optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.sessions && data.estimasiDurasiMenit === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estimasiDurasiMenit'],
        message: 'estimasiDurasiMenit wajib diisi jika sessions tidak dikirim',
      })
    }

    if (!data.sessions) return

    const ranges = data.sessions.map((session, index) => {
      const start = timeToMinutes(session.jamMulai)
      const end = timeToMinutes(session.jamSelesai)
      if (start >= end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sessions', index, 'jamSelesai'],
          message: 'jamSelesai harus lebih besar dari jamMulai',
        })
      }
      return { start, end, index }
    })

    const validRanges = ranges.filter((range) => range.start < range.end).sort((a, b) => a.start - b.start)
    for (let i = 1; i < validRanges.length; i += 1) {
      const previous = validRanges[i - 1]
      const current = validRanges[i]
      if (current.start < previous.end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sessions', current.index, 'jamMulai'],
          message: 'Sesi tidak boleh overlap dengan sesi lain',
        })
      }
    }
  })

export type CreateJadwalInput = z.infer<typeof CreateJadwalSchema>
