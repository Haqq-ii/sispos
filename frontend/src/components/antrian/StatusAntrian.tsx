/**
 * StatusAntrian — badge status antrian dengan warna semantik.
 *
 * Menggunakan role="status" agar screen reader mengumumkan status.
 * Warna tidak digunakan sebagai satu-satunya penanda — teks juga menyampaikan state.
 */
import { Badge } from '@/components/ui/badge'

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusAntrianValue =
  | 'menunggu'
  | 'dipanggil'
  | 'sedang_dilayani'
  | 'selesai'
  | 'ditangguhkan'
  | 'tidak_hadir'
  | 'dibatalkan'

interface StatusAntrianProps {
  status: StatusAntrianValue
}

// ── Maps ───────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<StatusAntrianValue, string> = {
  menunggu: 'bg-blue-50 text-blue-600 border-blue-200',
  dipanggil: 'bg-amber-50 text-amber-600 border-amber-200',
  sedang_dilayani: 'bg-green-50 text-green-700 border-green-300',
  selesai: 'bg-green-50 text-green-600 border-green-200',
  dibatalkan: 'bg-gray-100 text-gray-500 border-gray-200',
  ditangguhkan: 'bg-gray-100 text-gray-500 border-gray-200',
  tidak_hadir: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_LABELS: Record<StatusAntrianValue, string> = {
  menunggu: 'MENUNGGU',
  dipanggil: 'DIPANGGIL',
  sedang_dilayani: 'SEDANG DILAYANI',
  selesai: 'SELESAI',
  dibatalkan: 'DIBATALKAN',
  ditangguhkan: 'DITANGGUHKAN',
  tidak_hadir: 'TIDAK HADIR',
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StatusAntrian({ status }: StatusAntrianProps) {
  return (
    <div className="flex items-center gap-2 justify-center">
      <span className="text-xs text-gray-500">Status:</span>
      <Badge
        className={STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}
        role="status"
      >
        {STATUS_LABELS[status] ?? status.toUpperCase()}
      </Badge>
    </div>
  )
}
