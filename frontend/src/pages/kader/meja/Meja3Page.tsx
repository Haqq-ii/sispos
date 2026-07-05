/**
 * Meja3Page — Meja 3: Analisis Z-Score (Figma Make two-step flow)
 *
 * Step 1: Select hadir balita from antrian list
 * Step 2: Z-Score status card + grid (BB/TB/ZScore) + ZScoreChart trend + interpretation table
 *         "Selesai Meja 3" → handleKeluarMeja (clear active meja + navigate dashboard)
 *
 * Guard: activeSlotId required (from store)
 * State source: router state from Meja2Page (balitaId auto-selected if present)
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import { useMutationClearActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { usePemeriksaanHistory } from '@/hooks/usePemeriksaan'
import { ZScoreChart, type ZScoreDataPoint } from '@/components/kader/ZScoreChart'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import { TukarMejaModal } from '@/components/kader/TukarMejaModal'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────

interface AntrianItem {
  id: string
  nomorUrut: number
  statusAntrian: string
  balitaId: string
  balita: { namaBalita: string; tanggalLahir: string }
  warga?: { namaIbu?: string; rt?: string | null }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTanggal(dateStr: string): string {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

function getStatusRow(z: number | null): 'lebih' | 'normal' | 'kurang' | 'buruk' | null {
  if (z === null) return null
  if (z > 2) return 'lebih'
  if (z >= -2) return 'normal'
  if (z >= -3) return 'kurang'
  return 'buruk'
}

const INTERPRETATION_ROWS = [
  { key: 'lebih', label: '> +2 SD', desc: 'Lebih', color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'normal', label: '-2 s/d +2 SD', desc: 'Normal', color: 'text-green-700', bg: 'bg-green-50' },
  { key: 'kurang', label: '-3 s/d -2 SD', desc: 'Kurang', color: 'text-amber-700', bg: 'bg-amber-50' },
  { key: 'buruk', label: '< -3 SD', desc: 'Buruk / Stunting', color: 'text-red-700', bg: 'bg-red-50' },
] as const

// ── Guard wrapper ──────────────────────────────────────────────────────────

export default function Meja3Page() {
  const navigate = useNavigate()
  const { activeSlotId, activeBalitaId, activeAntrianId, activeNamaBalita } = useKaderMejaStore()
  const clearActiveMejaMutation = useMutationClearActiveMeja()
  const { reset: resetStore } = useKaderMejaStore()
  const location = useLocation()

  useEffect(() => {
    if (!activeSlotId) navigate('/kader/dashboard', { replace: true })
  }, [activeSlotId, navigate])

  if (!activeSlotId) return null

  const routerState = location.state as {
    balitaId?: string
    antrianId?: string
    namaBalita?: string
    pemeriksaanId?: string
  } | null

  return (
    <Meja3Content
      activeSlotId={activeSlotId}
      initialBalitaId={null}
      initialNama={routerState?.namaBalita ?? activeNamaBalita ?? ''}
      clearActiveMejaMutation={clearActiveMejaMutation}
      resetStore={resetStore}
    />
  )
}

// ── Inner component ────────────────────────────────────────────────────────

interface Meja3ContentProps {
  activeSlotId: string
  initialBalitaId: string | null
  initialNama: string
  clearActiveMejaMutation: ReturnType<typeof useMutationClearActiveMeja>
  resetStore: () => void
}

function Meja3Content({ activeSlotId, initialBalitaId, initialNama, clearActiveMejaMutation, resetStore }: Meja3ContentProps) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [showTukarMeja, setShowTukarMeja] = useState(false)
  const [selectedBalitaId, setSelectedBalitaId] = useState<string | null>(initialBalitaId)
  const [selectedNama, setSelectedNama] = useState(initialNama)

  // Step 1: antrian hadir list
  const { data: antrianList = [], isLoading: listLoading } = useQuery<AntrianItem[]>({
    queryKey: ['antrian', 'kader', activeSlotId],
    queryFn: () =>
      apiClient.get(`/kader/slot/${activeSlotId}/antrian`).then((r) => r.data.data as AntrianItem[]),
    enabled: !selectedBalitaId,
  })
  const hadirList = antrianList.filter(
    (a) => a.statusAntrian === 'dipanggil' || a.statusAntrian === 'selesai',
  )

  // Step 2: Z-Score history for selected balita
  const { data: history = [], isLoading: historyLoading } = usePemeriksaanHistory(selectedBalitaId)
  const latestRecord = history.length > 0 ? history[history.length - 1] : null

  const chartData: ZScoreDataPoint[] = history.map((p) => ({
    tanggal: formatTanggal(p.tanggalPemeriksaan),
    bbU: p.zScoreBbU,
    tbU: p.zScoreTbU,
    bbTb: p.zScoreBbTb,
  }))

  const activeStatus = getStatusRow(latestRecord?.zScoreBbU ?? null)
  const isNormal = activeStatus === 'normal' || activeStatus === null
  const statusGizi = latestRecord?.statusGizi ?? latestRecord?.statusGiziOverride

  const handleKeluarMeja = () => {
    clearActiveMejaMutation.mutate(undefined, {
      onSuccess: () => {
        resetStore()
        navigate('/kader/dashboard', { replace: true })
      },
      onError: () => {
        toast({ description: 'Gagal keluar meja. Coba lagi.', variant: 'destructive' })
      },
    })
  }

  // ── Header ─────────────────────────────────────────────────────────────

  const Header = (
    <div className="bg-[#008236] px-4 pt-10 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">MEJA 3 — Analisis Z-Score</p>
          <p className="text-[#b9f8cf] text-xs">
            {selectedBalitaId ? selectedNama : 'Pilih balita'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncPendingBadge />
          <button
            onClick={() => setShowTukarMeja(true)}
            className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium"
          >
            Tukar Meja
          </button>
        </div>
      </div>
    </div>
  )

  // ── Step 1: select balita ───────────────────────────────────────────────

  if (!selectedBalitaId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {Header}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Pilih balita untuk analisis Z-Score:
          </p>

          {listLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-gray-300" />
            </div>
          ) : hadirList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 text-center">
              <p className="text-sm text-amber-700 font-semibold mb-1">Belum ada balita hadir</p>
              <p className="text-xs text-gray-400">Tandai kehadiran di Meja 1 terlebih dahulu.</p>
            </div>
          ) : (
            hadirList.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedBalitaId(item.balitaId)
                  setSelectedNama(item.balita.namaBalita)
                }}
                className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm active:bg-gray-50 text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#99a1af] text-xs font-semibold w-6">
                      {String(item.nomorUrut).padStart(2, '0')}
                    </span>
                    <p className="font-bold text-[#1e2939] text-sm">{item.balita.namaBalita}</p>
                  </div>
                  {item.warga?.namaIbu && (
                    <p className="text-xs text-gray-400 mt-0.5 ml-8">Ibu: {item.warga.namaIbu}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Selesai Meja 3 */}
        <div className="bg-white border-t border-gray-100 px-4 py-3">
          <button
            onClick={handleKeluarMeja}
            disabled={clearActiveMejaMutation.isPending}
            className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {clearActiveMejaMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Selesai Meja 3
          </button>
        </div>
        <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId} />
      </div>
    )
  }

  // ── Step 2: Z-Score detail ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header with back button */}
      <div className="bg-[#008236] px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedBalitaId(null)}
              className="bg-[rgba(0,166,62,0.5)] rounded-xl p-2"
            >
              <ChevronRight size={16} className="text-white rotate-180" />
            </button>
            <div>
              <p className="text-white font-bold text-sm">MEJA 3 — Analisis Z-Score</p>
              <p className="text-[#b9f8cf] text-xs">{selectedNama}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncPendingBadge />
            <button
              onClick={() => setShowTukarMeja(true)}
              className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium"
            >
              Tukar Meja
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Z-Score status card */}
        {historyLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 h-24 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <div
            className={`rounded-2xl p-4 flex items-center gap-3 ${isNormal ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}
          >
            {isNormal
              ? <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
              : <AlertTriangle size={24} className="text-amber-600 flex-shrink-0" />
            }
            <div>
              <p className={`font-bold text-sm ${isNormal ? 'text-green-800' : 'text-amber-800'}`}>
                {statusGizi
                  ? statusGizi.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  : activeStatus === 'normal' ? 'Normal' : 'Perlu Perhatian'}
              </p>
              <p className={`text-xs ${isNormal ? 'text-green-600' : 'text-amber-600'}`}>
                Hasil analisis Z-Score WHO 2006
              </p>
            </div>
          </div>
        )}

        {/* BB / TB / Z-Score grid */}
        {latestRecord && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Z-Score</p>
              <p className="font-bold text-[#1e2939] text-base">
                {latestRecord.zScoreBbU != null ? latestRecord.zScoreBbU.toFixed(1) : '—'}
              </p>
              <p className="text-[10px] text-gray-400">BB/U</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Berat</p>
              <p className="font-bold text-[#1e2939] text-base">
                {latestRecord.beratBadan != null ? latestRecord.beratBadan : '—'}
              </p>
              <p className="text-[10px] text-gray-400">kg</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Tinggi</p>
              <p className="font-bold text-[#1e2939] text-base">
                {latestRecord.tinggiBadan != null ? latestRecord.tinggiBadan : '—'}
              </p>
              <p className="text-[10px] text-gray-400">cm</p>
            </div>
          </div>
        )}

        {/* Z-Score trend chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Tren Z-Score — {selectedNama}
          </p>
          {historyLoading ? (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              Memuat data...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[120px] flex items-center justify-center text-gray-400 text-sm">
              Belum ada riwayat pemeriksaan
            </div>
          ) : (
            <ZScoreChart data={chartData} />
          )}
        </div>

        {/* Interpretation table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Interpretasi Z-Score (BB/U)
            </p>
          </div>
          {INTERPRETATION_ROWS.map((row) => {
            const isActiveRow = row.key === activeStatus
            return (
              <div
                key={row.key}
                className={[
                  'flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0',
                  isActiveRow ? row.bg : '',
                ].join(' ')}
              >
                <div>
                  <p className={`text-sm font-semibold ${isActiveRow ? row.color : 'text-gray-700'}`}>
                    {row.desc}
                  </p>
                  <p className={`text-xs ${isActiveRow ? row.color : 'text-gray-400'}`}>
                    {row.label}
                  </p>
                </div>
                {isActiveRow && (
                  <CheckCircle size={16} className={row.color} />
                )}
              </div>
            )
          })}
        </div>

      </div>

      {/* Selesai Meja 3 */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <button
          onClick={handleKeluarMeja}
          disabled={clearActiveMejaMutation.isPending}
          className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {clearActiveMejaMutation.isPending && <Loader2 size={14} className="animate-spin" />}
          Selesai Meja 3
        </button>
      </div>
      <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId} />
    </div>
  )
}
