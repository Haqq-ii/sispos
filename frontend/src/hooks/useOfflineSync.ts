/**
 * useOfflineSync — Offline queue engine for SISPOS kader 5-meja flow.
 *
 * Exposes:
 *   enqueueOperation() — write one item to the correct IDB queue store
 *   syncAll()          — replay all queued items to the backend in FIFO order
 *   pendingCount       — total pending items across all 3 queue stores
 *
 * syncAll() is triggered automatically on window 'online' event via a stable
 * ref pattern (avoids stale closure on the handler).
 *
 * Sync conflict strategy (D-04): per-item try/catch; 422 or 409 → logSyncError
 * + skip. One bad item never aborts the full batch.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import apiClient from '@/lib/axios'
import { getOfflineDB, logSyncError, countPending } from '@/lib/offline-db'

// ─── Types ────────────────────────────────────────────────────────────────────

type QueueType = 'kehadiran' | 'pemeriksaan' | 'meja5'

interface UseOfflineSyncReturn {
  pendingCount: number
  enqueueOperation: (queueType: QueueType, payload: Record<string, unknown>) => Promise<void>
  syncAll: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineSync(): UseOfflineSyncReturn {
  const [pendingCount, setPendingCount] = useState(0)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { setActivePemeriksaanId } = useKaderMejaStore()

  // ── Refresh pending count from IDB ──────────────────────────────────────────

  const refreshCount = useCallback(async () => {
    const count = await countPending()
    setPendingCount(count)
  }, [])

  // Initialize count on mount
  useEffect(() => {
    void refreshCount()
  }, [refreshCount])

  // ── Enqueue one operation to the correct store ───────────────────────────────

  const enqueueOperation = useCallback(
    async (queueType: QueueType, payload: Record<string, unknown>): Promise<void> => {
      const db = await getOfflineDB()
      const storeName = `${queueType}_queue` as
        | 'kehadiran_queue'
        | 'pemeriksaan_queue'
        | 'meja5_queue'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.add(storeName, payload as any)
      await refreshCount()
    },
    [refreshCount]
  )

  // ── Sync all queues to backend (FIFO per store) ──────────────────────────────

  const syncAll = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) return

    const db = await getOfflineDB()
    let skipCount = 0

    // ── 1. kehadiran_queue ─────────────────────────────────────────────────────
    const kehadiranItems = await db.getAllFromIndex('kehadiran_queue', 'by_timestamp')
    for (const item of kehadiranItems) {
      try {
        await apiClient.patch(`/antrian/${item.antrianId}/${item.action}`)
        await db.delete('kehadiran_queue', item.id)
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status ?? 0
        const message = (err as Error).message ?? 'Unknown error'
        if (status === 422 || status === 409) {
          await logSyncError(item as unknown as Record<string, unknown>, status, message)
          skipCount++
        }
        // Non-4xx errors (network/5xx): leave in queue for next sync attempt
      }
    }

    // ── 2. pemeriksaan_queue ───────────────────────────────────────────────────
    const pemeriksaanItems = await db.getAllFromIndex('pemeriksaan_queue', 'by_timestamp')
    const tempIdMap: Record<string, string> = {}

    for (const item of pemeriksaanItems) {
      try {
        if (item.type === 'create') {
          const response = await apiClient.post('/growth/pemeriksaan', item.data)
          const realId = (response.data as { data?: { id?: string } }).data?.id ?? ''
          if (realId) {
            tempIdMap[item.tempPemeriksaanId] = realId
            setActivePemeriksaanId(realId)
          }
          await db.delete('pemeriksaan_queue', item.id)
        } else {
          // patch-tanda-klinis or patch-catatan
          const resolvedId = tempIdMap[item.tempPemeriksaanId] ?? item.tempPemeriksaanId
          await apiClient.patch(`/growth/pemeriksaan/${resolvedId}`, item.data)
          await db.delete('pemeriksaan_queue', item.id)
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status ?? 0
        const message = (err as Error).message ?? 'Unknown error'
        if (status === 422 || status === 409) {
          await logSyncError(item as unknown as Record<string, unknown>, status, message)
          skipCount++
        }
        // Non-4xx errors: leave in queue
      }
    }

    // ── 3. meja5_queue ─────────────────────────────────────────────────────────
    const meja5Items = await db.getAllFromIndex('meja5_queue', 'by_timestamp')
    for (const item of meja5Items) {
      try {
        if (item.type === 'immunization') {
          await apiClient.post('/immunization', item.data)
        } else {
          // selesai
          const antrianId = (item.data as { antrianId?: string }).antrianId ?? ''
          await apiClient.patch(`/antrian/${antrianId}/selesai`)
        }
        await db.delete('meja5_queue', item.id)
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status ?? 0
        const message = (err as Error).message ?? 'Unknown error'
        if (status === 422 || status === 409) {
          await logSyncError(item as unknown as Record<string, unknown>, status, message)
          skipCount++
        }
        // Non-4xx errors: leave in queue
      }
    }

    // ── 4. Toast result (D-10) ─────────────────────────────────────────────────
    if (skipCount === 0) {
      toast({ description: 'Data berhasil disinkronkan' })
    } else {
      toast({
        description: `Gagal sinkronkan ${skipCount} data — lihat rekap harian`,
        variant: 'destructive',
      })
    }

    // ── 5. Invalidate antrian query + refresh pending count ────────────────────
    await queryClient.invalidateQueries({ queryKey: ['antrian', 'kader'] })
    await refreshCount()
  }, [toast, queryClient, setActivePemeriksaanId, refreshCount])

  // ── Wire 'online' event via stable ref (avoids stale closure) ────────────────

  const syncAllRef = useRef(syncAll)
  useEffect(() => {
    syncAllRef.current = syncAll
  }, [syncAll])

  useEffect(() => {
    const handler = () => {
      void syncAllRef.current()
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [])

  return { pendingCount, enqueueOperation, syncAll }
}
