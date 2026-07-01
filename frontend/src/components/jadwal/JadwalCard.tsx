import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { JadwalListItem } from '@/hooks/useJadwalList'

// ── Status label mapping ─────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT',
  aktif: 'AKTIF',
  terkunci: 'DIKUNCI',
  selesai: 'SELESAI',
  dibatalkan: 'DIBATALKAN',
}

// ── Status color tokens per 02-UI-SPEC.md §Phase 2 Status Color Tokens ───────
const STATUS_COLOR_MAP: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500 border-gray-200',
  aktif: 'bg-green-50 text-green-600 border-green-200',
  terkunci: 'bg-blue-50 text-blue-600 border-blue-200',
  selesai: 'bg-green-50 text-green-600 border-green-200',
  dibatalkan: 'bg-gray-100 text-gray-500 border-gray-200',
}

// ── Date formatter (DD/MM/YYYY) ──────────────────────────────────────────────
function formatDDMMYYYY(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// ── Component ────────────────────────────────────────────────────────────────

interface JadwalCardProps {
  jadwal: JadwalListItem
}

export function JadwalCard({ jadwal }: JadwalCardProps) {
  const kuota = jadwal.slotSesi?.[0]?.kuota ?? '-'
  const statusClass =
    STATUS_COLOR_MAP[jadwal.statusJadwal] ?? 'bg-gray-100 text-gray-500 border-gray-200'
  const statusLabel =
    STATUS_LABEL[jadwal.statusJadwal] ?? jadwal.statusJadwal.toUpperCase()

  return (
    <Card className="p-4">
      {/* Top row: tanggal + status badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">
          {formatDDMMYYYY(jadwal.tanggalPelaksanaan)}
        </span>
        <Badge className={statusClass}>{statusLabel}</Badge>
      </div>

      {/* Body: posyandu name + estimasi caption */}
      <div className="mb-1">
        <p className="text-sm font-bold">{jadwal.posyandu.namaPosyandu}</p>
        <p className="text-xs text-gray-500">
          Estimasi {jadwal.estimasiDurasiMenit} menit/orang
        </p>
      </div>

      {/* Slot info */}
      <p className="text-xs text-gray-500 mb-3">
        3 sesi &middot; {kuota} kuota/sesi
      </p>

      {/* Footer action — Phase 3 will wire to /puskesmas/jadwal/:id */}
      <Button variant="ghost" size="sm" className="w-full text-sm">
        Lihat Detail
      </Button>
    </Card>
  )
}
