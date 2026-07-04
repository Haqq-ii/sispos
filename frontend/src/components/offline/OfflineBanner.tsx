/**
 * OfflineBanner — Fixed orange top banner displayed when navigator.onLine is false.
 *
 * Renders null when online — zero DOM footprint when not needed.
 * Renders a fixed-position bar when offline so kader always sees the indicator
 * regardless of scroll position (D-07).
 *
 * Copy: "Mode Offline — data tersimpan lokal" (per UI-SPEC Copywriting Contract — no period).
 */
import { WifiOff } from 'lucide-react'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'

export function OfflineBanner() {
  const isOnline = useOfflineStatus()

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-600 text-white py-3 px-4 flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4 text-orange-200" />
      <span className="text-xs font-bold">Mode Offline — data tersimpan lokal</span>
    </div>
  )
}
