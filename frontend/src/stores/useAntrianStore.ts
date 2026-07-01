import { create } from 'zustand'

/**
 * Transient navigation state for antrian wizard.
 * Do NOT store antrian data here — use TanStack Query.
 * No persist() middleware — clearing on tab close is correct behavior for wizard flow state.
 */
interface AntrianState {
  selectedDate: string | null // format: 'YYYY-MM-DD'
  selectedSlotId: string | null
  selectedBalitaId: string | null
  setSelectedDate: (date: string | null) => void
  setSelectedSlotId: (slotId: string | null) => void
  setSelectedBalitaId: (balitaId: string | null) => void
  reset: () => void
}

export const useAntrianStore = create<AntrianState>((set) => ({
  selectedDate: null,
  selectedSlotId: null,
  selectedBalitaId: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedSlotId: (slotId) => set({ selectedSlotId: slotId }),
  setSelectedBalitaId: (balitaId) => set({ selectedBalitaId: balitaId }),
  reset: () =>
    set({ selectedDate: null, selectedSlotId: null, selectedBalitaId: null }),
}))
