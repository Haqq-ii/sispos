import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Skeleton } from '@/components/ui/skeleton'
import { TambahBalitaModal } from '@/components/citizen/TambahBalitaModal'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BalitaItem {
  id: string
  namaBalita: string
  tanggalLahir: string
  jenisKelamin: 'laki_laki' | 'perempuan' | string
}

interface ActiveAntrian {
  id: string
  balitaId: string
  statusAntrian: string
  nomorUrut: number
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

function getInitialBg(nama: string): string {
  const colors = ['bg-green-100', 'bg-blue-100', 'bg-purple-100', 'bg-amber-100', 'bg-pink-100']
  return colors[nama.charCodeAt(0) % colors.length]
}

function getInitialText(nama: string): string {
  const colors = [
    'text-green-700',
    'text-blue-700',
    'text-purple-700',
    'text-amber-700',
    'text-pink-700',
  ]
  return colors[nama.charCodeAt(0) % colors.length]
}

// ── FamilyAccountPage ──────────────────────────────────────────────────────────

export default function FamilyAccountPage() {
  const { data: balitaList, isLoading: loadingBalita } = useQuery<BalitaItem[]>({
    queryKey: ['balita', 'saya'],
    queryFn: () => apiClient.get('/balita').then((r) => r.data.data as BalitaItem[]),
    staleTime: 60_000,
  })

  const { data: activeAntrian } = useQuery<ActiveAntrian | null>({
    queryKey: ['antrian', 'saya'],
    queryFn: () =>
      apiClient
        .get('/antrian/saya')
        .then((r) => (r.data.data as ActiveAntrian) ?? null)
        .catch(() => null),
    staleTime: 30_000,
  })

  const isLoading = loadingBalita
  const [showTambah, setShowTambah] = useState(false)

  return (
    <>
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
            <h1 className="text-white font-bold text-xl leading-tight">Family Account</h1>
            <p className="text-[#b9f8cf] text-xs mt-0.5">Multi-profil balita dalam satu akun</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 mt-4 space-y-3">
        {/* Loading state */}
        {isLoading && (
          <>
            <Skeleton className="h-[88px] rounded-2xl" />
            <Skeleton className="h-[88px] rounded-2xl" />
            <Skeleton className="h-[88px] rounded-2xl" />
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
          balitaList.map((balita) => {
            const hasAntrian =
              activeAntrian?.balitaId === balita.id &&
              activeAntrian.statusAntrian !== 'selesai' &&
              activeAntrian.statusAntrian !== 'dibatalkan'

            const bg = getInitialBg(balita.namaBalita)
            const textColor = getInitialText(balita.namaBalita)

            return (
              <div
                key={balita.id}
                className={`bg-white border-2 rounded-2xl shadow-sm px-4 py-4 flex items-center gap-3 transition-colors ${
                  hasAntrian ? 'border-[#008236]' : 'border-[#f3f4f6]'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}
                >
                  <span className={`${textColor} font-extrabold text-xl`}>
                    {balita.namaBalita[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[#1e2939] font-bold text-sm leading-tight truncate">
                    {balita.namaBalita}
                  </p>
                  <p className="text-[#99a1af] text-xs mt-0.5">
                    {labelJenisKelamin(balita.jenisKelamin)} · Lahir {formatTanggal(balita.tanggalLahir)}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-semibold ${
                      hasAntrian
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {hasAntrian
                      ? `Antrian Aktif · No. ${activeAntrian!.nomorUrut}`
                      : 'Belum Antri'}
                  </span>
                </div>

                {/* Detail link */}
                <Link
                  to="/citizen/tumbuh-kembang"
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 transition-colors ${
                    hasAntrian
                      ? 'bg-[#008236] text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {hasAntrian ? '✓ Aktif' : 'Lihat'}
                </Link>
              </div>
            )
          })}

        {/* Tambah Profil Anak */}
        {!isLoading && (
          <button
            onClick={() => setShowTambah(true)}
            className="w-full py-3.5 border-2 border-dashed border-[#b9f8cf] text-[#008236] rounded-2xl text-sm flex items-center justify-center gap-2 font-semibold hover:bg-green-50 transition-colors active:scale-95"
          >
            <Plus size={16} />
            Tambah Profil Anak
          </button>
        )}
      </div>
    </div>

    <TambahBalitaModal open={showTambah} onClose={() => setShowTambah(false)} />
    </>
  )
}
