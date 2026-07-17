import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RolePengguna = 'citizen' | 'kader' | 'ketua_kader' | 'puskesmas'

export interface AuthUser {
  id: string
  namaLengkap: string
  role: RolePengguna
  posyanduUtamaId?: string | null
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  setUser: (user: AuthUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearAuth: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'sispos-auth', // localStorage key
      partialize: (state) => ({
        user: state.user, // Only persist user; isAuthenticated derived
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

