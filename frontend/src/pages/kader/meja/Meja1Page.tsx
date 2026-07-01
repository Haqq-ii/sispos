/**
 * Meja1Page — Meja 1: Pendaftaran & Kehadiran
 *
 * Features:
 * - Antrian list grouped by RT (client-side groupBy)
 * - Hadir button: PATCH /api/antrian/:id/hadir
 * - Tangguhkan button: PATCH /api/antrian/:id/tangguhkan
 * - Go-show form: POST /api/kader/go-show
 * - Realtime: useKaderSocket invalidates query on queue:update
 * - Keluar Meja: DELETE /api/kader/active-meja → /kader/dashboard
 *
 * T-03-03-01 mitigation: if activeSlotId is null in store → redirect to dashboard
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, UserCheck, PauseCircle, UserPlus, ChevronDown, ChevronUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useKaderSocket } from '@/hooks/useKaderSocket'
import { useMutationClearActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusAntrianValue = 'menunggu' | 'dipanggil' | 'selesai' | 'ditangguhkan' | 'tidak_hadir' | 'dibatalkan'

interface AntrianItem {
  id: string
  nomorUrut: number
  statusAntrian: StatusAntrianValue
  balita: { namaBalita: string; jenisKelamin: string; tanggalLahir: string }
  warga: { rt: string | null }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<StatusAntrianValue, string> = {
  menunggu: 'bg-blue-50 text-blue-600 border-blue-200',
  dipanggil: 'bg-amber-50 text-amber-600 border-amber-200',
  selesai: 'bg-green-50 text-green-600 border-green-200',
  ditangguhkan: 'bg-gray-100 text-gray-500 border-gray-200',
  tidak_hadir: 'bg-gray-100 text-gray-500 border-gray-200',
  dibatalkan: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_LABELS: Record<StatusAntrianValue, string> = {
  menunggu: 'Menunggu',
  dipanggil: 'Dipanggil',
  selesai: 'Selesai',
  ditangguhkan: 'Ditangguhkan',
  tidak_hadir: 'Tidak Hadir',
  dibatalkan: 'Dibatalkan',
}

function ageInMonths(tanggalLahir: string): number {
  const birth = new Date(tanggalLahir)
  const now = new Date()
  const diffMs = now.getTime() - birth.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375))
}

/** Group antrian by RT (client-side) */
function groupByRt(antrian: AntrianItem[]): Record<string, AntrianItem[]> {
  return antrian.reduce<Record<string, AntrianItem[]>>((acc, item) => {
    const rt = item.warga.rt ?? 'Tidak Diketahui'
    if (!acc[rt]) acc[rt] = []
    acc[rt].push(item)
    return acc
  }, {})
}

