/**
 * LockScreenPage — Meja selector for kader.
 *
 * This is NOT a PIN entry screen (kader already authenticated via JWT).
 * It shows 5 meja buttons and calls PATCH /api/kader/active-meja on click.
 *
 * Route: /kader/lock-screen
 * Navigated to from KaderDashboardPage (fallback) or directly.
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMutationSetActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'

// ── Meja definitions ───────────────────────────────────────────────────────────

const MEJA_LIST = [
  { number: 1, label: 'Meja 1', desc: 'Pendaftaran & Kehadiran Balita', badgeColor: 'bg-blue-500' },
  { number: 2, label: 'Meja 2', desc: 'Penimbangan & Pengukuran', badgeColor: 'bg-[#008236]' },
  { number: 3, label: 'Meja 3', desc: 'Pencatatan Klinis & Grafik', badgeColor: 'bg-yellow-500' },
  { number: 4, label: 'Meja 4', desc: 'Konseling & AI Early Warning', badgeColor: 'bg-purple-500' },
  { number: 5, label: 'Meja 5', desc: 'Selesai Pelayanan & Imunisasi', badgeColor: 'bg-[#e17100]' },
] as const

// ── Component ──────────────────────────────────────────────────────────────────

export default function LockScreenPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setActiveMeja, setLocked } = useKaderMejaStore()
  const setActiveMejaMutation = useMutationSetActiveMeja()

  // slotId can be passed via router state (from dashboard) or query param
  const slotId: string | null =
    (location.state as { slotId?: string } | null)?.slotId ??
    new URLSearchParams(location.search).get('slotId')

  const handleMejaClick = (mejaNumber: number) => {
    if (!slotId) {
      navigate('/kader/dashboard')
      return
    }
    setActiveMejaMutation.mutate(
      { mejaNumber, slotId },
      {
        onSuccess: () => {
          setActiveMeja(mejaNumber, slotId)
          setLocked(true)
          navigate(`/kader/meja/${mejaNumber}`)
        },
      }
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-10 pb-6">
        <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Sesi Pelayanan</p>
        <p className="text-white font-bold text-xl leading-tight">Pilih Meja Pelayanan</p>
        <p className="text-[#b9f8cf] text-xs mt-1">
          {slotId
            ? `Slot aktif: ${slotId.slice(0, 8)}…`
            : new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
        </p>
      </div>

      <div className="max-w-[480px] mx-auto w-full px-4 py-6 space-y-3">
        {!slotId && (
          <div className="bg-[#fff7ed] border border-[#fde68a] rounded-2xl px-4 py-3">
            <p className="text-[#92400e] text-xs font-medium">
              Slot belum dipilih — kembali ke Dashboard untuk memilih sesi.
            </p>
          </div>
        )}

        {/* Meja cards */}
        <div className="space-y-3">
          {MEJA_LIST.map((meja) => (
            <button
              key={meja.number}
              type="button"
              onClick={() => handleMejaClick(meja.number)}
              disabled={!slotId || setActiveMejaMutation.isPending}
              className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm px-4 py-4 w-full text-left flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:bg-[#f0fdf4] transition-colors"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${meja.badgeColor}`}
              >
                {meja.number}
              </div>
              <div>
                <p className="font-semibold text-[#1e2939] text-sm">{meja.label}</p>
                <p className="text-[#99a1af] text-xs mt-0.5">{meja.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate('/kader/dashboard')}
        >
          Batal
        </Button>
      </div>
    </div>
  )
}
