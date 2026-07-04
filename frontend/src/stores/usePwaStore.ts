/**
 * usePwaStore — Zustand UI store for PWA install prompt state (D-16, D-17).
 *
 * Captures the browser's `beforeinstallprompt` event so we can show a custom
 * "Pasang Aplikasi" button in KaderDashboardPage instead of the default browser
 * install prompt. Exposes `triggerInstall()` to imperatively invoke the prompt.
 *
 * NOTE: `BeforeInstallPromptEvent` is not in standard lib.dom.d.ts — defined here
 * and exported for use in App.tsx.
 */
import { create } from 'zustand'

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaState {
  deferredPrompt: BeforeInstallPromptEvent | null
  setDeferredPrompt(e: BeforeInstallPromptEvent | null): void
  triggerInstall(): Promise<void>
}

export const usePwaStore = create<PwaState>((set, get) => ({
  deferredPrompt: null,

  setDeferredPrompt(e) {
    set({ deferredPrompt: e })
  },

  async triggerInstall() {
    const { deferredPrompt, setDeferredPrompt } = get()
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  },
}))
