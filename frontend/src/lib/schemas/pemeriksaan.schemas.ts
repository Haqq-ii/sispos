/**
 * pemeriksaan.schemas.ts — Zod v4 frontend schema for Meja 2 BB/TB input.
 *
 * PENTING: Frontend menggunakan Zod v4 (^4.4.3). Backend menggunakan Zod v3.
 * Schema ini TIDAK boleh di-import dari backend/src/shared/schemas — duplikasi disengaja
 * karena perbedaan Zod v3 vs v4 API (lihat 03-RESEARCH.md §Pitfall 4).
 *
 * BB max(100) memungkinkan input 85 kg — gate biologis adalah UX confirmation dialog,
 * BUKAN Zod error. Backend yang enforce via header x-konfirmasi-biologis (T-03-04-02).
 */
import { z } from 'zod'

export const Meja2Schema = z.object({
  beratBadan: z
    .number({ error: 'Berat badan wajib diisi' })
    .min(0.1, 'BB harus positif')
    .max(100, 'BB maks 100 kg'),
  tinggiBadan: z
    .number()
    .min(0.1, 'TB harus positif')
    .max(200, 'TB maks 200 cm')
    .optional(),
  lingkarKepala: z.number().min(0.1).optional(),
  lingkarLengan: z.number().min(0.1).optional(),
  catatanKonsultasi: z.string().optional(),
})

export type Meja2Input = z.infer<typeof Meja2Schema>
