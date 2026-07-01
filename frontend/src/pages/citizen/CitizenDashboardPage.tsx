/**
 * CitizenDashboardPage — Screen 7: Dashboard citizen.
 *
 * Menggantikan placeholder di frontend/src/pages/CitizenDashboardPage.tsx.
 * Path baru: frontend/src/pages/citizen/CitizenDashboardPage.tsx
 *
 * Layout:
 * - Greeting card: "Selamat datang, {namaDepan}"
 * - Section A (ada antrian aktif): card dengan StatusBadge + nomor + estimasi + "Lihat Tiket"
 * - Section B (tidak ada antrian): CTA card "Ambil Antrian" → /citizen/antrian/pilih-tanggal
 */
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusAntrian } from '@/components/antrian/StatusAntrian'
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

  // Ambil nama depan dari namaLengkap
  const namaDepan = user?.namaLengkap?.split(' ')[0] ?? 'Warga'

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

  // Data untuk card antrian aktif
  const nomorPadded = antrian
    ? String(antrian.nomorUrut).padStart(2, '0')
    : '--'

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

  // Posyandu untuk greeting
  const greetingPosyandu = posyanduNama || 'Belum memilih Posyandu'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-[400px] mx-auto">
        {/* Greeting card */}
        <div className="bg-white border-b px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">
            Selamat datang, {namaDepan}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Posyandu {greetingPosyandu}
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="mx-4 mt-4">
            <Skeleton className="h-[120px] rounded-xl" />
          </div>
        )}

        {/* Section A — Antrian aktif */}
        {!isLoading && isAntrian && antrian && (
          <div className="bg-white rounded-xl shadow-sm p-4 mx-4 mt-4">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
              ANTRIAN AKTIF HARI INI
            </p>

            <div className="mb-2">
              <StatusAntrian status={antrian.statusAntrian} />
            </div>

            <p className="text-2xl font-bold text-foreground mt-2">
              Nomor {nomorPadded}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              {posyanduNama}
              {jamDisplay && <> &middot; {jamDisplay} WIB</>}
            </p>

            <p className="text-xs text-gray-500">
              Estimasi ±{Math.round(estimasiMenit)} menit
            </p>

            <Button
              type="button"
              className="w-full min-h-[44px] mt-4"
              onClick={() => navigate('/citizen/antrian/tiket/' + antrian.id)}
            >
              Lihat Tiket
            </Button>
          </div>
        )}

        {/* Section B — Tidak ada antrian aktif */}
        {!isLoading && !isAntrian && (
          <div className="bg-green-50 rounded-xl p-6 mx-4 mt-4 text-center">
            <CalendarPlus size={40} className="mx-auto text-primary mb-3" />
            <p className="text-sm text-gray-500">Belum ada antrian hari ini</p>
            <p className="text-sm text-gray-500 mb-4">
              Ambil antrian Posyandu sekarang
            </p>
            <Button
              type="button"
              className="w-full min-h-[44px]"
              onClick={() => navigate('/citizen/antrian/pilih-tanggal')}
            >
              Ambil Antrian
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
