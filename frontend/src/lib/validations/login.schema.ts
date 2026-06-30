import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Nomor identitas wajib diisi'),
  password: z.string().min(1, 'Kata sandi / PIN wajib diisi'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
