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
import { ChevronLeft, Loader2, MessageCircle } from 'lucide-react'

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

// ── Stepper data ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Pilih Tanggal', idx: 0 },
  { label: 'Pilih Sesi', idx: 1 },
  { label: 'Konfirmasi', idx: 2 },
]

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
  const estimasiMenit = Math.round((terisi + 1) * estimasiDurasi)

  const isLoading = isLoadingSesi || isLoadingBalita
  const hasBalita = (balitaList?.length ?? 0) > 0
  const canSubmit = hasBalita && !!selectedBalitaId && !mutation.isPending

  const activeStep = 2

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
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header */}
      <div className="bg-white sticky top-0 z-10 px-4 pt-10 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-gray-100"
            onClick={() => navigate(-1)}
            aria-label="Kembali ke halaman sebelumnya"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-800">Ambil Nomor Antrian</span>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mt-3">
          {STEPS.map(({ label, idx }) => {
            const done = idx < activeStep
            const active = idx === activeStep
            return (
              <div key={idx} className="flex items-center gap-1 flex-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    done || active ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {done ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-xs flex-1 ${
                    active ? 'text-green-600 font-semibold' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
                {idx < 2 && (
                  <div
                    className={`h-0.5 w-3 flex-shrink-0 ${
                      idx < activeStep ? 'bg-green-400' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
          </div>
        )}

        {!isLoading && (
          <>
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

            {/* Summary confirm card */}
            {selectedSesi && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
                <h2 className="text-gray-800 font-bold mb-4">Ringkasan Antrian</h2>

                {[
                  {
                    label: 'Posyandu',
                    value: selectedSesi.jadwal?.posyandu.namaPosyandu ?? 'Posyandu',
                  },
                  {
                    label: 'Tanggal',
                    value: formatTanggalPanjang(
                      selectedSesi.jadwal?.tanggalPelaksanaan ?? ''
                    ),
                  },
                  {
                    label: 'Sesi',
                    value: `${selectedSesi.labelSesi} · ${formatJam(selectedSesi.jamMulai)}–${formatJam(selectedSesi.jamSelesai)} WIB`,
                  },
                  {
                    label: 'Estimasi Tunggu',
                    value: `±${estimasiMenit} menit`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-gray-500 text-sm">{row.label}</span>
                    <span className="text-gray-800 text-sm font-semibold">{row.value}</span>
                  </div>
                ))}

                {/* WA notice */}
                <div className="p-3 bg-green-50 rounded-xl border border-green-200 mt-4">
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-700 text-xs">
                      Struk antrian akan dikirim via{' '}
                      <span className="font-bold">WhatsApp</span>. Jika WA gagal, kode
                      antrian akan tampil di beranda aplikasi.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Balita selection */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Untuk balita</p>

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
                      <RadioGroupItem value={balita.id} id={`balita-${balita.id}`} />
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

            {/* CTAs */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 ${
                canSubmit
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-green-200 cursor-not-allowed'
              }`}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                'Konfirmasi & Ambil Antrian'
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full mt-2 py-3 text-gray-500 text-sm hover:text-gray-700"
            >
              Batal
            </button>
          </>
        )}
      </div>
    </div>
  )
}
