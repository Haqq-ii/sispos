/**
 * useOfflinePendingCount — Lightweight hook to read offline pending queue count.
 *
 * ONLY reads countPending() from IDB — does NOT register sync listeners, does NOT
 * call syncAll(). This prevents the dual-syncAll() race caused by SyncPendingBadge
 * importing useOfflineSync (which itself registers an 'online' event listener).
 *
 * Refreshes the count:
 *   - On mount
 *   - On window 'online' event (to reflect count after auto-sync completes)
 *
 * Used by SyncPendingBadge so every Meja page that renders the badge does NOT
 * create an additional independent useOfflineSync instance.
 */
import { useState, useEffect } from 'react'
import { countPending } from '@/lib/offline-db'

export function useOfflinePendingCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Initial count on mount
    void countPending().then(setCount)

    // Refresh after reconnect (auto-sync may have cleared some items)
    const refresh = () => { void countPending().then(setCount) }
    window.addEventListener('online', refresh)
    return () => {
      window.removeEventListener('online', refresh)
    }
  }, [])

  return count
}
