import { create } from 'zustand'

interface BalitaStore {
  selectedBalitaId: string | null
  setSelectedBalitaId: (id: string) => void
  clearSelectedBalita: () => void
}

export const useBalitaStore = create<BalitaStore>((set) => ({
  selectedBalitaId: null,
  setSelectedBalitaId: (id) => set({ selectedBalitaId: id }),
  clearSelectedBalita: () => set({ selectedBalitaId: null }),
}))
