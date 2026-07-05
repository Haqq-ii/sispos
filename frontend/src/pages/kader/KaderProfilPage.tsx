/**
 * KaderProfilPage — Profil Kader Posyandu
 * Figma: 27:4566
 *
 * Menampilkan data kader dari useAuthStore:
 *   - Avatar dengan inisial namaLengkap
 *   - Nama lengkap + role chip
 *   - Info card: Role
 *   - Tombol Logout yang memanggil POST /api/auth/logout
 *
 * Data: diambil dari useAuthStore (JWT sudah di-parse saat login).
 * Logout: onSettled clear auth + navigate ke /login regardless of success/error.
 */
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { LogOut, Shield, User } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRoleLabel(role: string): string {
  switch (role) {
    case 'ketua_kader':
      return 'Ketua Kader'
    case 'kader':
      return 'Kader Posyandu'
    default:
      return role
  }
}

function getInitial(namaLengkap?: string): string {
  return namaLengkap?.[0]?.toUpperCase() ?? 'K'
}

// ── KaderProfilPage ───────────────────────────────────────────────────────────

export default function KaderProfilPage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  // logout — onSettled: clear local auth + redirect regardless of API result
  const logoutMutation = useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSettled: () => {
      clearAuth()
      navigate('/login', { replace: true })
    },
  })

  const roleLabel = getRoleLabel(user?.role ?? 'kader')

  return (
    <div className="min-h-full bg-[#f9fafb] pb-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-5 pt-10 pb-6">
        <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Kader</p>
        <h1 className="text-white font-bold text-xl leading-tight">Profil Kader</h1>
        <p className="text-[#b9f8cf] text-xs mt-1">Kelola akun kader Posyandu</p>
      </div>

      {/* ── Avatar Section ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center text-center -mt-8 px-4">
        <div className="w-20 h-20 rounded-full bg-[#dcfce7] border-4 border-white shadow-md flex items-center justify-center mb-3">
          <span className="text-[#008236] font-bold text-3xl">
            {getInitial(user?.namaLengkap)}
          </span>
        </div>

        <h2 className="text-[#1e2939] font-bold text-xl leading-tight">
          {user?.namaLengkap ?? 'Kader'}
        </h2>

        <span className="mt-2 inline-block bg-[#f0fdf4] text-[#008236] text-xs font-semibold px-3 py-1 rounded-full border border-[#bbf7d0]">
          {roleLabel}
        </span>
      </div>

      {/* ── Info Cards ──────────────────────────────────────────────────── */}
      <div className="px-4 mt-6 space-y-3">
        {/* Card: Nama Lengkap */}
        <div className="bg-white border border-[#f3f4f6] rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f0fdf4] flex items-center justify-center shrink-0">
            <User size={18} className="text-[#008236]" />
          </div>
          <div>
            <p className="text-[#99a1af] text-xs">Nama Lengkap</p>
            <p className="text-[#1e2939] font-semibold text-sm">
              {user?.namaLengkap ?? '—'}
            </p>
          </div>
        </div>

        {/* Card: Role */}
        <div className="bg-white border border-[#f3f4f6] rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f0fdf4] flex items-center justify-center shrink-0">
            <Shield size={18} className="text-[#008236]" />
          </div>
          <div>
            <p className="text-[#99a1af] text-xs">Role</p>
            <p className="text-[#1e2939] font-semibold text-sm">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* ── Logout Button ────────────────────────────────────────────────── */}
      <div className="px-4 mt-6">
        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] font-semibold rounded-[14px] py-3.5 hover:bg-[#fee2e2] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LogOut size={16} />
          {logoutMutation.isPending ? 'Keluar...' : 'Keluar dari Akun'}
        </button>
      </div>
    </div>
  )
}