function isAxiosLikeError(
  error: unknown,
): error is { response: { data: { error: string; message: string } } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response: unknown }).response === 'object' &&
    (error as { response: unknown }).response !== null &&
    'data' in ((error as { response: Record<string, unknown> }).response)
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Meja1Page() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { activeSlotId, reset: resetStore } = useKaderMejaStore()
  const clearActiveMejaMutation = useMutationClearActiveMeja()

  const [showGoShow, setShowGoShow] = useState(false)
  const [goShowBalitaId, setGoShowBalitaId] = useState('')
  const [goShowWargaId, setGoShowWargaId] = useState('')

  // T-03-03-01: if no activeSlotId, redirect to dashboard
  if (!activeSlotId) {
    navigate('/kader/dashboard', { replace: true })
    return null
  }

  // Realtime: invalidate antrian list on queue:update
  useKaderSocket(activeSlotId)

  // Antrian list query
  const { data: antrianList, isLoading } = useQuery<AntrianItem[]>({
    queryKey: ['antrian', 'kader', activeSlotId],
    queryFn: () =>
      apiClient
        .get(`/kader/slot/${activeSlotId}/antrian`)
        .then((r) => r.data.data as AntrianItem[]),
    enabled: !!activeSlotId,
  })

  // Hadir mutation
  const hadirMutation = useMutation({
    mutationFn: (antrianId: string) =>
      apiClient.patch(`/antrian/${antrianId}/hadir`).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', activeSlotId] })
      toast({ description: 'Balita berhasil dipanggil.' })
    },
    onError: (error) => {
      const msg = isAxiosLikeError(error) ? error.response.data.message : 'Terjadi kesalahan.'
      toast({ description: msg, variant: 'destructive' })
    },
  })

  // Tangguhkan mutation
  const tangguhkanMutation = useMutation({
    mutationFn: (antrianId: string) =>
      apiClient.patch(`/antrian/${antrianId}/tangguhkan`).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', activeSlotId] })
      toast({ description: 'Antrian berhasil ditangguhkan.' })
    },
    onError: (error) => {
      const msg = isAxiosLikeError(error) ? error.response.data.message : 'Terjadi kesalahan.'
      toast({ description: msg, variant: 'destructive' })
    },
  })

  // Go-show mutation
  const goShowMutation = useMutation({
    mutationFn: (body: { slotId: string; balitaId: string; wargaId: string }) =>
      apiClient.post('/kader/go-show', body).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', activeSlotId] })
      toast({ description: 'Antrian go-show berhasil dibuat.' })
      setGoShowBalitaId('')
      setGoShowWargaId('')
      setShowGoShow(false)
    },
    onError: (error) => {
      const msg = isAxiosLikeError(error) ? error.response.data.message : 'Terjadi kesalahan.'
      toast({ description: msg, variant: 'destructive' })
    },
  })

  const handleKeluarMeja = () => {
    clearActiveMejaMutation.mutate(undefined, {
      onSuccess: () => {
        resetStore()
        navigate('/kader/dashboard', { replace: true })
      },
    })
  }

  const grouped = antrianList ? groupByRt(antrianList) : {}
  const totalMenunggu = antrianList?.filter((a) => a.statusAntrian === 'menunggu').length ?? 0
  const totalSelesai = antrianList?.filter((a) => a.statusAntrian === 'selesai').length ?? 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="text-primary font-bold text-sm">Meja 1 — Kehadiran</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleKeluarMeja}
          disabled={clearActiveMejaMutation.isPending}
          className="text-xs text-gray-500"
        >
          <LogOut size={14} className="mr-1" />
          Keluar Meja
        </Button>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-4 space-y-4">
        {/* Counts */}
        <div className="flex gap-4 text-sm text-gray-600">
          <span>Total: <strong>{antrianList?.length ?? 0}</strong></span>
          <span>Menunggu: <strong>{totalMenunggu}</strong></span>
          <span>Selesai: <strong>{totalSelesai}</strong></span>
        </div>

        {/* Antrian list */}
        {isLoading ? (
          <>
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </>
        ) : !antrianList || antrianList.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            Belum ada antrian di sesi ini.
          </div>
        ) : (
          Object.entries(grouped).map(([rt, items]) => (
            <div key={rt} className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                RT {rt}
              </h3>
              {items.map((antrian) => {
                const usia = ageInMonths(antrian.balita.tanggalLahir)
                const canAct = antrian.statusAntrian === 'menunggu' || antrian.statusAntrian === 'ditangguhkan'
                const canTangguhkan = antrian.statusAntrian === 'dipanggil'

                return (
                  <div
                    key={antrian.id}
                    className="border rounded-lg px-4 py-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700 w-7 shrink-0">
                          {String(antrian.nomorUrut).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{antrian.balita.namaBalita}</p>
                          <p className="text-xs text-gray-400">{usia} bln</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`${STATUS_BADGE[antrian.statusAntrian]} text-xs`}>
                        {STATUS_LABELS[antrian.statusAntrian]}
                      </Badge>
                      {canAct && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => hadirMutation.mutate(antrian.id)}
                          disabled={hadirMutation.isPending}
                        >
                          <UserCheck size={12} className="mr-1" />
                          Hadir
                        </Button>
                      )}
                      {canTangguhkan && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => tangguhkanMutation.mutate(antrian.id)}
                          disabled={tangguhkanMutation.isPending}
                        >
                          <PauseCircle size={12} className="mr-1" />
                          Tunda
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {/* Go-show section */}
        <div className="border rounded-lg overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => setShowGoShow(!showGoShow)}
          >
            <span className="flex items-center gap-2">
              <UserPlus size={14} />
              Daftar Manual (Go-Show)
            </span>
            {showGoShow ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showGoShow && (
            <div className="px-4 pb-4 space-y-3 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs">ID Balita</Label>
                <Input
                  type="text"
                  placeholder="UUID balita"
                  value={goShowBalitaId}
                  onChange={(e) => setGoShowBalitaId(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ID Warga (Orang Tua)</Label>
                <Input
                  type="text"
                  placeholder="UUID warga"
                  value={goShowWargaId}
                  onChange={(e) => setGoShowWargaId(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() =>
                  goShowMutation.mutate({
                    slotId: activeSlotId,
                    balitaId: goShowBalitaId,
                    wargaId: goShowWargaId,
                  })
                }
                disabled={
                  goShowMutation.isPending ||
                  !goShowBalitaId.trim() ||
                  !goShowWargaId.trim()
                }
              >
                Daftarkan
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
