import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { MapPin, ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AntrianKalender } from '@/components/antrian/AntrianKalender'
import { useJadwalTersedia } from '@/hooks/useJadwalList'
import { useAntrianStore } from '@/stores/useAntrianStore'

// ── Type guard untuk error Axios-like ────────────────────────────

interface AxiosLikeError {
  response?: {
    status?: number
    data?: {
      error?: string
      message?: string
    }
  }
}

function isAxiosLikeError(err: unknown): err is AxiosLikeError {
  return typeof err === 'object' && err !== null && 'response' in err
}

// ── Helper: format Date ke 'YYYY-MM' ─────────────────────────────

function formatMonth(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// ── Component ─────────────────────────────────────────────────────

export default function PilihTanggalPage() {
  const navigate = useNavigate()
  const { selectedDate, setSelectedDate } = useAntrianStore()

  // State bulan yang sedang ditampilkan (default: bulan sekarang)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const bulan = formatMonth(currentMonth)
  const { data: jadwalList, isLoading, error } = useJadwalTersedia(bulan)

  // ── D-02: Redirect ke onboarding jika posyandu belum dipilih ──
  // Backend returns 422 POSYANDU_BELUM_DIPILIH jika citizen belum set posyanduUtamaId
  const isPosyanduBelumDipilih =
    isAxiosLikeError(error) &&
    error.response?.data?.error === 'POSYANDU_BELUM_DIPILIH'

  if (isPosyanduBelumDipilih) {
    return <Navigate to="/register/lokasi" replace />
  }

  // ── Derive available dates dari query result ──────────────────
  const availableDates =
    jadwalList?.map((j) => j.tanggalPelaksanaan.substring(0, 10)) ?? []

  // Cari jadwal yang cocok dengan tanggal terpilih (di bulan saat ini)
  const selectedJadwal = jadwalList?.find(
    (j) => j.tanggalPelaksanaan.substring(0, 10) === selectedDate
  )

  // CTA aktif hanya jika tanggal terpilih dan ada jadwal-nya di bulan ini
  const canProceed = !!selectedDate && availableDates.includes(selectedDate)

  // ── Handlers ──────────────────────────────────────────────────

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const d = new Date(prev)
      if (direction === 'prev') {
        d.setMonth(d.getMonth() - 1)
      } else {
        d.setMonth(d.getMonth() + 1)
      }
      return d
    })
  }

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
  }

  const handlePilihTanggal = () => {
    if (!selectedJadwal) return
    navigate('/citizen/antrian/pilih-sesi', {
      state: { jadwalId: selectedJadwal.id },
    })
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[400px] mx-auto px-4 py-6">
        {/* Back button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] mb-2 -ml-2"
          onClick={() => navigate('/citizen/dashboard')}
          aria-label="Kembali ke halaman sebelumnya"
        >
          <ChevronLeft size={20} />
        </Button>

        {/* Judul halaman */}
        <h1 className="text-xl font-bold mb-4">Pilih Tanggal</h1>

        {/* Kartu konteks posyandu */}
        <div className="bg-green-50 rounded-lg p-4 mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-primary flex-shrink-0" />
          <span className="text-sm text-gray-700">Posyandu Anda</span>
        </div>

        {/* Kalender */}
        <AntrianKalender
          availableDates={availableDates}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          isLoading={isLoading}
          currentMonth={currentMonth}
          onMonthChange={handleMonthChange}
        />

        {/* Empty state — tidak ada jadwal di bulan ini */}
        {!isLoading && availableDates.length === 0 && !isPosyanduBelumDipilih && (
          <p className="text-sm text-gray-500 text-center mt-4">
            Belum ada jadwal Posyandu pada bulan ini. Coba bulan berikutnya.
          </p>
        )}

        {/* CTA */}
        <div className="mt-6">
          <Button
            type="button"
            className="w-full min-h-[44px]"
            disabled={!canProceed}
            onClick={handlePilihTanggal}
          >
            Pilih Tanggal Ini
          </Button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Jadwal tersedia ditandai dengan titik hijau
          </p>
        </div>
      </div>
    </div>
  )
}
