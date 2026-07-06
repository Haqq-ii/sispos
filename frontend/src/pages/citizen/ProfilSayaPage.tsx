/**
 * ProfilSayaPage — Halaman profil citizen (Figma Make WargaProfilePage).
 *
 * Route: /citizen/profil
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Shield,
  Bell,
  Lock,
  ChevronRight,
  LogOut,
} from 'lucide-react'

import { useAuthStore } from '@/stores/useAuthStore'
import { useToast } from '@/hooks/use-toast'
import apiClient from '@/lib/axios'

export default function ProfilSayaPage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { toast } = useToast()
  const [editingLocation, setEditingLocation] = useState(false)

  // NIK masking: show first 8 + ... + last 4 chars
  const rawNik = (user as { nik?: string } | null)?.nik ?? ''
  const maskedNik =
    rawNik.length >= 12
      ? `${rawNik.slice(0, 8)}...${rawNik.slice(-4)}`
      : rawNik || '—'

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore — clear session regardless
    }
    clearAuth()
    navigate('/login', { replace: true })
  }

  function handleSettingClick(label: string) {
    toast({ description: `${label} — Fitur segera hadir.` })
  }

  return (
    <div className="min-h-full bg-gray-50 pb-24 md:pb-8">
      {/* ── Green header ─────────────────────────────────────────────────── */}
      <div className="bg-green-700 px-4 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="bg-green-600/50 rounded-xl p-2 flex-shrink-0"
            aria-label="Kembali"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <h1 className="text-white font-bold text-xl">Profil Saya</h1>
        </div>

        {/* Avatar + info */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl border-2 border-white/40 flex items-center justify-center mb-3">
            <User size={28} className="text-white" />
          </div>
          <p className="text-white font-bold text-lg text-center">
            {user?.namaLengkap ?? 'Warga'}
          </p>
          <p className="text-green-200 text-xs mt-0.5">{maskedNik}</p>
          <div className="flex items-center gap-1.5 mt-2 bg-green-600/50 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-300 rounded-full" />
            <span className="text-green-100 text-xs font-medium">Akun Terverifikasi</span>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3 mt-4">
        {/* ── Lokasi Domisili card ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-green-700" />
              <span className="text-gray-800 font-semibold text-sm">Lokasi Domisili</span>
            </div>
            <button
              onClick={() => setEditingLocation(!editingLocation)}
              className="text-green-700 text-xs font-medium"
            >
              {editingLocation ? 'Batal' : 'Ubah'}
            </button>
          </div>

          {!editingLocation ? (
            <div className="px-4 py-3 space-y-2">
              {[
                { label: 'Provinsi', value: '—' },
                { label: 'Kabupaten', value: '—' },
                { label: 'Kecamatan', value: '—' },
                { label: 'Kelurahan', value: '—' },
                { label: 'RW/RT', value: '—' },
                { label: 'Posyandu', value: '—' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-1">
                  <span className="text-gray-400 text-xs">{row.label}</span>
                  <span className="text-gray-700 text-xs font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-gray-500 text-sm mb-3">
                Fitur ini memerlukan verifikasi ulang data identitas Anda.
              </p>
              <button
                onClick={() => setEditingLocation(false)}
                className="w-full bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl mb-2"
              >
                Mulai Ubah Lokasi
              </button>
              <button
                onClick={() => setEditingLocation(false)}
                className="w-full text-gray-500 text-sm py-2"
              >
                Batal
              </button>
            </div>
          )}
        </div>

        {/* ── Kontak card ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <Phone size={16} className="text-green-700" />
            <span className="text-gray-800 font-semibold text-sm">Kontak</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400 text-xs">No. HP</span>
              <span className="text-gray-700 text-xs font-medium">
                {(user as { noHp?: string } | null)?.noHp ?? '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400 text-xs">Notifikasi WhatsApp</span>
              <span className="text-green-700 text-xs font-medium">Aktif</span>
            </div>
          </div>
        </div>

        {/* ── Pengaturan Akun card ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <Shield size={16} className="text-green-700" />
            <span className="text-gray-800 font-semibold text-sm">Pengaturan Akun</span>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              {
                icon: Bell,
                label: 'Kelola Notifikasi',
                sub: 'Atur preferensi notifikasi',
              },
              {
                icon: Lock,
                label: 'Ubah Kata Sandi',
                sub: 'Ganti password akun',
              },
              {
                icon: Shield,
                label: 'Privasi & Data',
                sub: 'Kelola data pribadi Anda',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={() => handleSettingClick(item.label)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-medium">{item.label}</p>
                    <p className="text-gray-400 text-xs">{item.sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Logout button ────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full py-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm"
        >
          <LogOut size={16} />
          Keluar dari Akun
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 py-2">
          SISPOS v1.0 · Data dilindungi enkripsi AES-256
        </p>
      </div>
    </div>
  )
}
