/**
 * KaderDashboardPage — Dashboard kader: today's slot + antrian counts + Mulai Pelayanan.
 *
 * On mount: GET /api/kader/active-meja — if Redis has activeMeja set → redirect to /kader/meja/{N}.
 * This is the reload-recovery path: kader reloads browser → this page mounts → detects
 * active meja from Redis → auto-redirects. No manual state needed.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut, ClipboardList, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveMeja, useMutationSetActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TodaySlot {
  id: string
  nomorSesi: number
  labelSesi: string
  jamMulai: string
  jamSelesai: string
  kuota: number
  terisi: number
  durasiRataAktual: number | null
  totalAntrian: number
}

interface TodayJadwal {
  jadwalId: string
  tanggalPelaksanaan: string
  estimasiDurasiMenit: number
  statusJadwal: string
  slotSesi: TodaySlot[]
}

const MEJA_LABELS: Record<number, string> = {
  1: 'Pendaftaran & Kehadiran',
  2: 'Penimbangan',
  3: 'Pencatatan',
  4: 'Konseling',
  5: 'Selesai',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTanggal(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(d)
  } catch {
    return isoStr
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function KaderDashboardPage() {
  const navigate = useNavigate()
  const { clearAuth } = useAuthStore()
  const { setActiveMeja, setLocked } = useKaderMejaStore()
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [showMejaSelector, setShowMejaSelector] = useState(false)

  // T-03-03-01 mitigation: check Redis for active meja on mount
  const { data: activeMejaData, isLoading: isLoadingActiveMeja } = useActiveMeja()

  // Get today's jadwal + slots
  const { data: todayJadwal, isLoading: isLoadingJadwal } = useQuery<TodayJadwal | null>({
    queryKey: ['kader', 'today-slots'],
    queryFn: () =>
      apiClient.get('/kader/today-slots').then((r) => r.data.data as TodayJadwal | null),
    staleTime: 30_000,
  })

  const setActiveMejaMutation = useMutationSetActiveMeja()

  // Reload-recovery: if Redis has activeMeja, redirect immediately
  useEffect(() => {
    if (!isLoadingActiveMeja && activeMejaData) {
      setActiveMeja(activeMejaData.activeMeja, activeMejaData.slotId)
      setLocked(true)
      navigate(`/kader/meja/${activeMejaData.activeMeja}`, { replace: true })
    }
  }, [isLoadingActiveMeja, activeMejaData, navigate, setActiveMeja, setLocked])

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore
    }
    clearAuth()
    navigate('/login', { replace: true })
  }

  const handleMejaSelect = (mejaNumber: number) => {
    if (!selectedSlotId) return
    setActiveMejaMutation.mutate(
      { mejaNumber, slotId: selectedSlotId },
      {
        onSuccess: () => {
          setActiveMeja(mejaNumber, selectedSlotId)
          setLocked(true)
          navigate(`/kader/meja/${mejaNumber}`)
        },
      }
    )
  }

  const handleMulaiPelayanan = (slotId: string) => {
    setSelectedSlotId(slotId)
    setShowMejaSelector(true)
  }

  const isLoading = isLoadingActiveMeja || isLoadingJadwal

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="text-primary font-bold text-sm">SISPOS Kader</span>
        <span className="text-sm font-semibold">Dashboard</span>
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-gray-700"
          aria-label="Keluar"
        >
          <LogOut size={18} />
        </button>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-6">
        {/* Date */}
        <p className="text-xs text-gray-500 text-center">
          {new Intl.DateTimeFormat('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          }).format(new Date())}
        </p>

        {/* Jadwal hari ini */}
        {isLoading ? (
          <>
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : !todayJadwal ? (
          <Card>
            <CardContent className="py-8 text-center">
              <ClipboardList className="mx-auto text-gray-300 mb-3" size={36} />
              <p className="text-sm text-gray-500">Tidak ada jadwal pelayanan hari ini.</p>
              <p className="text-xs text-gray-400 mt-1">Hubungi Puskesmas untuk membuat jadwal.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">
                Jadwal: {formatTanggal(todayJadwal.tanggalPelaksanaan)}
              </p>
              <Badge variant="outline" className="mt-1 text-xs">
                {todayJadwal.statusJadwal}
              </Badge>
            </div>

            {/* Slot sesi list */}
            <div className="space-y-3">
              {todayJadwal.slotSesi.map((slot) => (
                <Card key={slot.id} className="border">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold">{slot.labelSesi}</CardTitle>
                    <p className="text-xs text-gray-500">{slot.jamMulai} – {slot.jamSelesai} WIB</p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>Terdaftar: <strong>{slot.terisi}</strong>/{slot.kuota}</span>
                      <span>Antrian aktif: <strong>{slot.totalAntrian}</strong></span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleMulaiPelayanan(slot.id)}
                      disabled={setActiveMejaMutation.isPending}
                    >
                      <Play size={14} className="mr-2" />
                      Mulai Pelayanan
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Meja selector dialog (inline) */}
        {showMejaSelector && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
            <div className="bg-white rounded-t-2xl w-full max-w-[480px] p-6 space-y-4">
              <h2 className="text-base font-bold text-center">Pilih Meja</h2>
              <p className="text-xs text-gray-500 text-center">
                Pilih meja untuk memulai pelayanan
              </p>
              <div className="grid grid-cols-1 gap-2">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <Button
                    key={n}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleMejaSelect(n)}
                    disabled={setActiveMejaMutation.isPending}
                  >
                    <span className="font-bold mr-2">Meja {n}</span>
                    <span className="text-xs text-gray-500">— {MEJA_LABELS[n]}</span>
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowMejaSelector(false)
                  setSelectedSlotId(null)
                }}
              >
                Batal
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
