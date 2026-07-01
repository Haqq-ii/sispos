import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CountdownInput {
  nomorUrut: number
  nomorAktif: number
  estimasiDurasiMenit: number
  durasiRataAktual: number | null
}

// ── Pure function ──────────────────────────────────────────────────────────────

/**
 * computeCountdown — pure function, dapat ditest secara independen.
 *
 * Formula (D-03): (nomorUrut - nomorAktif) × (durasiRataAktual ?? estimasiDurasiMenit)
 *
 * Di Phase 2, nomorAktif selalu 0 (Meja 1 hadir belum diimplementasi).
 * durasiRataAktual juga null (Meja 5 belum ada); Phase 3 akan mengisinya.
 *
 * Tidak pernah mengembalikan nilai negatif — menggunakan Math.max(0, ...).
 */
export function computeCountdown({
  nomorUrut,
  nomorAktif,
  estimasiDurasiMenit,
  durasiRataAktual,
}: CountdownInput): number {
  const durasi = durasiRataAktual ?? estimasiDurasiMenit
  return Math.max(0, (nomorUrut - nomorAktif) * durasi)
}

// ── React hook ─────────────────────────────────────────────────────────────────

/**
 * useCountdownEstimasi — React hook untuk menampilkan estimasi waktu tunggu.
 *
 * Prefix "±" adalah WAJIB per CLAUDE.md dan QUEUE-03 — countdown adalah estimasi, bukan janji.
 *
 * @param nomorUrut - Nomor antrian citizen, atau null jika belum ada antrian
 * @param estimasiDurasiMenit - Durasi default dari Jadwal (dari backend)
 * @param durasiRataAktual - Moving average aktual (null di Phase 2, diisi Phase 3)
 */
export function useCountdownEstimasi(
  nomorUrut: number | null,
  estimasiDurasiMenit: number,
  durasiRataAktual: number | null
): { minutesLeft: number; displayText: string } {
  const [minutesLeft, setMinutesLeft] = useState<number>(0)

  useEffect(() => {
    const result = computeCountdown({
      nomorUrut: nomorUrut ?? 0,
      nomorAktif: 0, // Phase 2: Meja 1 hadir belum diimplementasi
      estimasiDurasiMenit,
      durasiRataAktual,
    })
    setMinutesLeft(result)
  }, [nomorUrut, estimasiDurasiMenit, durasiRataAktual])

  const displayText = '±' + Math.round(minutesLeft) + ' menit'

  return { minutesLeft, displayText }
}
