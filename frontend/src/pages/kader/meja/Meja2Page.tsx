/**
 * Meja2Page — Meja 2: Penimbangan (BB/TB) + Z-Score WHO 2006
 *
 * Features:
 * - Large numeric inputs for BB (kg) + TB (cm) with decimal keyboard on mobile
 * - Optional: lingkar kepala + lingkar lengan (collapsible)
 * - Biological validation gate: if BB > 30 kg → Dialog konfirmasi sebelum kirim
 * - POST /api/growth/pemeriksaan → Z-Score response
 * - Z-Score result card: WAZ, HAZ, WHZ + statusGizi badge
 * - Store pemeriksaanId in useKaderMejaStore.activePemeriksaanId
 * - "Lanjut ke Meja 3" → navigate with state { antrianId, balitaId, namaBalita, pemeriksaanId }
 * - Guard: if !activeSlotId → redirect to /kader/dashboard
 *
 * T-03-04-02 mitigation: biological gate is UX layer. Backend enforces via
 * x-konfirmasi-biologis header. useCreatePemeriksaan adds header when flag is true.
 */
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogOut, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useMutationClearActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { useCreatePemeriksaan, type PemeriksaanRecord } from '@/hooks/usePemeriksaan'
import { Meja2Schema, type Meja2Input } from '@/lib/schemas/pemeriksaan.schemas'

// ── Status gizi badge ────────────────────────────────────────────────────────

type StatusGiziValue =
  | 'normal'
  | 'kurang'
  | 'buruk'
  | 'lebih'
  | 'obesitas'
  | 'pendek'
  | 'sangat_pendek'

const STATUS_GIZI_STYLE: Record<string, string> = {
  normal: 'bg-green-100 text-green-700',
  kurang: 'bg-yellow-100 text-yellow-700',
  buruk: 'bg-red-100 text-red-700',
  lebih: 'bg-orange-100 text-orange-700',
  obesitas: 'bg-orange-100 text-orange-700',
  pendek: 'bg-purple-100 text-purple-700',
  sangat_pendek: 'bg-purple-100 text-purple-700',
}

const STATUS_GIZI_LABEL: Record<string, string> = {
  normal: 'Normal',
  kurang: 'Berat Badan Kurang',
  buruk: 'Gizi Buruk',
  lebih: 'Berat Badan Lebih',
  obesitas: 'Obesitas',
  pendek: 'Pendek',
  sangat_pendek: 'Sangat Pendek',
}

