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
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMutationSetActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'

// ── Meja definitions ───────────────────────────────────────────────────────────

const MEJA_LIST = [
  { number: 1, label: 'Meja 1 — Pendaftaran & Kehadiran', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { number: 2, label: 'Meja 2 — Penimbangan', color: 'bg-green-50 border-green-200 hover:bg-green-100' },
  { number: 3, label: 'Meja 3 — Pencatatan', color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' },
  { number: 4, label: 'Meja 4 — Konseling', color: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { number: 5, label: 'Meja 5 — Selesai', color: 'bg-red-50 border-red-200 hover:bg-red-100' },
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-2">
        <Lock size={16} className="text-primary" />
        <span className="text-sm font-bold">Pilih Meja Pelayanan</span>
      </div>

      <div className="max-w-[480px] mx-auto w-full px-4 py-6 space-y-4">
        <p className="text-sm text-gray-500 text-center">
          Pilih meja untuk memulai sesi pelayanan.
          {!slotId && (
            <span className="block text-amber-600 mt-1 text-xs">
              Slot belum dipilih — kembali ke Dashboard.
            </span>
          )}
        </p>

        {/* Meja buttons */}
        <div className="space-y-3">
          {MEJA_LIST.map((meja) => (
            <button
              key={meja.number}
              type="button"
              onClick={() => handleMejaClick(meja.number)}
              disabled={!slotId || setActiveMejaMutation.isPending}
              className={`w-full text-left px-4 py-4 rounded-xl border font-medium text-sm transition-colors ${meja.color} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {meja.label}
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
