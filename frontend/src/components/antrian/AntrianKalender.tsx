import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// ── Props ──────────────────────────────────────────────────────────

export interface AntrianKalenderProps {
  /** Array tanggal 'YYYY-MM-DD' yang punya jadwal aktif */
  availableDates: string[]
  /** Tanggal terpilih dalam format 'YYYY-MM-DD', atau null */
  selectedDate: string | null
  /** Dipanggil ketika citizen klik tanggal yang tersedia */
  onDateSelect: (date: string) => void
  /** True saat data jadwal sedang dimuat */
  isLoading: boolean
  /** Bulan yang sedang ditampilkan */
  currentMonth: Date
  /** Dipanggil saat citizen klik panah prev/next bulan */
  onMonthChange: (direction: 'prev' | 'next') => void
}

// ── Constants ─────────────────────────────────────────────────────

const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

// ── Helpers ───────────────────────────────────────────────────────

/** Format Date ke 'YYYY-MM-DD' menggunakan kalender lokal (menghindari UTC shift) */
function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Generate array Date | null untuk grid kalender.
 * Grid selalu dimulai dari Minggu (offset = firstDay.getDay()).
 * Null = sel kosong sebelum hari 1 atau padding baris terakhir.
 */
function generateCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay.getDay() // 0 = Minggu

  const days: (Date | null)[] = []

  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)

  return days
}

// ── Component ─────────────────────────────────────────────────────

export function AntrianKalender({
  availableDates,
  selectedDate,
  onDateSelect,
  isLoading,
  currentMonth,
  onMonthChange,
}: AntrianKalenderProps) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // Label bulan dalam Bahasa Indonesia, kapital huruf pertama
  const rawLabel = currentMonth.toLocaleString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
  const monthDisplay = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)

  // Hari ini tengah malam untuk perbandingan tanggal lampau
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const todayStr = toDateStr(todayMidnight)

  const availableSet = new Set(availableDates)
  const days = generateCalendarDays(year, month)

  return (
    <div>
      {/* ── Navigasi bulan ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => onMonthChange('prev')}
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft size={20} />
        </Button>

        <span className="text-xl font-bold">{monthDisplay}</span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => onMonthChange('next')}
          aria-label="Bulan berikutnya"
        >
          <ChevronRight size={20} />
        </Button>
      </div>

      {/* ── Label hari ─────────────────────────────────────────── */}
      <div className="grid grid-cols-7 mb-1" role="row">
        {HARI_SINGKAT.map((hari) => (
          <div
            key={hari}
            role="columnheader"
            aria-label={hari}
            className="text-center text-xs text-gray-400 py-1 select-none"
          >
            {hari}
          </div>
        ))}
      </div>

      {/* ── Grid kalender atau skeleton loading ────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="flex items-center justify-center py-1">
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-7 gap-y-1"
          role="grid"
          aria-label={`Kalender ${monthDisplay}`}
        >
          {days.map((date, idx) => {
            // Sel kosong (padding)
            if (!date) {
              return (
                <div
                  key={`blank-${idx}`}
                  role="gridcell"
                  aria-hidden="true"
                />
              )
            }

            const dateStr = toDateStr(date)
            const isToday = dateStr === todayStr
            const isPast = date < todayMidnight
            const isAvailable = availableSet.has(dateStr)
            const isSelected = selectedDate === dateStr
            const isClickable = !isPast && isAvailable

            return (
              <div
                key={dateStr}
                role="gridcell"
                aria-selected={isSelected}
                aria-disabled={!isClickable}
                className="flex items-center justify-center py-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isClickable) onDateSelect(dateStr)
                  }}
                  disabled={!isClickable}
                  aria-label={`${date.getDate()} ${monthDisplay}${isSelected ? ', terpilih' : ''}${isAvailable ? ', tersedia' : ''}${isPast ? ', lampau' : ''}`}
                  className={cn(
                    // Base — sel 40×40 flex-col agar angka dan titik bisa stack
                    'flex flex-col items-center justify-center w-10 h-10 rounded-full transition-colors select-none',
                    // Terpilih
                    isSelected && 'bg-primary text-white',
                    // Tersedia (tidak terpilih, tidak lampau)
                    !isSelected && isAvailable && !isPast && [
                      'text-foreground hover:bg-green-50 cursor-pointer',
                      isToday && 'ring-1 ring-primary',
                    ],
                    // Tanggal lampau
                    isPast && 'text-gray-200 cursor-not-allowed',
                    // Tidak tersedia (bukan lampau, tidak ada jadwal)
                    !isPast && !isAvailable && [
                      'text-gray-300 cursor-not-allowed',
                      isToday && 'ring-1 ring-primary',
                    ],
                  )}
                >
                  <span className="text-sm leading-none">{date.getDate()}</span>
                  {/* Titik hijau — hanya pada tanggal tersedia yang belum dipilih */}
                  {isAvailable && !isSelected && (
                    <span className="w-1 h-1 bg-primary rounded-full mt-0.5" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