function StatusGiziBadge({ status }: { status: string | null }) {
  if (!status) return null
  const style = STATUS_GIZI_STYLE[status] ?? 'bg-gray-100 text-gray-700'
  const label = STATUS_GIZI_LABEL[status] ?? status
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${style}`}>
      {label}
    </span>
  )
}

// ── Type guard for Axios-like errors ─────────────────────────────────────────

function isAxiosLikeError(
  error: unknown,
): error is { response: { data: { error: string; message: string } } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response: unknown }).response === 'object' &&
    (error as { response: unknown }).response !== null &&
    'data' in ((error as { response: Record<string, unknown> }).response)
  )
}

function getErrorMessage(error: unknown): string {
  if (isAxiosLikeError(error)) return error.response.data.message
  return 'Terjadi kesalahan. Coba lagi.'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Meja2Page() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  // ── Store ─────────────────────────────────────────────────────────────────
  const { activeSlotId, setActivePemeriksaanId, reset: resetStore } = useKaderMejaStore()
  const clearActiveMejaMutation = useMutationClearActiveMeja()

  // ── Router state (passed from Meja1Page navigate call) ───────────────────
  const routeState = location.state as {
    antrianId?: string
    balitaId?: string
    namaBalita?: string
  } | null

  const antrianId = routeState?.antrianId
  const balitaId = routeState?.balitaId
  const namaBalita = routeState?.namaBalita ?? 'Balita'

  // ── Guard: no active slot → redirect ─────────────────────────────────────
  if (!activeSlotId) {
    navigate('/kader/dashboard', { replace: true })
    return null
  }

  // ── Local state ───────────────────────────────────────────────────────────
  const [showDataTambahan, setShowDataTambahan] = useState(false)
  const [showKonfirmasi, setShowKonfirmasi] = useState(false)
  const [pendingData, setPendingData] = useState<Meja2Input | null>(null)
  const [pemResult, setPemResult] = useState<PemeriksaanRecord | null>(null)

  // ── Form ──────────────────────────────────────────────────────────────────
  const form = useForm<Meja2Input>({
    resolver: zodResolver(Meja2Schema),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = form

  const bbValue = watch('beratBadan')
  const tbValue = watch('tinggiBadan')
  const isBbFilled = typeof bbValue === 'number' && !isNaN(bbValue) && bbValue > 0
  const isTbFilled = typeof tbValue === 'number' && !isNaN(tbValue) && tbValue > 0

  // ── Mutation ──────────────────────────────────────────────────────────────
  const createPemeriksaan = useCreatePemeriksaan()

  // ── Handlers ─────────────────────────────────────────────────────────────

  function doSubmit(data: Meja2Input, konfirmasiBiologis: boolean) {
    if (!balitaId) {
      toast({
        description: 'Data balita tidak tersedia. Kembali ke Meja 1 dan pilih balita.',
        variant: 'destructive',
      })
      return
    }

    createPemeriksaan.mutate(
      {
        balitaId,
        antrianId,
        beratBadan: data.beratBadan,
        tinggiBadan: data.tinggiBadan,
        lingkarKepala: data.lingkarKepala,
        lingkarLengan: data.lingkarLengan,
        catatanKonsultasi: data.catatanKonsultasi,
        konfirmasiBiologis,
      },
      {
        onSuccess: (result) => {
          setActivePemeriksaanId(result.id)
          setPemResult(result)
          setShowKonfirmasi(false)
          setPendingData(null)
          toast({ description: 'Data timbang berhasil disimpan.' })
        },
        onError: (err) => {
          toast({ description: getErrorMessage(err), variant: 'destructive' })
        },
      }
    )
  }

  function onSubmit(data: Meja2Input) {
    // Biological validation gate (UX layer — backend enforces server-side)
    if (data.beratBadan > 30) {
      setPendingData(data)
      setShowKonfirmasi(true)
      return
    }
    doSubmit(data, false)
  }

  function handleKonfirmasiYa() {
    if (!pendingData) return
    doSubmit(pendingData, true)
  }

  function handleKonfirmasiTidak() {
    setShowKonfirmasi(false)
    setPendingData(null)
  }

  const handleKeluarMeja = () => {
    clearActiveMejaMutation.mutate(undefined, {
      onSuccess: () => {
        resetStore()
        navigate('/kader/dashboard', { replace: true })
      },
    })
  }

  const handleLanjutMeja3 = () => {
    navigate('/kader/meja/3', {
      state: {
        antrianId,
        balitaId,
        namaBalita,
        pemeriksaanId: pemResult?.id,
      },
    })
  }

  const isSaving = createPemeriksaan.isPending
  const canSubmit = isBbFilled && !isSaving && !pemResult

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="text-primary font-bold text-sm">Meja 2 — Penimbangan</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleKeluarMeja}
          disabled={clearActiveMejaMutation.isPending}
          className="text-xs text-gray-500"
        >
          <LogOut size={14} className="mr-1" />
          Keluar Meja
        </Button>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-4 space-y-4">

        {/* Section A: Balita info */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Balita</p>
            <p className="text-lg font-bold text-gray-800">{namaBalita}</p>
            {!balitaId && (
              <p className="text-xs text-amber-600 mt-1">
                Data balita tidak lengkap — kembali ke Meja 1 dan pilih balita terlebih dahulu.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section B: BB/TB input form */}
        {!pemResult && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Berat Badan */}
            <div className="space-y-1">
              <Label htmlFor="beratBadan" className="text-sm font-medium">
                Berat Badan (kg) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="beratBadan"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0.1"
                  max="100"
                  placeholder="0.0"
                  className="text-3xl text-center h-16 font-bold pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  {...register('beratBadan', { valueAsNumber: true })}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                  kg
                </span>
              </div>
              {errors.beratBadan && (
                <p className="text-xs text-red-500">{errors.beratBadan.message}</p>
              )}
            </div>

            {/* Tinggi Badan */}
            <div className="space-y-1">
              <Label htmlFor="tinggiBadan" className="text-sm font-medium">
                Tinggi Badan (cm)
              </Label>
              <div className="relative">
                <Input
                  id="tinggiBadan"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0.1"
                  max="200"
                  placeholder="0.0"
                  className="text-3xl text-center h-16 font-bold pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  {...register('tinggiBadan', { valueAsNumber: true })}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                  cm
                </span>
              </div>
              {errors.tinggiBadan && (
                <p className="text-xs text-red-500">{errors.tinggiBadan.message}</p>
              )}
            </div>

            {/* Data Tambahan (collapsible) */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setShowDataTambahan(!showDataTambahan)}
              >
                <span>Data Tambahan (Opsional)</span>
                {showDataTambahan ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showDataTambahan && (
                <div className="px-4 pb-4 space-y-3 border-t pt-3">
                  <div className="space-y-1">
                    <Label htmlFor="lingkarKepala" className="text-xs text-gray-600">
                      Lingkar Kepala (cm)
                    </Label>
                    <div className="relative">
                      <Input
                        id="lingkarKepala"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        placeholder="0.0"
                        className="h-10 text-sm pr-10"
                        {...register('lingkarKepala', { valueAsNumber: true })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        cm
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lingkarLengan" className="text-xs text-gray-600">
                      Lingkar Lengan Atas (cm)
                    </Label>
                    <div className="relative">
                      <Input
                        id="lingkarLengan"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        placeholder="0.0"
                        className="h-10 text-sm pr-10"
                        {...register('lingkarLengan', { valueAsNumber: true })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        cm
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Info: TB not required */}
            {!isTbFilled && (
              <p className="text-xs text-gray-400 text-center">
                Tinggi badan opsional — Z-Score BB/TB tidak akan dihitung jika tidak diisi.
              </p>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={!canSubmit}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Data Timbang'
              )}
            </Button>
          </form>
        )}

        {/* Section C: Z-Score result (shown after successful save) */}
        {pemResult && (
          <div className="space-y-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Hasil Z-Score WHO 2006</h3>
                  <StatusGiziBadge status={pemResult.statusGizi} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">BB / Umur (WAZ)</span>
                    <span className="font-mono font-semibold">
                      {pemResult.zScoreBbU !== null ? pemResult.zScoreBbU.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">TB / Umur (HAZ)</span>
                    <span className="font-mono font-semibold">
                      {pemResult.zScoreTbU !== null ? pemResult.zScoreTbU.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">BB / TB (WHZ)</span>
                    <span className="font-mono font-semibold">
                      {pemResult.zScoreBbTb !== null ? pemResult.zScoreBbTb.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 border-t pt-2 mt-1">
                  Z-Score dihitung berdasarkan standar WHO 2006
                </p>
              </CardContent>
            </Card>

            {/* Data summary */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-gray-500 mb-2">Data yang disimpan</p>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">BB</span>
                    <p className="font-bold text-lg">
                      {pemResult.beratBadan !== null ? pemResult.beratBadan : '—'} kg
                    </p>
                  </div>
                  {pemResult.tinggiBadan !== null && (
                    <div>
                      <span className="text-gray-500 text-xs">TB</span>
                      <p className="font-bold text-lg">{pemResult.tinggiBadan} cm</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lanjut ke Meja 3 */}
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleLanjutMeja3}
            >
              Lanjut ke Meja 3 →
            </Button>
          </div>
        )}
      </div>

      {/* Biological confirmation Dialog */}
      <Dialog open={showKonfirmasi} onOpenChange={(open: boolean) => { if (!open) handleKonfirmasiTidak() }}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <DialogTitle>Konfirmasi Nilai Tidak Biasa</DialogTitle>
            </div>
            <DialogDescription className="text-left">
              Nilai berat badan{' '}
              <strong>{pendingData?.beratBadan} kg</strong> sangat tidak biasa untuk balita
              (anak di bawah 5 tahun umumnya tidak melebihi 30 kg).
              <br />
              <br />
              Pastikan data sudah benar sebelum menyimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              onClick={handleKonfirmasiYa}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Ya, Data Sudah Benar — Simpan'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleKonfirmasiTidak}
              disabled={isSaving}
              className="w-full"
            >
              Koreksi Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
