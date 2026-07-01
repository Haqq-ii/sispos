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
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogOut, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const { activePemeriksaanId } = useKaderMejaStore()

  // Router state dari Meja2Page navigate call
  const routerState = location.state as {
    antrianId?: string
    balitaId?: string
    namaBalita?: string
    pemeriksaanId?: string
  } | null

  const antrianId = routerState?.antrianId
  const balitaId = routerState?.balitaId
  const namaBalita = routerState?.namaBalita ?? 'Balita'
  const pemeriksaanId = routerState?.pemeriksaanId ?? activePemeriksaanId

  // Guard: navigasi harus membawa balitaId dan pemeriksaanId
  if (!balitaId || !pemeriksaanId) {
    navigate('/kader/dashboard', { replace: true })
    return null
  }

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
  function handleSubmit(values: TandaKlinisInput) {
    const tandaKlinis = {
      rambutKemerahan: values.rambutKemerahan,
      perutBuncit: values.perutBuncit,
      edema: values.edema,
      pucat: values.pucat,
      lainnya: values.lainnya ?? null,
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

  // Lewati: navigate ke Meja 4 tanpa menyimpan
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

  // Keluar meja
  function handleKeluar() {
    navigate('/kader/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-base font-bold text-gray-900">Meja 3 — Pencatatan Klinis</h1>
          <p className="text-xs text-gray-500">{namaBalita}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleKeluar} className="text-red-600">
          <LogOut className="h-4 w-4 mr-1" />
          Keluar Meja
        </Button>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-6">
        {/* Z-Score Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Tren Z-Score — {namaBalita}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {historyLoading ? (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
                Memuat data...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
                Belum ada riwayat pemeriksaan
              </div>
            ) : (
              <ZScoreChart data={chartData} />
            )}
          </CardContent>
        </Card>

        {/* Tanda Klinis Form */}
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Tanda Klinis (opsional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Checkbox items menggunakan native HTML input[type=checkbox] + Tailwind */}
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
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    {...form.register(key)}
                  />
                  <Label htmlFor={key} className="text-sm text-gray-700 cursor-pointer font-normal">
                    {label}
                  </Label>
                </div>
              ))}

              {/* Tanda klinis lainnya */}
              <div className="space-y-1 pt-1">
                <Label htmlFor="lainnya" className="text-sm text-gray-600">
                  Tanda klinis lainnya:
                </Label>
                <Input
                  id="lainnya"
                  placeholder="Tuliskan jika ada..."
                  className="text-sm"
                  {...form.register('lainnya')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Status Gizi Override */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Override Status Gizi <span className="font-normal text-gray-500">(opsional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 mb-3">
                Hanya isi jika berbeda dari hasil otomatis (
                {currentStatusGizi ?? 'belum tersedia'})
              </p>
              <Select
                value={statusGiziOverride ?? ''}
                onValueChange={(val) => setStatusGiziOverride(val || null)}
              >
                <SelectTrigger className="w-full">
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
                  className="mt-1 text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => setStatusGiziOverride(null)}
                >
                  Hapus override
                </button>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleSkip}
              disabled={patchMutation.isPending}
            >
              Lewati
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={patchMutation.isPending}
            >
              {patchMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan & Lanjut'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
