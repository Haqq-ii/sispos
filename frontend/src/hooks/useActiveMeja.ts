/**
 * useActiveMeja — TanStack Query hook untuk GET /api/kader/active-meja.
 *
 * staleTime: 0 + refetchOnMount: true = always re-check Redis saat mount.
 * Ini adalah lock-screen recovery hook — kader reload halaman → hook ini
 * bertanya ke Redis → jika ada meja aktif → redirect ke /kader/meja/{N}.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ActiveMejaData {
  activeMeja: number
  slotId: string
}

// ── useActiveMeja (query) ──────────────────────────────────────────────────────

/**
 * Fetch current active meja from Redis.
 * Returns null if no active meja.
 */
export function useActiveMeja() {
  return useQuery<ActiveMejaData | null>({
    queryKey: ['kader', 'active-meja'],
    queryFn: () =>
      apiClient
        .get('/kader/active-meja')
        .then((r) => r.data.data as ActiveMejaData | null),
    staleTime: 0,          // Always fresh — ini adalah lock state
    refetchOnMount: true,  // Re-check setiap mount (page reload)
  })
}

// ── useMutationSetActiveMeja ───────────────────────────────────────────────────

/**
 * Set active meja in Redis (PATCH /api/kader/active-meja).
 * Called when kader clicks a meja button on LockScreenPage.
 */
export function useMutationSetActiveMeja() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { mejaNumber: number; slotId: string }) =>
      apiClient
        .patch('/kader/active-meja', body)
        .then((r) => r.data.data as ActiveMejaData),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kader', 'active-meja'] })
    },
  })
}

// ── useMutationClearActiveMeja ─────────────────────────────────────────────────

/**
 * Clear active meja from Redis (DELETE /api/kader/active-meja).
 * Called when kader clicks "Keluar Meja" on any meja page.
 */
export function useMutationClearActiveMeja() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient.delete('/kader/active-meja').then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kader', 'active-meja'] })
    },
  })
}
