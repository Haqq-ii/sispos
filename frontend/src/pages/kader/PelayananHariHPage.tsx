import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'

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
import apiClient from '@/lib/axios'

interface TodaySlot {
  id: string
  nomorSesi: number
  labelSesi: string
  jamMulai: string
  jamSelesai: string
  kuota: number
  terisi: number
  totalAntrian: number
}

interface TodayJadwal {
  jadwalId: string
  slotSesi: TodaySlot[]
}

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

  const state = location.state as { slotId?: string } | null
  const stateSlotId = state?.slotId

  const [pendingMeja, setPendingMeja] = useState<number | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(stateSlotId ?? null)

  // Always fetch today-slots so all sesi are available
  const { data: todayJadwal, isLoading: isLoadingSlot } = useQuery<TodayJadwal | null>({
    queryKey: ['kader', 'today-slots'],
    queryFn: () =>
      apiClient.get('/kader/today-slots').then((r) => {
        const data = r.data.data as TodayJadwal | null
        // Auto-select: prefer stateSlotId, then first sesi
        if (data?.slotSesi?.length && !selectedSlotId) {
          const match = stateSlotId
            ? data.slotSesi.find((s) => s.id === stateSlotId)
            : null
          setSelectedSlotId(match?.id ?? data.slotSesi[0].id)
        }
        return data
      }),
    staleTime: 30_000,
  })

  const activeSlot = todayJadwal?.slotSesi?.find((s) => s.id === selectedSlotId)
    ?? todayJadwal?.slotSesi?.[0]

  const handleMejaSelect = (mejaNumber: number) => {
    if (!activeSlot?.id) return
    setActiveMejaMutation.mutate(
      { mejaNumber, slotId: activeSlot.id },
      {
        onSuccess: () => {
          setActiveMeja(mejaNumber, activeSlot.id)
          setLocked(true)
          navigate(`/kader/meja/${mejaNumber}`)
        },
      }
    )
  }

  if (isLoadingSlot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-green-700" />
      </div>
    )
  }

  if (!todayJadwal || todayJadwal.slotSesi.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-[#008236] px-4 pt-12 pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/kader/dashboard')}
              className="bg-[rgba(0,166,62,0.5)] rounded-xl p-2"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            <p className="text-white font-bold text-2xl">Pelayanan Hari-H</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={28} className="text-amber-500" />
          </div>
          <p className="text-gray-700 font-semibold">Tidak ada jadwal hari ini</p>
          <p className="text-gray-400 text-sm">Belum ada sesi pelayanan yang aktif untuk hari ini.</p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => navigate('/kader/dashboard')}
          >
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const slotSesi = todayJadwal.slotSesi

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/kader/dashboard')}
            className="bg-[rgba(0,166,62,0.5)] rounded-xl p-2"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div>
            <p className="text-white font-bold text-2xl leading-tight">Pelayanan Hari-H</p>
            {activeSlot && (
              <p className="text-[#7bf1a8] text-xs mt-0.5">
                {activeSlot.labelSesi} · {activeSlot.jamMulai} WIB
              </p>
            )}
          </div>
        </div>

        {/* Sesi selector chips — hanya tampil jika ada lebih dari 1 sesi */}
        {slotSesi.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {slotSesi.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSlotId(s.id)}
                className={[
                  'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
                  s.id === (selectedSlotId ?? activeSlot?.id)
                    ? 'bg-white text-[#008236] border-white'
                    : 'bg-[rgba(255,255,255,0.15)] text-white border-[rgba(255,255,255,0.3)]',
                ].join(' ')}
              >
                {s.labelSesi} · {s.jamMulai}
              </button>
            ))}
          </div>
        )}

        {/* Warning card */}
        <div className="bg-[rgba(255,255,255,0.1)] rounded-2xl px-4 py-3 mt-3">
          <p className="text-[#ffd230] text-xs font-medium leading-relaxed">
            ⚠️ Setiap kader pilih meja yang berbeda. Layar akan terkunci saat pelayanan aktif.
          </p>
        </div>
      </div>

      {/* ── Sesi info strip ──────────────────────────────────────────────── */}
      {activeSlot && (
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{activeSlot.labelSesi}</span>
            {' '}· {activeSlot.jamMulai}–{activeSlot.jamSelesai} WIB
          </p>
          <span className="text-xs text-gray-400">
            {activeSlot.totalAntrian}/{activeSlot.kuota} terdaftar
          </span>
        </div>
      )}

      {/* ── Meja list ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-4 space-y-2.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1 mb-3">
          Pilih Meja Tugas
        </p>

        {MEJA_INFO.map(({ n, nama, deskripsi }) => (
          <button
            key={n}
            onClick={() => setPendingMeja(n)}
            disabled={setActiveMejaMutation.isPending || !activeSlot}
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
              {activeSlot && (
                <> Sesi: <strong>{activeSlot.labelSesi}</strong> · {activeSlot.jamMulai} WIB.</>
              )}{' '}
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
