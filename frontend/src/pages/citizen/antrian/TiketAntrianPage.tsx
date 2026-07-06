/**
 * TiketAntrianPage — Screen 4: Tiket antrian dengan realtime countdown.
 *
 * Figma frame: 5:3116
 *
 * ATURAN KRITIS:
 * - nomorUrut WAJIB zero-padded 2 digit: String(nomorUrut).padStart(2, '0')
 * - Prefix "±" WAJIB pada semua countdown figure (via CountdownEstimasi)
 * - socket.connect() saat mount, socket.disconnect() saat unmount (via useAntrianSocket)
 * - BatalkanAntrianDialog HANYA dirender ketika statusAntrian === 'menunggu' (D-06)
 * - WA notice: "Struk dikirim via WhatsApp" (QUEUE-06 UX)
 */
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, MessageCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CountdownEstimasi } from '@/components/antrian/CountdownEstimasi'
import { StatusAntrian } from '@/components/antrian/StatusAntrian'
import { BatalkanAntrianDialog } from '@/components/antrian/BatalkanAntrianDialog'
import { useAntrianSocket } from '@/hooks/useAntrianSocket'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusAntrianValue =
  | 'menunggu'
  | 'dipanggil'
  | 'selesai'
  | 'ditangguhkan'
  | 'tidak_hadir'
  | 'dibatalkan'

