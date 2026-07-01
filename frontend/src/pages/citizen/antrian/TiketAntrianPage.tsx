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
 * - WA notice: "Notifikasi akan dikirim ke WhatsApp Anda" (QUEUE-06 UX)
 */
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
    // ISO datetime: "1970-01-01T08:00:00.000Z" → "08:00"
    return timeStr.substring(11, 16)
  }
  // Already "HH:MM" or "HH:MM:SS"
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
  const posyanduAlamat = posyandu
    ? [posyandu.kelurahan, posyandu.kecamatan].filter(Boolean).join(', ')
    : ''

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
    <div className="min-h-screen bg-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="text-primary font-bold text-sm">SISPOS</span>
        <span className="text-sm font-bold">Tiket Antrian</span>
        <div className="w-16" /> {/* Spacer untuk centering */}
      </div>

      {/* Body */}
      <div className="max-w-[400px] mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          /* Loading state */
          <>
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-8 rounded" />
            <Skeleton className="h-6 rounded" />
            <Skeleton className="h-11 rounded-lg" />
          </>
        ) : antrian ? (
          <>
            {/* Socket disconnect alert */}
            {slotId && socketStatus === 'disconnected' && (
              <Alert>
                <AlertDescription>
                  Koneksi terputus. Memuat ulang data...
                </AlertDescription>
              </Alert>
            )}

            {/* Section 1 — Posyandu + tanggal + sesi (text-center) */}
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{posyanduNama}</p>
              {posyanduAlamat && (
                <p className="text-xs text-gray-500">{posyanduAlamat}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {tanggalDisplay}
                {sesiDisplay && <> &middot; {sesiDisplay}</>}
              </p>
            </div>

            {/* Section 2 — Nomor antrian (text-center, bg-green-50, rounded-xl) */}
            <div className="text-center py-6 bg-green-50 rounded-xl">
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                NOMOR ANTRIAN ANDA
              </p>
              <p
                className="text-5xl font-bold leading-none text-foreground mt-2"
                aria-label={`Nomor antrian Anda: ${nomorPadded}`}
              >
                {nomorPadded}
              </p>
            </div>

            {/* Section 3 — Countdown / Status visual */}
            {statusAntrian === 'menunggu' && (
              <CountdownEstimasi
                nomorUrut={antrian.nomorUrut}
                estimasiDurasiMenit={estimasiDurasiMenit}
                durasiRataAktual={durasiRataAktual}
                nomorAktif={nomorAktif}
              />
            )}

            {statusAntrian === 'dipanggil' && (
              <div className="border rounded-lg p-4 text-center bg-amber-50">
                <Badge className="bg-amber-50 text-amber-600 border-amber-200 animate-pulse text-sm">
                  Silakan menuju meja pelayanan!
                </Badge>
              </div>
            )}

            {(statusAntrian === 'selesai') && (
              <div className="border rounded-lg p-4 text-center bg-green-50">
                <CheckCircle className="mx-auto text-green-600 mb-2" size={32} />
                <p className="text-sm font-bold text-green-700">
                  Pelayanan selesai. Terima kasih!
                </p>
              </div>
            )}

            {/* Section 4 — Status badge */}
            <StatusAntrian status={statusAntrian} />

            {/* Section 5 — WhatsApp notice (QUEUE-06 UX) */}
            <div className="flex items-center justify-center gap-2">
              <MessageSquare size={14} className="text-green-600 flex-shrink-0" />
              <p className="text-xs text-gray-500">
                Notifikasi akan dikirim ke WhatsApp Anda
              </p>
            </div>

            {/* Section 6 — Batalkan (hanya saat menunggu — D-06) */}
            {statusAntrian === 'menunggu' && (
              <BatalkanAntrianDialog
                antrianId={antrian.id}
                onBatalkanSuccess={handleBatalkanSuccess}
              />
            )}

            {/* Section 7 — Kembali ke Dashboard */}
            <Button
              type="button"
              variant="ghost"
              className="w-full min-h-[44px]"
              onClick={() => navigate('/citizen/dashboard')}
            >
              Kembali ke Dashboard
            </Button>
          </>
        ) : (
          <p className="text-center text-sm text-gray-500">
            Antrian tidak ditemukan.
          </p>
        )}
      </div>
    </div>
  )
}
