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
    try {
      // CR-05 + WR-06: wrap prompt() in try/finally so the consumed event is ALWAYS
      // cleared, regardless of outcome ('accepted' OR 'dismissed') or whether prompt()
      // itself throws (e.g. called without a user gesture in some browsers).
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[usePwaStore] triggerInstall failed:', err)
    } finally {
      setDeferredPrompt(null) // Always clear — event is consumed regardless of outcome
    }
  },
}))
