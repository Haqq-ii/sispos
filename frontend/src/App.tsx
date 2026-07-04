import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from '@/router'
import { Toaster } from '@/components/ui/toaster'
import { OfflineBanner } from '@/components/offline/OfflineBanner'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { usePwaStore, type BeforeInstallPromptEvent } from '@/stores/usePwaStore'

export default function App() {
  const { setDeferredPrompt } = usePwaStore()
  const isOnline = useOfflineStatus()

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [setDeferredPrompt])

  return (
    <BrowserRouter>
      <OfflineBanner />
      {/* 40px spacer prevents Meja page content from hiding under the fixed OfflineBanner (UI-SPEC §1) */}
      {!isOnline && <div className="h-10" aria-hidden="true" />}
      <AppRouter />
      <Toaster />
    </BrowserRouter>
  )
}
