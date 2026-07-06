/**
 * CitizenDashboardPage — Redesigned dashboard citizen (Figma Make WargaDashboard).
 *
 * Layout:
 * - Green header: greeting + notification bell + inline notif panel
 * - Section A (antrian aktif): status-colored card dengan nomor, estimasi
 * - Section B (tidak ada antrian): dashed white CTA card
 * - Quick Actions 2x2 grid
 * - Profil Balita card
 * - Tips Gizi banner
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarPlus,
  TrendingUp,
  MessageSquare,
  Heart,
  Clock,
  ChevronRight,
  Bell,
  Info,
  Users,
} from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/useAuthStore'
import { computeCountdown } from '@/hooks/useCountdownEstimasi'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BalitaChip {
  id: string
  namaBalita: string
  jenisKelamin: string
}

type StatusAntrianValue =
  | 'menunggu'
  | 'dipanggil'
  | 'selesai'
  | 'ditangguhkan'
  | 'tidak_hadir'
  | 'dibatalkan'

interface AntrianAktif {
  id: string
  nomorUrut: number
  nomorAktif: number
  sisaAntrian: number
  statusAntrian: StatusAntrianValue
  slotId: string
  slotSesi?: {
    durasiRataAktual?: number | null
    jamMulai?: string
    jadwal?: {
      estimasiDurasiMenit: number
      posyandu?: {
        namaPosyandu: string
        kecamatan?: string
      }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatJam(timeStr: string | undefined): string {
  if (!timeStr) return ''
  if (timeStr.includes('T')) return timeStr.substring(11, 16)
  return timeStr.substring(0, 5)
}

interface StatusColors {
  bg: string
  border: string
  text: string
  dot: string
  numColor: string
}

function getAntrianColors(status: StatusAntrianValue | undefined): StatusColors {
  switch (status) {
    case 'dipanggil':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        dot: 'bg-green-500',
        numColor: 'text-green-700',
      }
    case 'menunggu':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        dot: 'bg-blue-500',
        numColor: 'text-blue-700',
      }
    case 'ditangguhkan':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        numColor: 'text-amber-700',
      }
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-600',
        dot: 'bg-gray-400',
        numColor: 'text-gray-600',
      }
  }
}

// ── Notifikasi statis ─────────────────────────────────────────────────────────

const NOTIF_ITEMS = [
  { id: 1, text: 'Jadwal posyandu bulan ini sudah dibuka. Segera ambil nomor antrian.' },
  { id: 2, text: 'Tips gizi: berikan ASI eksklusif hingga usia 6 bulan untuk tumbuh kembang optimal.' },
  { id: 3, text: 'Jangan lupa imunisasi rutin — proteksi terbaik untuk si kecil.' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function CitizenDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [notifOpen, setNotifOpen] = useState(false)
  const [selectedBalitaId, setSelectedBalitaId] = useState<string | null>(null)

  // Fetch daftar balita untuk chip selector di header
  const { data: balitaList } = useQuery<BalitaChip[]>({
    queryKey: ['balita', 'saya'],
    queryFn: () => apiClient.get('/balita').then((r) => r.data.data as BalitaChip[]),
    staleTime: 60_000,
  })

  // Auto-select balita pertama saat list loaded
  const effectiveBalitaId = selectedBalitaId ?? balitaList?.[0]?.id ?? null
  const selectedBalita = balitaList?.find((b) => b.id === effectiveBalitaId) ?? balitaList?.[0]

  // Fetch antrian aktif hari ini — filter by balitaId yang dipilih
  const { data: antrian, isLoading } = useQuery<AntrianAktif | null>({
    queryKey: ['antrian', 'saya', effectiveBalitaId],
    queryFn: () =>
      apiClient
        .get('/antrian/saya', { params: effectiveBalitaId ? { balitaId: effectiveBalitaId } : {} })
        .then((r) => r.data.data as AntrianAktif | null),
    staleTime: 30_000,
    enabled: !!balitaList,
  })

  // Tentukan apakah antrian aktif (menunggu atau dipanggil)
  const isAntrian =
    antrian !== null &&
    antrian !== undefined &&
    (antrian.statusAntrian === 'menunggu' || antrian.statusAntrian === 'dipanggil')

  const estimasiMenit = antrian
    ? computeCountdown({
        nomorUrut: antrian.nomorUrut,
        nomorAktif: antrian.nomorAktif ?? 0,
        estimasiDurasiMenit: antrian.slotSesi?.jadwal?.estimasiDurasiMenit ?? 7,
        durasiRataAktual: antrian.slotSesi?.durasiRataAktual ?? null,
      })
    : 0

  const posyanduNama = antrian?.slotSesi?.jadwal?.posyandu?.namaPosyandu ?? ''
  const jamDisplay = formatJam(antrian?.slotSesi?.jamMulai)
  const statusLabel = antrian?.statusAntrian === 'dipanggil' ? 'Dipanggil' : 'Menunggu'
  const colors = getAntrianColors(antrian?.statusAntrian)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-gray-50 pb-24 md:pb-6">
      {/* ── Green header ─────────────────────────────────────────────────── */}
      <div className="bg-green-700 px-4 pt-10 md:pt-6 pb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-green-300 text-xs mb-0.5">Selamat datang,</p>
            <h2 className="text-white font-bold text-xl">{user?.namaLengkap ?? 'Warga'}</h2>
            <p className="text-green-200 text-xs mt-0.5">Posyandu Anda</p>
          </div>
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 bg-green-600/50 rounded-xl"
            aria-label="Notifikasi"
          >
            <Bell className="w-5 h-5 text-white" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />
          </button>
        </div>

        {/* Child selector chips */}
        {balitaList && balitaList.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mt-4 scrollbar-none">
            {balitaList.map((b) => {
              const isSelected = b.id === effectiveBalitaId
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBalitaId(b.id)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition ${
                    isSelected
                      ? 'bg-white border-white'
                      : 'bg-white/15 border-white/20 hover:bg-white/25'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-green-700 text-white' : 'bg-white/20 text-white'}`}>
                    {b.namaBalita.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className={`text-xs font-semibold leading-none ${isSelected ? 'text-green-700' : 'text-white'}`}>
                      {b.namaBalita.split(' ')[0]}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-green-500' : 'text-green-200'}`}>
                      {b.jenisKelamin === 'laki_laki' ? 'Laki-laki' : 'Perempuan'}
                    </p>
                  </div>
                </button>
              )
            })}
            <Link
              to="/citizen/family-account"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-dashed border-white/30 hover:bg-white/20 transition"
            >
              <Users className="w-3.5 h-3.5 text-white" />
              <span className="text-white text-xs">Family</span>
            </Link>
          </div>
        )}

        {/* Notification panel inline */}
        {notifOpen && (
          <div className="bg-green-600/70 rounded-2xl p-4 mb-2">
            <div className="flex justify-between items-center mb-3">
              <p className="text-white font-semibold text-sm">Notifikasi</p>
              <button
                onClick={() => setNotifOpen(false)}
                className="text-green-200 text-xs hover:text-white"
              >
                Tutup
              </button>
            </div>
            <div className="space-y-2">
              {NOTIF_ITEMS.map((n) => (
                <div key={n.id} className="bg-green-500/30 rounded-xl p-3">
                  <p className="text-white text-xs leading-relaxed">{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="mx-4 mt-4">
          <Skeleton className="h-[160px] rounded-2xl" />
        </div>
      )}

      {/* ── Section A — Antrian aktif ─────────────────────────────────────── */}
      {!isLoading && isAntrian && antrian && (
        <div
          className={`mx-4 mt-4 ${colors.bg} border ${colors.border} rounded-2xl p-5 cursor-pointer`}
          onClick={() => navigate('/citizen/antrian/tiket/' + antrian.id)}
        >
          <div className="text-gray-500 text-xs">
            {posyanduNama || 'Antrian Posyandu'}
            {jamDisplay && <> · {jamDisplay} WIB</>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <span className={`${colors.text} font-semibold text-sm`}>{statusLabel}</span>
          </div>
          {/* 3 stat boxes */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white rounded-xl p-3 text-center">
              <div className={`${colors.numColor} text-3xl font-extrabold`}>
                {String(antrian.nomorUrut).padStart(2, '0')}
              </div>
              <div className="text-gray-400 text-xs">Nomor Anda</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <div className="text-gray-700 text-3xl font-extrabold">
                {antrian.nomorAktif > 0 ? String(antrian.nomorAktif).padStart(2, '0') : '--'}
              </div>
              <div className="text-gray-400 text-xs">Aktif Dilayani</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <div className="text-orange-500 text-3xl font-extrabold">{antrian.sisaAntrian}</div>
              <div className="text-gray-400 text-xs">Sisa Antrian</div>
            </div>
          </div>
          {/* Estimasi */}
          <div className="flex items-center gap-1.5 mt-3">
            <Clock size={14} className="text-gray-400" />
            <span className="text-gray-400 text-xs">
              Estimasi waktu: ~{Math.round(estimasiMenit)} menit lagi
            </span>
          </div>
        </div>
      )}

      {/* ── Section B — Tidak ada antrian aktif ──────────────────────────── */}
      {!isLoading && !isAntrian && (
        <div className="bg-white border border-dashed border-green-200 rounded-2xl p-6 mx-4 mt-4 text-center">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarPlus size={24} className="text-green-700" />
          </div>
          <p className="text-gray-800 font-semibold text-sm">Belum ada antrian hari ini</p>
          <p className="text-gray-400 text-xs mt-1 mb-4">Ambil antrian Posyandu sekarang</p>
          <button
            type="button"
            onClick={() => navigate('/citizen/antrian/pilih-tanggal')}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            Ambil Nomor Antrian
          </button>
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="mx-4 mt-4">
          <p className="text-gray-400 text-xs font-semibold tracking-wider mb-3">LAYANAN CEPAT</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                label: 'Ambil Antrian',
                subtitle: 'Pilih sesi jam',
                icon: CalendarPlus,
                to: '/citizen/antrian/pilih-tanggal',
              },
              {
                label: 'Tumbuh Kembang',
                subtitle: 'Z-Score & riwayat',
                icon: TrendingUp,
                to: '/citizen/tumbuh-kembang',
              },
              {
                label: 'AI Konsultasi',
                subtitle: 'Gizi & daftar antrian',
                icon: MessageSquare,
                to: '/citizen/chat-assistant',
              },
              {
                label: 'Riwayat Kesehatan',
                subtitle: 'Jadwal & catatan',
                icon: Heart,
                to: '/citizen/tumbuh-kembang',
              },
            ].map((item) => (
              <Link
                key={item.to + item.label}
                to={item.to}
                className="bg-white rounded-2xl p-4 text-left border border-gray-100 hover:shadow-sm transition active:scale-95"
              >
                <item.icon size={18} className="text-green-700 mb-2" />
                <p className="text-gray-800 font-semibold text-sm">{item.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{item.subtitle}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Profil Balita ─────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="mx-4 mt-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-400 text-xs font-semibold tracking-wider">PROFIL BALITA</p>
              <Link
                to="/citizen/tumbuh-kembang"
                className="flex items-center gap-1 text-green-700 text-xs"
              >
                Lihat Lengkap <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 font-bold text-lg flex-shrink-0">
                {selectedBalita?.namaBalita.charAt(0).toUpperCase() ?? 'B'}
              </div>
              <div>
                <p className="text-gray-800 font-bold text-base">
                  {selectedBalita?.namaBalita ?? 'Balita Anda'}
                </p>
                <p className="text-gray-400 text-xs">
                  {selectedBalita
                    ? selectedBalita.jenisKelamin === 'laki_laki'
                      ? 'Laki-laki'
                      : 'Perempuan'
                    : 'Balita'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    Gizi Normal
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tips Gizi ─────────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="mx-4 mt-4">
          <div className="bg-green-700 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-green-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-bold text-sm">Tips Gizi Minggu Ini</p>
                <p className="text-green-200 text-xs mt-1 leading-relaxed">
                  Pastikan balita Anda mendapat makanan bergizi seimbang setiap hari. Protein dari
                  ikan lokal, sayur hijau, dan buah-buahan sangat penting untuk tumbuh kembang
                  optimal.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
