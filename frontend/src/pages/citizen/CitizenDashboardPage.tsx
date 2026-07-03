/**
 * CitizenDashboardPage — Redesigned dashboard citizen (Figma design system).
 *
 * Layout:
 * - Green header: greeting + notification bell + child chip placeholder
 * - Section A (antrian aktif): blue card dengan nomor, estimasi
 * - Section B (tidak ada antrian): white CTA card
 * - Layanan Cepat 2×2 grid
 * - Profil Balita card
 * - Tips Gizi banner
 */
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarPlus,
  TrendingUp,
  MessageCircle,
  Heart,
  Clock,
  ChevronRight,
  Bell,
  Info,
} from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/useAuthStore'
import { computeCountdown } from '@/hooks/useCountdownEstimasi'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────────

export default function CitizenDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Fetch antrian aktif hari ini
  const { data: antrian, isLoading } = useQuery<AntrianAktif | null>({
    queryKey: ['antrian', 'saya'],
    queryFn: () =>
      apiClient.get('/antrian/saya').then((r) => {
        const d = r.data.data as AntrianAktif | null
        return d
      }),
    staleTime: 30_000,
  })

  // Tentukan apakah antrian aktif (menunggu atau dipanggil)
  const isAntrian =
    antrian !== null &&
    antrian !== undefined &&
    (antrian.statusAntrian === 'menunggu' || antrian.statusAntrian === 'dipanggil')

  const estimasiMenit = antrian
    ? computeCountdown({
        nomorUrut: antrian.nomorUrut,
        nomorAktif: 0, // Phase 2: Meja 1 belum ada
        estimasiDurasiMenit: antrian.slotSesi?.jadwal?.estimasiDurasiMenit ?? 7,
        durasiRataAktual: antrian.slotSesi?.durasiRataAktual ?? null,
      })
    : 0

  const posyanduNama = antrian?.slotSesi?.jadwal?.posyandu?.namaPosyandu ?? ''
  const jamDisplay = formatJam(antrian?.slotSesi?.jamMulai)

  const statusLabel = antrian?.statusAntrian === 'dipanggil' ? 'Dipanggil' : 'Menunggu'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[#f9fafb]">
      {/* ── Green header ─────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-5 pb-6">
        {/* Top row: greeting + notification bell */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[#7bf1a8] text-xs">Selamat datang,</p>
            <h1 className="text-white font-bold text-xl leading-tight">
              {user?.namaLengkap ?? 'Warga'}
            </h1>
            {posyanduNama && (
              <p className="text-[#b9f8cf] text-xs mt-0.5">{posyanduNama}</p>
            )}
          </div>
          <button
            type="button"
            className="bg-[rgba(0,166,62,0.5)] rounded-[14px] p-2 relative flex-shrink-0"
            aria-label="Notifikasi"
          >
            <Bell size={20} className="text-white" />
            {/* Red badge */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#fb2c36] rounded-full" />
          </button>
        </div>

        {/* Child profile chips — placeholder */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            type="button"
            className="bg-white rounded-full px-3 py-1.5 text-[#008236] font-semibold text-xs flex-shrink-0 shadow-sm"
          >
            Balita
          </button>
        </div>
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
          className="mx-4 mt-4 bg-[#eff6ff] border border-[#bedbff] rounded-2xl p-5 cursor-pointer"
          onClick={() => navigate('/citizen/antrian/tiket/' + antrian.id)}
        >
          <div className="text-[#99a1af] text-xs">
            {posyanduNama || 'Antrian Posyandu'}
            {jamDisplay && <> · {jamDisplay} WIB</>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-[#2b7fff]" />
            <span className="text-[#1447e6] font-semibold text-sm">{statusLabel}</span>
          </div>
          {/* 3 stat boxes */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white rounded-[14px] p-3 text-center">
              <div className="text-[#1447e6] text-3xl font-extrabold">
                {String(antrian.nomorUrut).padStart(2, '0')}
              </div>
              <div className="text-[#99a1af] text-xs">Nomor Anda</div>
            </div>
            <div className="bg-white rounded-[14px] p-3 text-center">
              <div className="text-[#364153] text-3xl font-extrabold">--</div>
              <div className="text-[#99a1af] text-xs">Aktif Dilayani</div>
            </div>
            <div className="bg-white rounded-[14px] p-3 text-center">
              <div className="text-[#ff6900] text-3xl font-extrabold">--</div>
              <div className="text-[#99a1af] text-xs">Sisa Antrian</div>
            </div>
          </div>
          {/* Estimasi */}
          <div className="flex items-center gap-1.5 mt-3">
            <Clock size={14} className="text-[#99a1af]" />
            <span className="text-[#99a1af] text-xs">
              Estimasi waktu: ~{Math.round(estimasiMenit)} menit lagi
            </span>
          </div>
        </div>
      )}

      {/* ── Section B — Tidak ada antrian aktif ──────────────────────────── */}
      {!isLoading && !isAntrian && (
        <div className="bg-white rounded-2xl border border-[#f3f4f6] shadow-sm p-5 mx-4 mt-4 text-center">
          <div className="w-12 h-12 bg-[#f0fdf4] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarPlus size={24} className="text-[#008236]" />
          </div>
          <p className="text-[#1e2939] font-semibold text-sm">Belum ada antrian hari ini</p>
          <p className="text-[#99a1af] text-xs mt-1 mb-4">
            Ambil antrian Posyandu sekarang
          </p>
          <button
            type="button"
            onClick={() => navigate('/citizen/antrian/pilih-tanggal')}
            className="w-full bg-[#008236] hover:bg-[#00a63e] text-white font-semibold text-sm py-3 rounded-[14px] transition-colors"
          >
            Ambil Antrian
          </button>
        </div>
      )}

      {/* ── Layanan Cepat ─────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="mx-4 mt-4">
          <p className="text-[#99a1af] text-xs font-semibold tracking-wider mb-3">
            LAYANAN CEPAT
          </p>
          <div className="grid grid-cols-2 gap-3">
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
                label: 'AI Konsultasi Gizi',
                subtitle: 'Tanya jawab mandiri',
                icon: MessageCircle,
                to: '/citizen/chat-gizi',
              },
              {
                label: 'Riwayat Imunisasi',
                subtitle: 'Jadwal & catatan',
                icon: Heart,
                to: '/citizen/family-account',
              },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="bg-white border border-[#f3f4f6] rounded-2xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
              >
                <item.icon size={16} className="text-[#008236]" />
                <div>
                  <p className="text-[#1e2939] font-semibold text-sm">{item.label}</p>
                  <p className="text-[#99a1af] text-xs mt-0.5">{item.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Profil Balita ─────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="mx-4 mt-4">
          <div className="bg-white border border-[#f3f4f6] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#99a1af] text-xs font-semibold tracking-wider">
                PROFIL BALITA
              </p>
              <Link
                to="/citizen/tumbuh-kembang"
                className="flex items-center gap-1 text-[#00a63e] text-xs"
              >
                Lihat Lengkap <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f3f4f6] rounded-2xl flex items-center justify-center text-[#6a7282] font-bold text-lg flex-shrink-0">
                B
              </div>
              <div>
                <p className="text-[#1e2939] font-bold text-base">Balita Anda</p>
                <p className="text-[#99a1af] text-xs">Balita</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-[#dcfce7] text-[#008236] text-xs font-medium px-2 py-0.5 rounded-full">
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
        <div className="mx-4 mt-4 mb-6">
          <div className="bg-[#008236] rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-[#7bf1a8] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-bold text-sm">Tips Gizi Minggu Ini</p>
                <p className="text-[#b9f8cf] text-xs mt-1 leading-relaxed">
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
