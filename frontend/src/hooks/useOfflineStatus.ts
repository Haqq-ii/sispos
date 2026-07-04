/**
 * useOfflineStatus — Reactive hook that tracks navigator.onLine.
 *
 * Returns true when the browser believes the device is online,
 * false when offline. Re-renders consumers immediately on
 * window 'online' and 'offline' events.
 *
 * Note: navigator.onLine reflects any network connection — not
 * whether the specific API server is reachable. Soft-offline
 * (connected but server unreachable) is handled at mutation
 * level via ERR_NETWORK detection.
 */
import { useState, useEffect } from 'react'

export function useOfflineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
