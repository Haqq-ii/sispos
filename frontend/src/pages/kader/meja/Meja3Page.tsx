/**
 * Meja3Page — Meja 3: Pencatatan Klinis
 *
 * Features:
 * - Z-Score trend chart (recharts) — BB/U, TB/U, BB/TB seluruh riwayat balita
 * - Tanda klinis checkbox form: rambutKemerahan, perutBuncit, edema, pucat + lainnya
 * - Status gizi override select (opsional)
 * - PATCH /api/growth/pemeriksaan/:id → simpan tanda klinis + statusGiziOverride
 * - Navigate ke Meja 4 dengan state { antrianId, balitaId, namaBalita, pemeriksaanId, tandaKlinis, statusGizi }
 * - "Lewati" → navigate ke Meja 4 tanpa menyimpan (tanda klinis opsional)
 *
 * State source: router state dari Meja2Page (antrianId, balitaId, namaBalita, pemeriksaanId)
 * Fallback: useKaderMejaStore.activePemeriksaanId
 *
 * Note: Checkbox menggunakan native HTML input[type=checkbox] + Tailwind karena
 * @radix-ui/react-checkbox tidak tersedia di package.json (pola: InlineProgress plan 03-02).
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { usePemeriksaanHistory, usePatchPemeriksaan } from '@/hooks/usePemeriksaan'
import { ZScoreChart, type ZScoreDataPoint } from '@/components/kader/ZScoreChart'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import { generateTempId } from '@/lib/offline-db'
import { TukarMejaModal } from '@/components/kader/TukarMejaModal'

// ── Zod v4 schema (frontend) ──────────────────────────────────────────────

// Zod v4 frontend schema — TIDAK gunakan .default() agar zodResolver inference tidak mismatch
// (pola dari Meja2Schema yang menggunakan .min() bukan .positive())
const TandaKlinisSchema = z.object({
  rambutKemerahan: z.boolean(),
  perutBuncit: z.boolean(),
  edema: z.boolean(),
  pucat: z.boolean(),
  lainnya: z.string().optional(),
})

type TandaKlinisInput = z.infer<typeof TandaKlinisSchema>

// Status gizi enum untuk select
const STATUS_GIZI_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'kurang', label: 'Kurang' },
  { value: 'buruk', label: 'Buruk' },
  { value: 'lebih', label: 'Lebih' },
  { value: 'obesitas', label: 'Obesitas' },
  { value: 'pendek', label: 'Pendek' },
  { value: 'sangat_pendek', label: 'Sangat Pendek' },
] as const

// ── Helper — format tanggal ke DD/MM/YY ──────────────────────────────────

function formatTanggal(dateStr: string): string {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Meja3Page() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { activePemeriksaanId, activeAntrianId, activeBalitaId, activeNamaBalita } = useKaderMejaStore()

  // Router state dari Meja2Page navigate call
  const routerState = location.state as {
    antrianId?: string
    balitaId?: string
    namaBalita?: string
    pemeriksaanId?: string
  } | null

  const antrianId = routerState?.antrianId ?? activeAntrianId ?? undefined
  const balitaId = routerState?.balitaId ?? activeBalitaId ?? undefined
  const namaBalita = routerState?.namaBalita ?? activeNamaBalita ?? 'Balita'
  const pemeriksaanId = routerState?.pemeriksaanId ?? activePemeriksaanId

  useEffect(() => {
    if (!balitaId || !pemeriksaanId) navigate('/kader/dashboard', { replace: true })
  }, [balitaId, pemeriksaanId, navigate])

  if (!balitaId || !pemeriksaanId) return null

  return (
    <Meja3Content
      antrianId={antrianId}
      balitaId={balitaId}
      namaBalita={namaBalita}
      pemeriksaanId={pemeriksaanId}
    />
  )
}

// ── Inner component (setelah guard passed) ────────────────────────────────

interface Meja3ContentProps {
  antrianId: string | undefined
  balitaId: string
  namaBalita: string
  pemeriksaanId: string
}

function Meja3Content({ antrianId, balitaId, namaBalita, pemeriksaanId }: Meja3ContentProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { activeSlotId } = useKaderMejaStore()
  const isOnline = useOfflineStatus()
  const { enqueueOperation } = useOfflineSync()

  const [showTukarMeja, setShowTukarMeja] = useState(false)
  const [statusGiziOverride, setStatusGiziOverride] = useState<string | null>(null)

  // Riwayat pemeriksaan untuk grafik Z-Score
  const { data: history = [], isLoading: historyLoading } = usePemeriksaanHistory(balitaId)

  // Transform ke format ZScoreDataPoint
  const chartData: ZScoreDataPoint[] = history.map((p) => ({
    tanggal: formatTanggal(p.tanggalPemeriksaan),
    bbU: p.zScoreBbU,
    tbU: p.zScoreTbU,
    bbTb: p.zScoreBbTb,
  }))

  // Ambil statusGizi dari record terakhir sebagai default untuk override select
  const latestRecord = history.length > 0 ? history[history.length - 1] : null
  const currentStatusGizi = latestRecord?.statusGiziOverride ?? latestRecord?.statusGizi ?? null

  // Tanda klinis form
  const form = useForm<TandaKlinisInput>({
    resolver: zodResolver(TandaKlinisSchema),
    defaultValues: {
      rambutKemerahan: false,
      perutBuncit: false,
      edema: false,
      pucat: false,
      lainnya: '',
    },
  })

  // PATCH mutation
  const patchMutation = usePatchPemeriksaan()

  // Submit: simpan tanda klinis + statusGiziOverride ke PATCH endpoint
  async function handleSubmit(values: TandaKlinisInput) {
    const tandaKlinis = {
      rambutKemerahan: values.rambutKemerahan,
      perutBuncit: values.perutBuncit,
      edema: values.edema,
      pucat: values.pucat,
      lainnya: values.lainnya ?? null,
    }

    // Offline branch — enqueue ke pemeriksaan_queue saat tidak ada koneksi
    if (!isOnline) {
      try {
        await enqueueOperation('pemeriksaan', {
          id: generateTempId(),
          tempPemeriksaanId: pemeriksaanId,
          type: 'patch-tanda-klinis' as const,
          data: {
            rambutKemerahan: values.rambutKemerahan,
            perutBuncit: values.perutBuncit,
            edema: values.edema,
            pucat: values.pucat,
            lainnya: values.lainnya ?? null,
            statusGiziOverride: statusGiziOverride ?? undefined,
          },
          timestamp: Date.now(),
        })
        toast({ description: 'Tersimpan lokal, akan sync saat online' })
        navigate('/kader/meja/4', {
          state: {
            antrianId,
            balitaId,
            namaBalita,
            pemeriksaanId,
            tandaKlinis,
            statusGizi: statusGiziOverride,
          },
        })
      } catch {
        // WR-03: IDB unavailable or quota exceeded — warn kader
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }

    patchMutation.mutate(
      {
        id: pemeriksaanId,
        tandaKlinis,
        statusGiziOverride: statusGiziOverride,
      },
      {
        onSuccess: (result) => {
          navigate('/kader/meja/4', {
            state: {
              antrianId,
              balitaId,
              namaBalita,
              pemeriksaanId,
              tandaKlinis,
              statusGizi: result.statusGiziOverride ?? result.statusGizi ?? currentStatusGizi,
            },
          })
        },
        onError: () => {
          toast({
            description: 'Gagal menyimpan tanda klinis. Silakan coba lagi.',
            variant: 'destructive',
          })
        },
      }
    )
  }

  // Lewati: navigate ke Meja 4 tanpa menyimpan (tanda klinis opsional)
  function handleSkip() {
    navigate('/kader/meja/4', {
      state: {
        antrianId,
        balitaId,
        namaBalita,
        pemeriksaanId,
        tandaKlinis: null,
        statusGizi: currentStatusGizi,
      },
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">MEJA 3 — Analisis Z-Score</p>
            <p className="text-[#b9f8cf] text-xs">Grafik pertumbuhan otomatis · {namaBalita}</p>
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

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Z-Score Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Tren Z-Score — {namaBalita}
          </p>
          {historyLoading ? (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
              Memuat data...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
              Belum ada riwayat pemeriksaan
            </div>
          ) : (
            <ZScoreChart data={chartData} />
          )}
        </div>

        {/* Tanda Klinis Form */}
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Tanda Klinis (opsional)
            </p>
            <div className="space-y-3">
              {([
                { key: 'rambutKemerahan', label: 'Rambut Kemerahan/Kusam' },
                { key: 'perutBuncit', label: 'Perut Buncit' },
                { key: 'edema', label: 'Edema (bengkak kaki/tangan)' },
                { key: 'pucat', label: 'Pucat/Anemia' },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={key}
                    className="h-4 w-4 rounded border-gray-300 text-[#008236] focus:ring-[#008236]"
                    {...form.register(key)}
                  />
                  <Label htmlFor={key} className="text-sm text-gray-700 cursor-pointer font-normal">
                    {label}
                  </Label>
                </div>
              ))}
              <div className="pt-1">
                <Label htmlFor="lainnya" className="text-xs text-gray-500 mb-1 block">
                  Tanda klinis lainnya:
                </Label>
                <Input
                  id="lainnya"
                  placeholder="Tuliskan jika ada..."
                  className="text-sm h-9"
                  {...form.register('lainnya')}
                />
              </div>
            </div>
          </div>

          {/* Status Gizi Override */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Override Status Gizi{' '}
              <span className="font-normal normal-case text-gray-400">(opsional)</span>
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Hanya isi jika berbeda dari hasil otomatis ({currentStatusGizi ?? 'belum tersedia'})
            </p>
            <Select
              value={statusGiziOverride ?? ''}
              onValueChange={(val) => setStatusGiziOverride(val || null)}
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Pilih override status gizi..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_GIZI_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusGiziOverride && (
              <button
                type="button"
                className="mt-1.5 text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setStatusGiziOverride(null)}
              >
                Hapus override
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSkip}
              disabled={patchMutation.isPending}
              className="flex-1 border border-[#05df72] text-[#008236] rounded-2xl py-3.5 text-sm font-semibold"
            >
              Lewati
            </button>
            <button
              type="submit"
              disabled={patchMutation.isPending}
              className="flex-1 bg-[#008236] text-white rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {patchMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</>
              ) : (
                'Simpan & Lanjut'
              )}
            </button>
          </div>

          {/* Selesai Meja 3 */}
          <button
            type="button"
            onClick={() => navigate('/kader/dashboard', { replace: true })}
            className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] rounded-2xl py-3 text-sm font-semibold"
          >
            Selesai Meja 3
          </button>
        </form>
      </div>
      <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId ?? ''} />
    </div>
  )
}
