/**
 * CountdownEstimasi — widget estimasi waktu tunggu dengan aria-live.
 *
 * ATURAN WAJIB (QUEUE-03 + CLAUDE.md):
 * - Prefix "±" WAJIB pada semua angka countdown — countdown adalah estimasi, bukan janji
 * - Disclaimer baris bawah WAJIB — tidak boleh dihilangkan (02-UI-SPEC.md)
 * - aria-live="polite" agar screen reader mengumumkan update
 */
import { computeCountdown } from '@/hooks/useCountdownEstimasi'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CountdownEstimasiProps {
  nomorUrut: number
  estimasiDurasiMenit: number
  durasiRataAktual: number | null
  /** nomorAktif dari queue:update payload; 0 selama Phase 2 (Meja 1 belum ada) */
  nomorAktif: number
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * CountdownEstimasi — ditampilkan di TiketAntrianPage Section 3.
 * Update otomatis setiap kali props berubah dari Socket.IO queue:update.
 */
export function CountdownEstimasi({
  nomorUrut,
  estimasiDurasiMenit,
  durasiRataAktual,
  nomorAktif,
}: CountdownEstimasiProps) {
  const minutesLeft = computeCountdown({
    nomorUrut,
    nomorAktif,
    estimasiDurasiMenit,
    durasiRataAktual,
  })

  // Amber warning ketika estimasi < 5 menit — per 02-UI-SPEC.md Phase 2 Status Color Tokens
  const isWarning = minutesLeft < 5

  return (
    <div
      className="border rounded-lg p-4 text-center"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Label */}
      <p className="text-xs text-gray-500">Estimasi dipanggil dalam</p>

      {/* Countdown figure — prefix "±" WAJIB (QUEUE-03) */}
      <p
        className={`text-xl font-bold mt-1 ${
          isWarning ? 'text-amber-600' : 'text-foreground'
        }`}
      >
        ±{Math.round(minutesLeft)} menit
      </p>

      {/* Disclaimer — WAJIB, tidak boleh dihilangkan (02-UI-SPEC.md) */}
      <p className="text-xs text-gray-400 italic mt-2">
        Estimasi waktu tunggu. Dapat berubah sesuai kondisi pelayanan.
      </p>
    </div>
  )
}
