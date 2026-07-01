/**
 * usePemeriksaan.ts — TanStack Query hooks untuk Pemeriksaan (Meja 2: Timbang/Ukur).
 *
 * Exports:
 *   usePemeriksaanHistory  — riwayat pemeriksaan balita (untuk grafik Z-Score Meja 3)
 *   useCreatePemeriksaan   — POST /api/growth/pemeriksaan (create baru)
 *   usePatchPemeriksaan    — PATCH /api/growth/pemeriksaan/:id (update tanda klinis, rekomendasi AI)
 *
 * Security (T-03-04-02):
 *   useCreatePemeriksaan menambahkan header x-konfirmasi-biologis:true jika
 *   konfirmasiBiologis=true — backend enforce di sisi server, UI gate hanya UX layer.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PemeriksaanHistoryItem {
  id: string
  tanggalPemeriksaan: string
  beratBadan: number | null
  tinggiBadan: number | null
  lingkarKepala: number | null
  lingkarLengan: number | null
  zScoreBbU: number | null
  zScoreTbU: number | null
  zScoreBbTb: number | null
  statusGizi: string | null
  statusGiziOverride: string | null
}

export interface PemeriksaanRecord {
  id: string
  balitaId: string
  antrianId: string | null
  kaderId: string | null
  beratBadan: number | null
  tinggiBadan: number | null
  lingkarKepala: number | null
  lingkarLengan: number | null
  zScoreBbU: number | null
  zScoreTbU: number | null
  zScoreBbTb: number | null
  statusGizi: string | null
  statusGiziOverride: string | null
  catatanKonsultasi: string | null
  catatanKlinis: string | null
  rekomendasiAi: string | null
  tanggalPemeriksaan: string
  createdAt: string
  updatedAt: string
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * usePemeriksaanHistory — Riwayat pemeriksaan balita untuk grafik Z-Score (Meja 3).
 *
 * staleTime 30 detik — data riwayat tidak sering berubah selama satu sesi pelayanan.
 * Only active when balitaId is non-null.
 */
export function usePemeriksaanHistory(balitaId: string | null) {
  return useQuery<PemeriksaanHistoryItem[]>({
    queryKey: ['pemeriksaan', 'history', balitaId],
    queryFn: () =>
      apiClient
        .get(`/growth/balita/${balitaId}/history`)
        .then((r) => r.data.data as PemeriksaanHistoryItem[]),
    enabled: !!balitaId,
    staleTime: 30_000,
  })
}

/**
 * useCreatePemeriksaan — POST /api/growth/pemeriksaan
 *
 * konfirmasiBiologis: jika true, menambahkan header x-konfirmasi-biologis:true ke request.
 * Ini adalah enforcement side-channel untuk bypass gate BB > 30 kg setelah kader konfirmasi.
 */
export function useCreatePemeriksaan() {
  const qc = useQueryClient()
  return useMutation<
    PemeriksaanRecord,
    Error,
    {
      balitaId: string
      antrianId?: string
      beratBadan: number
      tinggiBadan?: number
      lingkarKepala?: number
      lingkarLengan?: number
      catatanKonsultasi?: string
      konfirmasiBiologis?: boolean
    }
  >({
    mutationFn: async (data) => {
      const { konfirmasiBiologis, ...body } = data
      const headers: Record<string, string> = {}
      if (konfirmasiBiologis) headers['x-konfirmasi-biologis'] = 'true'
      return apiClient
        .post('/growth/pemeriksaan', body, { headers })
        .then((r) => r.data.data as PemeriksaanRecord)
    },
    onSuccess: (data) => {
      // Invalidate riwayat cache setelah pemeriksaan baru dibuat
      void qc.invalidateQueries({
        queryKey: ['pemeriksaan', 'history', data.balitaId],
      })
    },
  })
}

/**
 * usePatchPemeriksaan — PATCH /api/growth/pemeriksaan/:id
 *
 * Digunakan oleh:
 *   Meja 3: patch tandaKlinis + statusGiziOverride
 *   Meja 4: patch rekomendasiAi + catatanKlinis (encrypted at backend)
 */
export function usePatchPemeriksaan() {
  const qc = useQueryClient()
  return useMutation<
    PemeriksaanRecord,
    Error,
    {
      id: string
      tandaKlinis?: Record<string, unknown>
      statusGiziOverride?: string | null
      catatanKlinis?: string
      rekomendasiAi?: string
      catatanKonsultasi?: string
    }
  >({
    mutationFn: async ({ id, ...data }) =>
      apiClient
        .patch(`/growth/pemeriksaan/${id}`, data)
        .then((r) => r.data.data as PemeriksaanRecord),
    onSuccess: (data) => {
      void qc.invalidateQueries({
        queryKey: ['pemeriksaan', 'history', data.balitaId],
      })
    },
  })
}
