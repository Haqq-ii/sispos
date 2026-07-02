/**
 * Meja5Page — Meja 5: Selesai Pelayanan
 *
 * Features:
 *   1. Summary pelayanan: BB, TB, Z-Scores, statusGizi, tanda klinis dari Meja 2-4
 *   2. "Selesai Pelayanan" button → PATCH /api/antrian/:id/selesai
 *   3. onSuccess:
 *      - setLocked(false) + setActiveMeja(null,null) + setActivePemeriksaanId(null)
 *      - DELETE /api/kader/active-meja (clear Redis)
 *      - navigate('/kader/rekap', { state: { slotId } })
 *
 * State source: router state dari Meja4Page
 *   { antrianId, balitaId, namaBalita, pemeriksaanId }
 * slotId: from useKaderMejaStore.activeSlotId
 *
 * Security: PATCH /api/antrian/:id/selesai dilindungi authMiddleware + requireRole('kader')
 * QUEUE-05: broadcast durasiRataAktual setelah selesai (di backend, bukan di sini)
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, Loader2, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { usePemeriksaanHistory } from '@/hooks/usePemeriksaan'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────

interface SelesaiResult {
  slotId: string
  durasiRataAktual: number | null
}

// ── StatusGizi badge ───────────────────────────────────────────────────────

function StatusGiziBadge({ status }: { status: string | null }) {
  if (!status) return null

  const config: Record<string, { bg: string; text: string; label: string }> = {
    normal: { bg: 'bg-green-100', text: 'text-green-800', label: 'Normal' },
    kurang: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Gizi Kurang' },
    buruk: { bg: 'bg-red-100', text: 'text-red-800', label: 'Gizi Buruk' },
    lebih: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Gizi Lebih' },
    obesitas: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Obesitas' },
  }

  const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-700', label: status }

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  )
}

// ── Z-Score chip ───────────────────────────────────────────────────────────

function ZChip({ label, value }: { label: string; value: number | null }) {
  if (value === null)
    return (
      <div className="text-center">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-400">—</p>
      </div>
    )

  const color =
    value < -3 || value > 3
      ? 'text-red-600 font-bold'
      : value < -2 || value > 2
      ? 'text-yellow-600 font-semibold'
      : 'text-green-700'

  return (
    <div className="text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm ${color}`}>{value.toFixed(2)}</p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Meja5Page() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { activeSlotId, setActiveMeja, setActivePemeriksaanId, setLocked } = useKaderMejaStore()

  const state = location.state as {
    antrianId?: string
    balitaId?: string
    namaBalita?: string
    pemeriksaanId?: string
  } | null

  const antrianId = state?.antrianId
  const balitaId = state?.balitaId ?? null
  const namaBalita = state?.namaBalita ?? 'Balita'

  // Guard: antrianId wajib ada
  if (!antrianId) {
    navigate('/kader/dashboard', { replace: true })
    return null
  }

  // Fetch riwayat pemeriksaan untuk tampilkan summary terbaru
  const { data: riwayat, isLoading: riwayatLoading } = usePemeriksaanHistory(balitaId)

  // Latest pemeriksaan entry (last in asc-sorted list)
  const latest = riwayat && riwayat.length > 0 ? riwayat[riwayat.length - 1] : null

  // ── Selesai mutation ─────────────────────────────────────────────────────

  const selesaiMutation = useMutation<SelesaiResult, Error>({
    mutationFn: async () => {
      const response = await apiClient.patch(`/antrian/${antrianId}/selesai`)
      return (response.data as { data: SelesaiResult }).data
    },
    onSuccess: async () => {
      // Clear Redis active-meja
      try {
        await apiClient.delete('/kader/active-meja')
      } catch {
        // Non-critical — Redis clear failure doesn't block flow
      }

      // Clear Zustand store
      setLocked(false)
      setActiveMeja(null, null)
      setActivePemeriksaanId(null)

      toast({ description: 'Pelayanan selesai! Silakan unduh rekap harian.' })

      // Navigate to rekap harian with slotId for download links
      navigate('/kader/rekap', {
        state: { slotId: activeSlotId },
      })
    },
    onError: () => {
      toast({
        description: 'Gagal menyelesaikan pelayanan. Coba lagi.',
        variant: 'destructive',
      })
    },
  })

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleKeluar() {
    navigate('/kader/dashboard', { replace: true })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-base font-bold text-gray-900">Meja 5 — Selesai Pelayanan</h1>
          <p className="text-xs text-gray-500">{namaBalita}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleKeluar} className="text-red-600">
          <LogOut className="h-4 w-4 mr-1" />
          Keluar Meja
        </Button>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-6">

        {/* ── Ringkasan Pelayanan ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Ringkasan Pelayanan Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riwayatLoading ? (
              <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memuat data...
              </div>
            ) : latest ? (
              <div className="space-y-4">
                {/* BB + TB */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-emerald-600 font-medium">Berat Badan</p>
                    <p className="text-xl font-bold text-emerald-800">
                      {latest.beratBadan !== null ? `${latest.beratBadan} kg` : '—'}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-600 font-medium">Tinggi Badan</p>
                    <p className="text-xl font-bold text-blue-800">
                      {latest.tinggiBadan !== null ? `${latest.tinggiBadan} cm` : '—'}
                    </p>
                  </div>
                </div>

                {/* Status Gizi */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">Status Gizi:</p>
                  <StatusGiziBadge
                    status={latest.statusGiziOverride ?? latest.statusGizi}
                  />
                </div>

                {/* Z-Scores */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">Z-Scores:</p>
                  <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3">
                    <ZChip label="BB/U" value={latest.zScoreBbU} />
                    <ZChip label="TB/U" value={latest.zScoreTbU} />
                    <ZChip label="BB/TB" value={latest.zScoreBbTb} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                Tidak ada data pemeriksaan untuk sesi ini.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Konfirmasi Selesai ───────────────────────────────────────── */}
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
              <h2 className="text-base font-semibold text-gray-800">Selesaikan Pelayanan</h2>
              <p className="text-xs text-gray-500">
                Klik tombol di bawah untuk menandai antrian ini selesai.
                Data antrian dan estimasi waktu tunggu akan diperbarui secara otomatis.
              </p>
            </div>

            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={() => selesaiMutation.mutate()}
              disabled={selesaiMutation.isPending}
            >
              {selesaiMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Selesai Pelayanan
                </>
              )}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
