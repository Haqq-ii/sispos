import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { ChevronLeft, CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SesiCard } from '@/components/antrian/SesiCard'
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

// ── Location state type ───────────────────────────────────────────

interface PilihSesiLocationState {
  jadwalId?: string
}

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
  // useSesiAvailability akan idle (enabled: false) jika jadwalId null
  if (!jadwalId) {
    return <Navigate to="/citizen/antrian/pilih-tanggal" replace />
  }

  // Ambil info posyandu dari sesi pertama (backend menyertakan data jadwal.posyandu via include)
  const posyanduNama = sesiList?.[0]?.jadwal?.posyandu?.namaPosyandu ?? null

  // Cek apakah semua sesi sudah penuh
  const allFull =
    !isLoading &&
    sesiList !== undefined &&
    sesiList.length > 0 &&
    sesiList.every((s) => s.terisi >= s.kuota)

  // ── Handler: citizen pilih sesi (hanya set selection — tidak langsung navigate) ──

  const handlePilihSesi = (sesiId: string) => {
    setSelectedSlotId(sesiId)
  }

  // ── Handler: citizen lanjutkan ke konfirmasi ──────────────────────────────────

  const handleLanjutkan = () => {
    if (!selectedSlotId) return
    // Teruskan jadwalId ke KonfirmasiAntrianPage agar bisa load estimasi durasi
    navigate('/citizen/antrian/konfirmasi', {
      state: { jadwalId },
    })
  }

  // Tanggal yang diformat untuk header summary card
  const tanggalDisplay = formatTanggalPanjang(selectedDate)

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
          onClick={() => navigate('/citizen/antrian/pilih-tanggal')}
          aria-label="Kembali ke halaman sebelumnya"
        >
          <ChevronLeft size={20} />
        </Button>

        {/* Judul halaman */}
        <h1 className="text-xl font-bold mb-4">Pilih Sesi</h1>

        {/* Summary card — tanggal + posyandu terpilih */}
        <div className="bg-green-50 p-3 rounded-lg mb-4 flex items-center gap-2">
          <CalendarDays size={14} className="text-green-600 flex-shrink-0" />
          <span className="text-sm">
            {tanggalDisplay}
            {posyanduNama && <> &middot; {posyanduNama}</>}
          </span>
        </div>

        {/* Loading state — 3 skeleton blocks */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
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

        {/* Daftar SesiCard */}
        {!isLoading && sesiList && sesiList.length > 0 && !allFull && (
          <div className="flex flex-col gap-3">
            {sesiList.map((sesi) => (
              <div
                key={sesi.id}
                className={
                  selectedSlotId === sesi.id
                    ? 'rounded-2xl border-2 border-[#008236]'
                    : 'rounded-2xl border-2 border-transparent'
                }
              >
                <SesiCard
                  sesi={{
                    id: sesi.id,
                    nomorSesi: sesi.nomorSesi,
                    labelSesi: sesi.labelSesi,
                    jamMulai: sesi.jamMulai,
                    jamSelesai: sesi.jamSelesai,
                    kuota: sesi.kuota,
                    terisi: sesi.terisi,
                  }}
                  onPilih={handlePilihSesi}
                />
              </div>
            ))}
          </div>
        )}

        {/* CTA — Lanjutkan ke Konfirmasi */}
        {!isLoading && !allFull && (
          <div className="mt-6">
            <Button
              type="button"
              className="w-full min-h-[44px] bg-[#008236] text-white rounded-[14px] hover:bg-[#00a63e]"
              disabled={!selectedSlotId}
              onClick={handleLanjutkan}
            >
              Lanjutkan
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
