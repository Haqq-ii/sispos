import { z } from 'zod'

/**
 * AmbilAntrianSchema — validasi body POST /api/antrian/ambil
 *
 * T-02-09 Mitigation: kedua field divalidasi sebagai UUID — mencegah
 * injection via string concatenation. Backend tidak pernah menerima
 * nomorUrut dari client (dihitung oleh service via SELECT FOR UPDATE).
 */
export const AmbilAntrianSchema = z.object({
  slotId: z.string().uuid('slotId harus berformat UUID'),
  balitaId: z.string().uuid('balitaId harus berformat UUID'),
})

export type AmbilAntrianInput = z.infer<typeof AmbilAntrianSchema>
