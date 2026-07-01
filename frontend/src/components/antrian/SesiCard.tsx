import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ── Props ──────────────────────────────────────────────────────────

/** Data minimal yang diperlukan SesiCard — sesuai dengan SlotSesiDetail */
export interface SesiCardItem {
  id: string
  nomorSesi: number
  labelSesi: string
  jamMulai: string  // format 'HH:MM'
  jamSelesai: string  // format 'HH:MM'
  kuota: number
  terisi: number
}

export interface SesiCardProps {
  sesi: SesiCardItem
  /** Dipanggil ketika citizen klik "Pilih Sesi" — hanya pada sesi tersedia */
  onPilih: (sesiId: string) => void
  /** True saat mutation sedang berjalan (opsional, untuk spinner masa depan) */
  isLoading?: boolean
}

// ── Component ─────────────────────────────────────────────────────

export function SesiCard({ sesi, onPilih, isLoading = false }: SesiCardProps) {
  const { id, nomorSesi, jamMulai, jamSelesai, kuota, terisi } = sesi

  const isAvailable = terisi < kuota
  const progressValue = kuota > 0 ? (terisi / kuota) * 100 : 0
  const sisaKuota = kuota - terisi

  return (
    <Card
      className={cn(
        'p-4 w-full',
        !isAvailable && 'opacity-80',
      )}
    >
      {/* ── Header: ikon clock + label sesi + jam ─────────────── */}
      <div className="flex items-start gap-2 mb-3">
        <Clock
          size={16}
          className={cn(
            'mt-0.5 flex-shrink-0',
            isAvailable ? 'text-gray-500' : 'text-gray-300',
          )}
        />
        <div className="flex-1">
          <p
            className={cn(
              'text-sm font-bold',
              !isAvailable && 'text-gray-400',
            )}
          >
            Sesi {nomorSesi}
          </p>
          <p
            className={cn(
              'text-xl font-bold',
              !isAvailable && 'text-gray-400',
            )}
          >
            {jamMulai} – {jamSelesai} WIB
          </p>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────── */}
      <hr className="border-t border-border mb-3" />

      {/* ── Info kuota + progress bar ─────────────────────────── */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          {isAvailable ? (
            <span className="text-xs text-gray-500">
              {sisaKuota} dari {kuota} tersedia
            </span>
          ) : (
            <>
              <Badge variant="destructive" className="text-xs">
                PENUH
              </Badge>
              <span className="text-xs text-gray-400">
                {kuota}/{kuota} kuota terisi
              </span>
            </>
          )}
        </div>
        <Progress
          value={progressValue}
          className="h-1.5"
          aria-label={`Kuota terisi ${terisi} dari ${kuota}`}
        />
      </div>

      {/* ── CTA button ────────────────────────────────────────── */}
      {isAvailable ? (
        <Button
          type="button"
          variant="default"
          className="w-full min-h-[44px]"
          onClick={() => onPilih(id)}
          disabled={isLoading}
          aria-label={`Pilih Sesi ${nomorSesi} ${jamMulai} – ${jamSelesai}`}
        >
          Pilih Sesi
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-[44px]"
          disabled
          aria-disabled="true"
          aria-label={`Sesi ${nomorSesi} sudah penuh`}
        >
          PENUH
        </Button>
      )}
    </Card>
  )
}
