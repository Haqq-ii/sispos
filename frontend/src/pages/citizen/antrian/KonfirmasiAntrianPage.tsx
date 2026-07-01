/**
 * KonfirmasiAntrianPage — Screen 3: Summary + pilih balita + ambil antrian.
 *
 * Figma frame: 5:2902
 *
 * Alur:
 * 1. Dapat jadwalId dari location.state (diteruskan PilihSesiPage)
 * 2. Dapat selectedSlotId dari useAntrianStore
 * 3. Load sesi detail dari GET /api/sesi?jadwalId=...
 * 4. Load daftar balita citizen dari GET /api/balita
 * 5. Citizen pilih balita → POST /api/antrian/ambil
 * 6. Sukses → reset store, navigate ke TiketAntrianPage
 *
 * Error handling:
 * - 409 SLOT_PENUH  → Alert + "Ganti Sesi" ghost button (race condition)
 * - 409 SUDAH_DAFTAR → Alert (balita sudah daftar di sesi ini)
 * - Generic         → Standard destructive alert
 */
import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, MapPin, Calendar, Clock, Timer, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAntrianStore } from '@/stores/useAntrianStore'
import { useAmbilAntrian, useSesiAvailability } from '@/hooks/useSesiAvailability'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BalitaItem {
  id: string
  namaBalita: string
  tanggalLahir: string
  jenisKelamin: 'laki_laki' | 'perempuan'
}

interface KonfirmasiLocationState {
  jadwalId?: string
}

interface AmbilAntrianResponseData {
  antrianId: string
  nomorUrut: number
  estimasiMenit: number
  namaPosyandu: string
  labelSesi: string
  tanggalPelaksanaan: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTanggalPanjang(isoStr: string): string {
  try {
    const datePart = isoStr.substring(0, 10)
    const [year, month, day] = datePart.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return isoStr
  }
}

function formatJam(timeStr: string): string {
  if (!timeStr) return ''
  // Bisa "08:00" (sudah diformat backend) atau "08:00:00"
  return timeStr.substring(0, 5)
}

function hitungUsia(tanggalLahir: string): string {
  try {
    const lahir = new Date(tanggalLahir)
    const sekarang = new Date()
    let tahun = sekarang.getFullYear() - lahir.getFullYear()
    let bulan = sekarang.getMonth() - lahir.getMonth()
    if (bulan < 0) {
      tahun--
      bulan += 12
    }
    if (tahun > 0) return `${tahun} th ${bulan} bln`
    return `${bulan} bln`
  } catch {
    return ''
  }
}

function isAxiosLikeError(
  err: unknown
): err is { response?: { status?: number; data?: { error?: string } } } {
  return typeof err === 'object' && err !== null && 'response' in err
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function KonfirmasiAntrianPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedSlotId, reset } = useAntrianStore()

  const state = (location.state ?? {}) as KonfirmasiLocationState
  const jadwalId = state.jadwalId ?? null

  const [selectedBalitaId, setSelectedBalitaId] = useState<string>('')
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  // Semua hooks WAJIB dipanggil sebelum conditional return (Rules of Hooks)
  const { data: sesiList, isLoading: isLoadingSesi } = useSesiAvailability(jadwalId)

  const { data: balitaList, isLoading: isLoadingBalita } = useQuery({
    queryKey: ['balita', 'saya'],
    queryFn: () =>
      apiClient.get('/balita').then((r) => r.data.data as BalitaItem[]),
  })

  const mutation = useAmbilAntrian()

  // Guard: harus ada selectedSlotId untuk melanjutkan
  if (!selectedSlotId) {
    return <Navigate to="/citizen/antrian/pilih-sesi" replace />
  }
  if (!jadwalId) {
    return <Navigate to="/citizen/antrian/pilih-tanggal" replace />
  }

  // Cari sesi yang dipilih dari daftar
  const selectedSesi = sesiList?.find((s) => s.id === selectedSlotId)
  const estimasiDurasi = selectedSesi?.jadwal?.estimasiDurasiMenit ?? 7
  const terisi = selectedSesi?.terisi ?? 0
  // Estimasi worst-case: nomorUrut = terisi + 1
  const estimasiMenit = Math.round((terisi + 1) * estimasiDurasi)

  const isLoading = isLoadingSesi || isLoadingBalita
  const hasBalita = (balitaList?.length ?? 0) > 0
  const canSubmit = hasBalita && !!selectedBalitaId && !mutation.isPending

  // ── Handler ────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!selectedSlotId || !selectedBalitaId) return
    setMutationError(null)
    setErrorCode(null)

