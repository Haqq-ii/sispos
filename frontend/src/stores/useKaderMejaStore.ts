/**
 * useKaderMejaStore — Zustand store for kader meja (desk) session state.
 *
 * CRITICAL RULES:
 * - isLocked IS persisted to localStorage (survive reload before API responds)
 * - activeMeja + activeSlotId are NOT persisted — Redis (GET /api/kader/active-meja) is truth
 * - activePemeriksaanId is NOT persisted — set after Meja 2 creates Pemeriksaan record
 *
 * On page reload: isLocked = true (from localStorage) → UI shows locked state immediately
 * while GET /api/kader/active-meja resolves activeMeja + activeSlotId from Redis.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface KaderMejaState {
  /** Active meja number (1-5). Transient — restored from Redis on mount. */
  activeMeja: number | null
  /** Active slot ID. Transient — restored from Redis on mount. */
  activeSlotId: string | null
  /** Active pemeriksaan ID. Set by Meja 2 after creating Pemeriksaan record. */
  activePemeriksaanId: string | null
  /** Lock state. Persisted to localStorage so UI immediately shows locked on reload. */
  isLocked: boolean

  /** Set activeMeja and activeSlotId atomically (avoid partial state). */
  setActiveMeja: (meja: number | null, slotId: string | null) => void
  /** Set pemeriksaanId after Meja 2 saves the record. */
  setActivePemeriksaanId: (id: string | null) => void
  /** Toggle lock state (true = hide navbar, enter meja mode). */
  setLocked: (locked: boolean) => void
  /** Clear all state including isLocked (kader exits meja). */
  reset: () => void
}

export const useKaderMejaStore = create<KaderMejaState>()(
  persist(
    (set) => ({
      activeMeja: null,
      activeSlotId: null,
      activePemeriksaanId: null,
      isLocked: false,

      setActiveMeja: (meja, slotId) =>
        set({ activeMeja: meja, activeSlotId: slotId }),

      setActivePemeriksaanId: (id) =>
        set({ activePemeriksaanId: id }),

      setLocked: (locked) =>
        set({ isLocked: locked }),

      reset: () =>
        set({
          activeMeja: null,
          activeSlotId: null,
          activePemeriksaanId: null,
          isLocked: false,
        }),
    }),
    {
      name: 'sispos-kader-meja', // localStorage key
      // ONLY persist isLocked — activeMeja/activeSlotId come from Redis on mount
      partialize: (s) => ({ isLocked: s.isLocked }),
    }
  )
)
