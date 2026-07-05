/**
 * FamilyAccountPage — Halaman daftar balita citizen (Keluarga Saya).
 *
 * Route: /citizen/family-account
 *
 * Menampilkan daftar balita yang terdaftar milik citizen yang sedang login,
 * diambil dari GET /api/balita. Fitur add/edit/delete balita out of scope (Tier 4).
 */
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Skeleton } from '@/components/ui/skeleton'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BalitaItem {
  id: string
  namaBalita: string
  tanggalLahir: string
  jenisKelamin: 'laki_laki' | 'perempuan' | string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTanggal(isoString: string): string {
  const d = new Date(isoString)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function labelJenisKelamin(jk: string): string {
  return jk === 'laki_laki' ? 'Laki-laki' : 'Perempuan'
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FamilyAccountPage() {
  const { data: balitaList, isLoading } = useQuery<BalitaItem[]>({
    queryKey: ['balita', 'saya'],
    queryFn: () => apiClient.get('/balita').then((r) => r.data.data as BalitaItem[]),
    staleTime: 60_000,
  })

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
            <h1 className="text-white font-bold text-xl leading-tight">Keluarga Saya</h1>
            <p className="text-[#b9f8cf] text-xs mt-0.5">Daftar balita terdaftar</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 mt-4 space-y-3">
        {/* Loading state */}
        {isLoading && (
          <>
            <Skeleton className="h-[80px] rounded-2xl" />
            <Skeleton className="h-[80px] rounded-2xl" />
            <Skeleton className="h-[80px] rounded-2xl" />
          </>
        )}

        {/* Empty state */}
        {!isLoading && (!balitaList || balitaList.length === 0) && (
          <div className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm px-4 py-6 text-center">
            <p className="text-[#1e2939] font-semibold text-sm">Belum ada balita terdaftar</p>
            <p className="text-[#99a1af] text-xs mt-1 leading-relaxed">
              Hubungi petugas Posyandu untuk mendaftarkan balita Anda.
            </p>
          </div>
        )}

        {/* Balita list */}
        {!isLoading &&
          balitaList &&
          balitaList.length > 0 &&
          balitaList.map((balita) => (
            <div
              key={balita.id}
              className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm px-4 py-4 flex items-center gap-3"
            >
              {/* Avatar — first letter */}
              <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
                <span className="text-[#008236] font-bold text-sm">
                  {balita.namaBalita[0]?.toUpperCase() ?? '?'}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[#1e2939] font-semibold text-sm leading-tight truncate">
                  {balita.namaBalita}
                </p>
                <p className="text-[#99a1af] text-xs mt-0.5">
                  {formatTanggal(balita.tanggalLahir)}
                </p>
              </div>

              {/* Gender badge */}
              <span className="bg-[#f3f4f6] text-[#364153] rounded-[10px] px-2 py-0.5 text-xs flex-shrink-0">
                {labelJenisKelamin(balita.jenisKelamin)}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