    mutation.mutate(
      { slotId: selectedSlotId, balitaId: selectedBalitaId },
      {
        onSuccess: (data) => {
          reset()
          const result = data as AmbilAntrianResponseData
          navigate('/citizen/antrian/tiket/' + result.antrianId)
        },
        onError: (err) => {
          if (isAxiosLikeError(err)) {
            const code = err.response?.data?.error ?? null
            setErrorCode(code)
            if (code === 'SLOT_PENUH') {
              setMutationError(
                'Sesi ini sudah penuh saat Anda mengkonfirmasi. Silakan pilih sesi lain.'
              )
            } else if (code === 'SUDAH_DAFTAR') {
              setMutationError(
                'Balita ini sudah terdaftar di sesi yang sama. Pilih balita lain atau sesi berbeda.'
              )
            } else {
              setMutationError('Terjadi kesalahan. Silakan coba beberapa saat lagi.')
            }
          } else {
            setMutationError('Terjadi kesalahan. Silakan coba beberapa saat lagi.')
          }
        },
      }
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[400px] mx-auto px-4 py-6">
        {/* Back button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] mb-2 -ml-2"
          onClick={() => navigate('/citizen/antrian/pilih-sesi')}
          aria-label="Kembali ke halaman sebelumnya"
        >
          <ChevronLeft size={20} />
        </Button>

        <h1 className="text-xl font-bold mb-4">Konfirmasi Antrian</h1>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Summary card */}
            {selectedSesi && (
              <div className="bg-green-50 rounded-lg p-4 space-y-3 mb-4">
                {/* Posyandu */}
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-primary flex-shrink-0" />
                  <p className="text-sm font-bold">
                    {selectedSesi.jadwal?.posyandu.namaPosyandu ?? 'Posyandu'}
                  </p>
                </div>

                {/* Tanggal */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500">Tanggal</span>
                  </div>
                  <span className="text-sm font-bold">
                    {formatTanggalPanjang(selectedSesi.jadwal?.tanggalPelaksanaan ?? '')}
                  </span>
                </div>

                {/* Sesi */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500">Sesi</span>
                  </div>
                  <span className="text-sm font-bold">
                    {selectedSesi.labelSesi} &middot;{' '}
                    {formatJam(selectedSesi.jamMulai)} – {formatJam(selectedSesi.jamSelesai)} WIB
                  </span>
                </div>

                {/* Estimasi — WAJIB tanda ± dan disclaimer (QUEUE-03) */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Timer size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500">Estimasi</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">±{estimasiMenit} menit</span>
                    <p className="text-xs text-gray-400 italic">
                      Estimasi dapat berubah sesuai kondisi pelayanan
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error alert */}
            {mutationError && (
              <div className="mb-4">
                <Alert variant="destructive">
                  <AlertDescription>{mutationError}</AlertDescription>
                  {errorCode === 'SLOT_PENUH' && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto p-0 text-sm text-red-600 hover:text-red-700"
                        onClick={() => navigate('/citizen/antrian/pilih-sesi')}
                      >
                        Ganti Sesi
                      </Button>
                    </div>
                  )}
                </Alert>
              </div>
            )}

            {/* Pilih balita */}
            <div className="mb-6">
              <p className="text-sm font-bold mb-3">Untuk balita</p>

              {!hasBalita ? (
                <Alert>
                  <AlertDescription>
                    Belum ada data balita. Tambahkan balita terlebih dahulu.
                  </AlertDescription>
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-sm text-primary"
                      disabled
                    >
                      Tambah Balita
                    </Button>
                  </div>
                </Alert>
              ) : (
                <RadioGroup
                  value={selectedBalitaId}
                  onValueChange={setSelectedBalitaId}
                  className="gap-2"
                >
                  {balitaList?.map((balita) => (
                    <div
                      key={balita.id}
                      className="flex items-center gap-3 border rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <RadioGroupItem
                        value={balita.id}
                        id={`balita-${balita.id}`}
                      />
                      <Label
                        htmlFor={`balita-${balita.id}`}
                        className="cursor-pointer flex-1"
                      >
                        <span className="text-sm font-bold">{balita.namaBalita}</span>
                        <span className="text-xs text-gray-500 ml-1">
                          ({hitungUsia(balita.tanggalLahir)}) &mdash;{' '}
                          {balita.jenisKelamin === 'laki_laki' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>

            {/* CTA */}
            <Button
              type="button"
              className="w-full min-h-[44px]"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Mengambil antrian...
                </>
              ) : (
                'Ambil Antrian'
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
