import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, Clock, AlertCircle } from 'lucide-react'

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

// ── Stepper data ──────────────────────────────────────────────────

const STEPS = [
  { label: 'Pilih Tanggal', idx: 0 },
  { label: 'Pilih Sesi', idx: 1 },
  { label: 'Konfirmasi', idx: 2 },
]

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
  const isPosyanduBelumDipilih =
    isAxiosLikeError(error) &&
    error.response?.data?.error === 'POSYANDU_BELUM_DIPILIH'

  if (isPosyanduBelumDipilih) {
    return <Navigate to="/register/lokasi" replace />
  }

  // ── Derive available dates dari query result ──────────────────
  const availableDates =
    jadwalList?.map((j) => j.tanggalPelaksanaan.substring(0, 10)) ?? []

  const selectedJadwal = jadwalList?.find(
    (j) => j.tanggalPelaksanaan.substring(0, 10) === selectedDate
  )

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

  const activeStep = 0

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header */}
      <div className="bg-white sticky top-0 z-10 px-4 pt-10 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-gray-100"
            onClick={() => navigate('/citizen/dashboard')}
            aria-label="Kembali ke halaman sebelumnya"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-800">Ambil Nomor Antrian</span>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mt-3">
          {STEPS.map(({ label, idx }) => {
            const done = idx < activeStep
            const active = idx === activeStep
            return (
              <div key={idx} className="flex items-center gap-1 flex-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    done || active ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {done ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-xs flex-1 ${
                    active ? 'text-green-600 font-semibold' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
                {idx < 2 && (
                  <div
                    className={`h-0.5 w-3 flex-shrink-0 ${
                      idx < activeStep ? 'bg-green-400' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* White card wrapping calendar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          {/* Legend */}
          <div className="flex justify-end mb-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span>Jadwal tersedia</span>
            </div>
          </div>

          {/* Calendar */}
          <AntrianKalender
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            isLoading={isLoading}
            currentMonth={currentMonth}
            onMonthChange={handleMonthChange}
          />

          {/* Hint when no date selected */}
          {!selectedDate && !isLoading && (
            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700 text-xs">
                Pilih tanggal yang ditandai hijau untuk melihat sesi yang tersedia.
              </p>
            </div>
          )}

          {/* CTA inside card when date selected */}
          {canProceed && (
            <button
              type="button"
              onClick={handlePilihTanggal}
              className="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-2 font-semibold text-sm"
            >
              <Clock className="w-4 h-4" />
              Lihat Sesi Jam
            </button>
          )}
          {!canProceed && !isLoading && availableDates.length > 0 && (
            <button
              type="button"
              disabled
              className="w-full mt-4 py-3 bg-green-200 text-white rounded-xl font-semibold text-sm cursor-not-allowed"
            >
              Pilih tanggal terlebih dahulu
            </button>
          )}

          {/* Empty state — tidak ada jadwal di bulan ini */}
          {!isLoading && availableDates.length === 0 && !isPosyanduBelumDipilih && (
            <p className="text-sm text-gray-500 text-center mt-4">
              Belum ada jadwal Posyandu pada bulan ini. Coba bulan berikutnya.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
