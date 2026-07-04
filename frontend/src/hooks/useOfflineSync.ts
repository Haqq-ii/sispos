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
          try {
            await logSyncError(item as unknown as Record<string, unknown>, status, message)
          } catch {
            // IDB write failed — log to console; do not abort the sync loop
            console.warn('[syncAll] Failed to write sync_error for kehadiran item', item.id)
          }
          // CR-03: delete the item so it is not retried on the next sync (hard failure)
          await db.delete('kehadiran_queue', item.id)
          skipCount++
        }
        // Non-4xx errors (network/5xx): leave in queue for next sync attempt
      }
    }

    // ── 2. pemeriksaan_queue ───────────────────────────────────────────────────
    const pemeriksaanItems = await db.getAllFromIndex('pemeriksaan_queue', 'by_timestamp')

    // CR-04: Persist tempId→realId map in localStorage so patch items can resolve
    // the real server ID even if the network drops between 'create' and 'patch' syncs.
    const TEMP_ID_MAP_KEY = 'sispos-temp-id-map'
    const loadTempIdMap = (): Record<string, string> => {
      try {
        const raw = localStorage.getItem(TEMP_ID_MAP_KEY)
        return raw ? (JSON.parse(raw) as Record<string, string>) : {}
      } catch {
        return {}
      }
    }
    const saveTempIdMap = (map: Record<string, string>): void => {
      try {
        localStorage.setItem(TEMP_ID_MAP_KEY, JSON.stringify(map))
      } catch {
        // localStorage full — non-fatal; patch may fall back to tempId (404 on server)
        console.warn('[syncAll] Failed to persist tempIdMap to localStorage')
      }
    }

    // In-memory map for this sync pass; seeded from persisted localStorage map
    const tempIdMap: Record<string, string> = loadTempIdMap()

    for (const item of pemeriksaanItems) {
      try {
        if (item.type === 'create') {
          const response = await apiClient.post('/growth/pemeriksaan', item.data)
          const realId = (response.data as { data?: { id?: string } }).data?.id ?? ''
          if (realId) {
            // CR-04: persist the tempId→realId mapping before deleting the create item
            tempIdMap[item.tempPemeriksaanId] = realId
            saveTempIdMap(tempIdMap)
            setActivePemeriksaanId(realId)
          }
          await db.delete('pemeriksaan_queue', item.id)
        } else {
          // patch-tanda-klinis or patch-catatan
          // CR-04: resolve from in-memory map (populated by this pass or a prior pass)
          //        then fall back to localStorage map for cross-syncAll() continuity
          const resolvedId = tempIdMap[item.tempPemeriksaanId]
            ?? loadTempIdMap()[item.tempPemeriksaanId]
            ?? item.tempPemeriksaanId
          await apiClient.patch(`/growth/pemeriksaan/${resolvedId}`, item.data)
          // CR-04: clear the localStorage entry after a successful patch
          const currentMap = loadTempIdMap()
          delete currentMap[item.tempPemeriksaanId]
          saveTempIdMap(currentMap)
          delete tempIdMap[item.tempPemeriksaanId]
          await db.delete('pemeriksaan_queue', item.id)
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status ?? 0
        const message = (err as Error).message ?? 'Unknown error'
        if (status === 422 || status === 409) {
          try {
            await logSyncError(item as unknown as Record<string, unknown>, status, message)
          } catch {
            console.warn('[syncAll] Failed to write sync_error for pemeriksaan item', item.id)
          }
          // CR-03: delete item to prevent infinite retry on hard failure
          await db.delete('pemeriksaan_queue', item.id)
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
          try {
            await logSyncError(item as unknown as Record<string, unknown>, status, message)
          } catch {
            console.warn('[syncAll] Failed to write sync_error for meja5 item', item.id)
          }
          // CR-03: delete item to prevent infinite retry on hard failure
          await db.delete('meja5_queue', item.id)
          skipCount++
        }
        // Non-4xx errors: leave in queue
      }
    }

    // ── 4. Toast result (D-10) ─────────────────────────────────────────────────
    const syncedCount =
      kehadiranItems.length + pemeriksaanItems.length + meja5Items.length - skipCount
    if (skipCount > 0) {
      toast({
        description: `Gagal sinkronkan ${skipCount} data — lihat rekap harian`,
        variant: 'destructive',
      })
    } else if (syncedCount > 0) {
      // Only show success toast when there was actually something to sync
      toast({ description: 'Data berhasil disinkronkan' })
    }
    // No toast if queue was empty (avoids noise on every reconnect)

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