interface AntrianDetail {
  id: string
  nomorUrut: number
  statusAntrian: StatusAntrianValue
  slotId: string
  estimasiMenit: number
  slotSesi?: {
    nomorSesi: number
    labelSesi: string
    jamMulai: string
    jamSelesai: string
    durasiRataAktual?: number | null
    jadwal?: {
      estimasiDurasiMenit: number
      tanggalPelaksanaan: string
      posyandu?: {
        namaPosyandu: string
        kecamatan?: string
        kelurahan?: string
        kabupaten?: string
      }
    }
  }
  balita?: {
    namaBalita: string
  }
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

/**
 * formatJam — extract HH:MM dari berbagai format waktu.
 * Prisma @db.Time diserialisasi sebagai ISO string "1970-01-01T08:00:00.000Z"
 * saat di-include dalam relasi (antrian.slotSesi.jamMulai).
 */
function formatJam(timeStr: string): string {
  if (!timeStr) return ''
  if (timeStr.includes('T')) {
    return timeStr.substring(11, 16)
  }
  return timeStr.substring(0, 5)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TiketAntrianPage() {
  const { antrianId } = useParams<{ antrianId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch detail antrian
  const { data: antrian, isLoading } = useQuery({
    queryKey: ['antrian', antrianId],
    queryFn: () =>
      apiClient
        .get('/antrian/' + antrianId!)
        .then((r) => r.data.data as AntrianDetail),
    enabled: !!antrianId,
    refetchOnWindowFocus: false,
  })

  // Socket: connect setelah slotId tersedia (guard di dalam useAntrianSocket)
  const slotId = antrian?.slotId ?? ''
  const { queueState, socketStatus } = useAntrianSocket(slotId, antrianId ?? '')

  // Data dari socket update (override antrian.slotSesi values jika ada)
  const nomorAktif = queueState?.nomorAktif ?? 0
  const durasiRataAktual =
    queueState?.durasiRataAktual ?? antrian?.slotSesi?.durasiRataAktual ?? null
  const estimasiDurasiMenit = antrian?.slotSesi?.jadwal?.estimasiDurasiMenit ?? 7
  const statusAntrian = antrian?.statusAntrian ?? 'menunggu'

  // Posyandu info
  const posyandu = antrian?.slotSesi?.jadwal?.posyandu
  const posyanduNama = posyandu?.namaPosyandu ?? ''

  // Date + session info
  const tanggalDisplay = formatTanggalPanjang(
    antrian?.slotSesi?.jadwal?.tanggalPelaksanaan ?? ''
  )
  const sesiDisplay = antrian?.slotSesi
    ? `${antrian.slotSesi.labelSesi} · ${formatJam(antrian.slotSesi.jamMulai)} – ${formatJam(antrian.slotSesi.jamSelesai)} WIB`
    : ''

  // Zero-padded nomor urut (WAJIB 2 digit)
  const nomorPadded = antrian
    ? String(antrian.nomorUrut).padStart(2, '0')
    : '--'

  // Handlers
  const handleBatalkanSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['antrian', antrianId] })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header */}
      <div className="bg-white sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <span className="text-[#008236] font-bold">SISPOS</span>
        <span className="text-sm font-bold text-gray-800">Tiket Antrian</span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="px-4 pt-6 space-y-4 max-w-[400px] mx-auto">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-6 rounded" />
          <Skeleton className="h-11 rounded-lg" />
        </div>
      )}

      {antrian && (
        <div className="flex flex-col items-center px-4 pt-6 max-w-[400px] mx-auto">
          {/* Success icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-11 h-11 text-green-600" />
          </div>
          <h2 className="text-gray-800 text-xl font-bold mb-1">Antrian Berhasil!</h2>
          <p className="text-gray-500 text-sm mb-6">
            {antrian.balita?.namaBalita
              ? `Nomor antrian ${antrian.balita.namaBalita} telah dikonfirmasi`
              : 'Nomor antrian Anda telah dikonfirmasi'}
          </p>

          {/* Ticket card */}
          <div className="bg-white rounded-2xl p-6 border border-green-200 w-full shadow-md mb-5">
            <p className="text-gray-500 text-xs mb-1 text-center">Nomor Antrian Anda</p>
            <p
              className="text-green-600 text-6xl font-extrabold text-center mb-3 leading-none"
              aria-label={`Nomor antrian Anda: ${nomorPadded}`}
            >
              {nomorPadded}
            </p>
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              {antrian.balita?.namaBalita && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Balita</span>
                  <span className="text-gray-700 font-semibold">
                    {antrian.balita.namaBalita}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Posyandu</span>
                <span className="text-gray-700 font-semibold">{posyanduNama || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tanggal</span>
                <span className="text-gray-700 font-semibold">{tanggalDisplay}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sesi</span>
                <span className="text-gray-700 font-semibold">{sesiDisplay || '-'}</span>
              </div>
            </div>
          </div>

          {/* Countdown / status */}
          {statusAntrian === 'menunggu' && (
            <div className="w-full mb-4">
              <CountdownEstimasi
                nomorUrut={antrian.nomorUrut}
                estimasiDurasiMenit={estimasiDurasiMenit}
                durasiRataAktual={durasiRataAktual}
                nomorAktif={nomorAktif}
              />
            </div>
          )}
          {statusAntrian === 'dipanggil' && (
            <div className="w-full border rounded-lg p-4 text-center bg-amber-50 mb-4">
              <Badge className="bg-amber-50 text-amber-600 border-amber-200 animate-pulse text-sm">
                Silakan menuju meja pelayanan!
              </Badge>
            </div>
          )}
          {statusAntrian === 'selesai' && (
            <div className="w-full border rounded-lg p-4 text-center bg-green-50 mb-4">
              <CheckCircle className="mx-auto text-green-600 mb-2" size={32} />
              <p className="text-sm font-bold text-green-700">
                Pelayanan selesai. Terima kasih!
              </p>
            </div>
          )}

          {/* Socket disconnect alert */}
          {slotId && socketStatus === 'disconnected' && (
            <Alert className="w-full mb-4">
              <AlertDescription>
                Koneksi realtime terputus. Data mungkin tidak terkini.
              </AlertDescription>
            </Alert>
          )}

          {/* Status badge */}
          <div className="w-full mb-2">
            <StatusAntrian status={statusAntrian} />
          </div>

          {/* WA notice */}
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-200 w-full text-left mb-4">
            <MessageCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-700 text-sm font-semibold">
                Struk dikirim via WhatsApp
              </p>
              <p className="text-green-600 text-xs">
                Cek WhatsApp Anda untuk salinan nomor antrian dan pengingat H-1 pelayanan
              </p>
            </div>
          </div>

          {/* Batalkan (hanya saat menunggu — D-06) */}
          {statusAntrian === 'menunggu' && (
            <div className="w-full mb-2">
              <BatalkanAntrianDialog
                antrianId={antrian.id}
                onBatalkanSuccess={handleBatalkanSuccess}
              />
            </div>
          )}

          {/* Back to dashboard */}
          <button
            type="button"
            onClick={() => navigate('/citizen/dashboard')}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold"
          >
            Kembali ke Beranda
          </button>
        </div>
      )}

      {/* Not found */}
      {!isLoading && !antrian && (
        <p className="text-center text-sm text-gray-500 mt-12">
          Antrian tidak ditemukan.
        </p>
      )}
    </div>
  )
}
