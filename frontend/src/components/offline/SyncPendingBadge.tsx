/**
 * SyncPendingBadge — Orange pill badge showing count of pending offline sync items.
 *
 * Renders null when pendingCount === 0 — no DOM footprint when queue is empty (D-09).
 * Placed in Meja page headers to give kader visibility of offline data awaiting sync.
 *
 * Copy: "{N} pending" (per UI-SPEC §2 Copywriting Contract).
 *
 * NOTE: Uses useOfflinePendingCount (NOT useOfflineSync) to avoid creating an extra
 * 'online' sync listener in every Meja page that already calls useOfflineSync directly.
 * Each useOfflineSync instance registers its own listener; two concurrent syncAll() runs
 * per page would cause duplicate API writes (CR-02).
 */
import { useOfflinePendingCount } from '@/hooks/useOfflinePendingCount'

export function SyncPendingBadge() {
  const pendingCount = useOfflinePendingCount()

  if (pendingCount === 0) return null

  return (
    <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
      {pendingCount} pending
    </span>
  )
}
