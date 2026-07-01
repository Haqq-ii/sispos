import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/axios'

/**
 * Hook untuk Citizen PilihSesiPage.
 * Mengambil daftar slot sesi berdasarkan jadwalId.
 * staleTime 15 detik — ketersediaan slot berubah sering; cache pendek untuk kurangi data basi.
 * Hanya aktif (enabled) ketika jadwalId tersedia.
 *
 * @param jadwalId - ID jadwal yang dipilih, atau null jika belum dipilih
 */
export function useSesiAvailability(jadwalId: string | null) {
  return useQuery({
    queryKey: ['sesi', jadwalId],
    queryFn: () =>
      apiClient
        .get('/sesi', { params: { jadwalId } })
        .then((r) => r.data.data as SlotSesiDetail[]),
    enabled: !!jadwalId,
    staleTime: 15_000,
  })
}

/**
 * Mutation untuk ambil antrian (POST /api/antrian/ambil).
 * Setelah sukses, invalidate cache antrian saya.
 */
export function useAmbilAntrian() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { slotId: string; balitaId: string }) =>
      apiClient.post('/antrian/ambil', body).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['antrian', 'saya'] })
    },
  })
}

/**
 * Mutation untuk batalkan antrian (PATCH /api/antrian/:id/batalkan).
 * Setelah sukses, invalidate cache antrian.
 */
export function useBatalkanAntrian() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (antrianId: string) =>
      apiClient
        .patch(`/antrian/${antrianId}/batalkan`)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['antrian'] })
    },
  })
}

// ── Type definitions ──────────────────────────────────────────────────────────

export interface SlotSesiDetail {
  id: string
  labelSesi: string
  jamMulai: string
  jamSelesai: string
  kuota: number
  terisi: number
  jadwalId: string
}
