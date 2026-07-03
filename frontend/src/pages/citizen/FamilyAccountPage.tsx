/**
 * FamilyAccountPage — Stub halaman Family Account citizen.
 *
 * Route: /citizen/family-account
 *
 * Placeholder untuk fitur pengelolaan profil balita dalam satu akun keluarga.
 * Akan diisi pada fase pengembangan berikutnya.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'

export default function FamilyAccountPage() {
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
            <h1 className="text-white font-bold text-2xl leading-tight">Family Account</h1>
            <p className="text-[#b9f8cf] text-xs mt-0.5">Kelola profil balita Anda</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-[#f0fdf4] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-[#008236]" />
          </div>
          <p className="text-[#1e2939] font-semibold text-base">Fitur Segera Hadir</p>
          <p className="text-[#99a1af] text-sm mt-1 leading-relaxed">
            Kelola akun keluarga dan profil balita di sini.
          </p>
        </div>
      </div>
    </div>
  )
}
