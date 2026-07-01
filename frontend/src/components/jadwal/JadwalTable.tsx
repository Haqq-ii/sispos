import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

// ── Component ────────────────────────────────────────────────name──────────────

interface JadwalTableProps {
  jadwals: JadwalListItem[]
  isLoading: boolean
}

export function JadwalTable({ jadwals, isLoading }: JadwalTableProps) {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Posyandu</TableHead>
            <TableHead>Sesi</TableHead>
            <TableHead>Kuota</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? /* Loading skeleton rows */
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                </TableRow>
              ))
            : /* Data rows */
              jadwals.map((jadwal) => {
                const kuota = jadwal.slotSesi?.[0]?.kuota ?? '-'
                const statusClass =
                  STATUS_COLOR_MAP[jadwal.statusJadwal] ??
                  'bg-gray-100 text-gray-500 border-gray-200'
                const statusLabel =
                  STATUS_LABEL[jadwal.statusJadwal] ??
                  jadwal.statusJadwal.toUpperCase()

                return (
                  <TableRow key={jadwal.id}>
                    <TableCell className="text-sm">
                      {formatDDMMYYYY(jadwal.tanggalPelaksanaan)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {jadwal.posyandu.namaPosyandu}
                    </TableCell>
                    <TableCell className="text-sm">3 sesi</TableCell>
                    <TableCell className="text-sm">{kuota}/sesi</TableCell>
                    <TableCell>
                      <Badge className={statusClass}>{statusLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        Lihat Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
        </TableBody>
      </Table>
    </div>
  )
}
