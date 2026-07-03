/**
 * ProfilSayaPage — Stub halaman profil citizen.
 *
 * Route: /citizen/profil
 *
 * Menampilkan informasi dasar pengguna dari auth store.
 * Akan dikembangkan lebih lanjut untuk edit profil, ubah password, dll.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'

import { useAuthStore } from '@/stores/useAuthStore'

export default function ProfilSayaPage() {
  const { user } = useAuthStore()

  const firstLetter = user?.namaLengkap?.[0]?.toUpperCase() ?? 'W'

  return (
    <div className="min-h-full bg-[#f9fafb] pb-8">
      {/* Green header */}
      <div className="bg-[#008236] px-4 pt-10 pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/citizen/dashboard"
            className="bg-[rgba(0,166,62,0.5)] rounded-[14px] p-2 flex-shrink-0"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft size={20} className="text-white" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-2xl leading-tight">Profil Saya</h1>
            <p className="text-[#b9f8cf] text-xs mt-0.5">Informasi akun Anda</p>
          </div>
        </div>
      </div>

      {/* User info card */}
      <div className="px-4 mt-4">
        <div className="bg-white border border-[#f3f4f6] rounded-2xl p-6 shadow-sm">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-16 h-16 bg-[#008236] rounded-[18px] flex items-center justify-center mb-3">
              <span className="text-white font-bold text-2xl">{firstLetter}</span>
            </div>
            <p className="text-[#1e2939] font-bold text-lg text-center">
              {user?.namaLengkap ?? 'Warga'}
            </p>
            <span className="mt-1 bg-[#f0fdf4] text-[#008236] text-xs font-medium px-3 py-1 rounded-full">
              Citizen
            </span>
          </div>

          {/* Info rows */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 py-2.5 border-b border-[#f3f4f6]">
              <div className="w-8 h-8 bg-[#f0fdf4] rounded-[10px] flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-[#008236]" />
              </div>
              <div>
                <p className="text-[#99a1af] text-xs">Nama Lengkap</p>
                <p className="text-[#364153] font-semibold text-sm">
                  {user?.namaLengkap ?? '-'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2.5">
              <div className="w-8 h-8 bg-[#f0fdf4] rounded-[10px] flex items-center justify-center flex-shrink-0">
                <span className="text-[#008236] text-xs font-bold">ID</span>
              </div>
              <div>
                <p className="text-[#99a1af] text-xs">Role</p>
                <p className="text-[#364153] font-semibold text-sm capitalize">
                  {user?.role ?? '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming soon features */}
        <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 text-center shadow-sm mt-3">
          <p className="text-[#1e2939] font-semibold text-sm">Fitur Segera Hadir</p>
          <p className="text-[#99a1af] text-xs mt-1 leading-relaxed">
            Edit profil, ubah password, dan pengaturan notifikasi akan tersedia segera.
          </p>
        </div>
      </div>
    </div>
  )
}
