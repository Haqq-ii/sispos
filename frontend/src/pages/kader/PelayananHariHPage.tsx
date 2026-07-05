import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { useMutationSetActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const MEJA_INFO = [
  {
    n: 1,
    nama: 'Pendaftaran & Kehadiran',
    deskripsi: 'Verifikasi kehadiran & daftar manual',
  },
  {
    n: 2,
    nama: 'Pengukuran BB/TB',
    deskripsi: 'Timbang & ukur tinggi badan balita',
  },
  {
    n: 3,
    nama: 'Analisis Z-Score',
    deskripsi: 'Grafik pertumbuhan & tanda klinis',
  },
  {
    n: 4,
    nama: 'Konsultasi & Penyuluhan',
    deskripsi: 'AI early warning + voice-to-text',
  },
  {
    n: 5,
    nama: 'Imunisasi',
    deskripsi: 'Catat & rekam riwayat vaksin',
  },
] as const

export default function PelayananHariHPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setActiveMeja, setLocked } = useKaderMejaStore()
  const setActiveMejaMutation = useMutationSetActiveMeja()

  const state = location.state as { slotId?: string; slotLabel?: string } | null
  const slotId = state?.slotId
  const slotLabel = state?.slotLabel ?? 'Sesi Pelayanan'

  const [pendingMeja, setPendingMeja] = useState<number | null>(null)

  useEffect(() => {
    if (!slotId) navigate('/kader/dashboard', { replace: true })
  }, [slotId, navigate])

  if (!slotId) return null

  const handleMejaSelect = (mejaNumber: number) => {
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

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate('/kader/dashboard')}
            className="bg-[rgba(0,166,62,0.5)] rounded-xl p-2"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div>
            <p className="text-white font-bold text-2xl leading-tight">Pelayanan Hari-H</p>
            <p className="text-[#7bf1a8] text-xs mt-0.5">{slotLabel}</p>
          </div>
        </div>

        {/* Warning card */}
        <div className="bg-[rgba(255,255,255,0.1)] rounded-2xl px-4 py-3">
          <p className="text-[#ffd230] text-xs font-medium leading-relaxed">
            ⚠️ Setiap kader pilih meja yang berbeda. Layar akan terkunci saat pelayanan aktif.
          </p>
        </div>
      </div>

      {/* ── Meja list ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-4 space-y-2.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1 mb-3">
          Pilih Meja Tugas
        </p>

        {MEJA_INFO.map(({ n, nama, deskripsi }) => (
          <button
            key={n}
            onClick={() => setPendingMeja(n)}
            disabled={setActiveMejaMutation.isPending}
            className="w-full bg-white rounded-[14px] border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3 text-left active:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {/* Icon box */}
            <div className="w-10 h-10 bg-[#f0fdf4] border border-[#dcfce7] rounded-[14px] flex items-center justify-center flex-shrink-0">
              <span className="text-[#008236] font-bold text-sm">{n}</span>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[#008236] font-bold text-[11px] mb-0.5">Meja {n}</p>
              <p className="text-[#1e2939] font-semibold text-sm leading-tight">{nama}</p>
              <p className="text-[#99a1af] text-xs mt-0.5">{deskripsi}</p>
            </div>

            {setActiveMejaMutation.isPending ? (
              <Loader2 size={16} className="text-gray-400 flex-shrink-0 animate-spin" />
            ) : (
              <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* ── Konfirmasi Pilih Meja Dialog ────────────────────────────────────── */}
      <Dialog
        open={pendingMeja !== null}
        onOpenChange={(o) => { if (!o) setPendingMeja(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pilih Meja</DialogTitle>
            <DialogDescription>
              Kamu akan masuk ke Meja {pendingMeja} —{' '}
              {MEJA_INFO.find((m) => m.n === pendingMeja)?.nama}.
              Layar akan terkunci. Lanjutkan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMeja(null)}>
              Batal
            </Button>
            <Button
              className="bg-[#008236] hover:bg-[#00a63e] text-white"
              onClick={() => {
                if (pendingMeja !== null) {
                  handleMejaSelect(pendingMeja)
                  setPendingMeja(null)
                }
              }}
              disabled={setActiveMejaMutation.isPending}
            >
              Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
