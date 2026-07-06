import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { ChevronLeft, Calendar, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSesiAvailability } from '@/hooks/useSesiAvailability'
import { useAntrianStore } from '@/stores/useAntrianStore'

// ── Helper: format tanggal ke "Senin, 01 Juli 2026" ──────────────

function formatTanggalPanjang(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    // dateStr format 'YYYY-MM-DD' — buat Date di timezone lokal (bukan UTC)
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateStr
  }
}

// ── Helper: extract HH:MM dari string waktu ───────────────────────

function formatJam(t: string): string {
  return t.substring(0, 5)
}

// ── Location state type ───────────────────────────────────────────

interface PilihSesiLocationState {
  jadwalId?: string
}

// ── Stepper data ──────────────────────────────────────────────────

const STEPS = [
  { label: 'Pilih Tanggal', idx: 0 },
  { label: 'Pilih Sesi', idx: 1 },
  { label: 'Konfirmasi', idx: 2 },
]

// ── Component ─────────────────────────────────────────────────────

export default function PilihSesiPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedDate, selectedSlotId, setSelectedSlotId } = useAntrianStore()

  // Ambil jadwalId dari navigation state yang diteruskan PilihTanggalPage
  const state = (location.state ?? {}) as PilihSesiLocationState
  const jadwalId = state.jadwalId ?? null

  // PENTING: semua hooks harus dipanggil SEBELUM conditional return (Rules of Hooks)
  const { data: sesiList, isLoading } = useSesiAvailability(jadwalId)

  // Guard: jika tidak ada jadwalId (akses langsung tanpa PilihTanggalPage)
  if (!jadwalId) {
    return <Navigate to="/citizen/antrian/pilih-tanggal" replace />
  }

  // Ambil info posyandu dari sesi pertama
  const posyanduNama = sesiList?.[0]?.jadwal?.posyandu?.namaPosyandu ?? null

  // Cek apakah semua sesi sudah penuh
  const allFull =
    !isLoading &&
    sesiList !== undefined &&
    sesiList.length > 0 &&
    sesiList.every((s) => s.terisi >= s.kuota)

  // ── Handler: citizen pilih sesi ──────────────────────────────────

  const handlePilihSesi = (sesiId: string) => {
    setSelectedSlotId(sesiId)
  }

  // ── Handler: citizen lanjutkan ke konfirmasi ──────────────────────

  const handleLanjutkan = () => {
    if (!selectedSlotId) return
    navigate('/citizen/antrian/konfirmasi', {
      state: { jadwalId },
    })
  }

  const tanggalDisplay = formatTanggalPanjang(selectedDate)
  const activeStep = 1

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header */}
      <div className="bg-white sticky top-0 z-10 px-4 pt-10 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-gray-100"
            onClick={() => navigate('/citizen/antrian/pilih-tanggal')}
            aria-label="Kembali ke halaman sebelumnya"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
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
        {/* Summary card */}
        <div className="mb-4 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" />
            <p className="text-gray-700 text-sm font-semibold">{tanggalDisplay}</p>
          </div>
          {posyanduNama && (
            <p className="text-gray-500 text-xs mt-0.5 pl-6">{posyanduNama}</p>
          )}
        </div>

        {/* Loading state — 3 skeleton blocks */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        )}

        {/* Empty state — semua sesi penuh */}
        {allFull && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">
              Semua sesi pada tanggal ini sudah penuh. Silakan pilih tanggal lain.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/citizen/antrian/pilih-tanggal')}
            >
              Ganti Tanggal
            </Button>
          </div>
        )}

        {/* Slot cards */}
        {!isLoading && sesiList && !allFull && (
          <>
            <p className="text-gray-700 text-sm font-semibold mb-3">Pilih Sesi Jam</p>
            <div className="space-y-3">
              {sesiList.map((sesi) => {
                const pct = (sesi.terisi / sesi.kuota) * 100
                const isFull = sesi.terisi >= sesi.kuota
                const isSelected = selectedSlotId === sesi.id
                return (
                  <button
                    key={sesi.id}
                    type="button"
                    onClick={() => !isFull && handlePilihSesi(sesi.id)}
                    disabled={isFull}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                      isSelected
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : isFull
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock
                          className={`w-4 h-4 ${
                            isSelected ? 'text-green-600' : 'text-gray-500'
                          }`}
                        />
                        <span
                          className={`text-sm font-semibold ${
                            isSelected ? 'text-green-700' : 'text-gray-700'
                          }`}
                        >
                          {sesi.labelSesi} · {formatJam(sesi.jamMulai)}–{formatJam(sesi.jamSelesai)} WIB
                        </span>
                      </div>
                      {isFull ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-semibold">
                          Penuh
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            isSelected
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {sesi.kuota - sesi.terisi} slot tersisa
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100
                            ? 'bg-red-400'
                            : pct >= 70
                            ? 'bg-amber-400'
                            : 'bg-green-400'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-gray-400 text-xs mt-1">
                      {sesi.terisi}/{sesi.kuota} kuota terisi
                    </p>
                  </button>
                )
              })}
            </div>

            {/* CTA */}
            {selectedSlotId && (
              <button
                type="button"
                onClick={handleLanjutkan}
                className="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold"
              >
                Lanjut ke Konfirmasi
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
