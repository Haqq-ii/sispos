import { useState } from 'react'
import { CalendarOff } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BuatJadwalDialog } from '@/components/jadwal/BuatJadwalDialog'
import { JadwalCard } from '@/components/jadwal/JadwalCard'
import { JadwalTable } from '@/components/jadwal/JadwalTable'
import { useJadwalList } from '@/hooks/useJadwalList'
import apiClient from '@/lib/axios'

// ── Type for posyandu dropdown options (from GET /api/posyandu) ───────────────
interface PosyanduOption {
  id: string
  namaPosyandu: string
}

// ── Page Component ────────────────────────────────────────────────────────────
/**
 * ManajemenJadwalPage — Screen 5 (Manajemen Jadwal Puskesmas)
 * Route: /puskesmas/jadwal (wired in Plan 02-07 per D-07)
 * Figma frame: 5:15526
 */
export default function ManajemenJadwalPage() {
  const [dialogOpen, setDialogOpen] = useState(false)

  // ── Jadwal list query ──────────────────────────────────────────────────────
  const { data: jadwals = [], isLoading: isJadwalLoading } = useJadwalList()

  // ── Posyandu list query (for BuatJadwalDialog dropdown, D-08) ─────────────
  const { data: posyanduList = [] } = useQuery<PosyanduOption[]>({
    queryKey: ['posyandu', 'list'],
    queryFn: () =>
      apiClient.get('/posyandu').then((r) => r.data.data as PosyanduOption[]),
    staleTime: 30_000,
  })

  const hasJadwal = jadwals.length > 0

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-[900px]">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Manajemen Jadwal</h1>
            <p className="text-sm text-gray-500">Atur jadwal pelayanan Posyandu</p>
          </div>
          {/* Primary action — top-right on desktop, full-width on mobile */}
          <Button
            onClick={() => setDialogOpen(true)}
            className="min-h-[44px] sm:w-auto w-full"
          >
            Buat Jadwal Baru
          </Button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {isJadwalLoading ? (
          /* Loading state — 3 skeleton blocks */
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : !hasJadwal ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarOff className="mb-4 text-gray-300" size={48} />
            <h2 className="text-xl font-bold text-gray-400 mb-1">
              Belum ada jadwal Posyandu
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Buat jadwal pertama untuk memulai pelayanan.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="min-h-[44px]">
              Buat Jadwal Baru
            </Button>
          </div>
        ) : (
          /* Responsive layout: card list (mobile) | table (desktop sm:) */
          <>
            {/* Mobile — card list (block on mobile, hidden on sm+) */}
            <div className="block sm:hidden space-y-3">
              {jadwals.map((jadwal) => (
                <JadwalCard key={jadwal.id} jadwal={jadwal} />
              ))}
            </div>

            {/* Desktop — table (hidden on mobile, block on sm+) */}
            <div className="hidden sm:block">
              <JadwalTable jadwals={jadwals} isLoading={isJadwalLoading} />
            </div>
          </>
        )}
      </div>

      {/* ── Buat Jadwal Dialog (Screen 6) ──────────────────────────────────── */}
      <BuatJadwalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        posyanduList={posyanduList}
      />
    </div>
  )
}
