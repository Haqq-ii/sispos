import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, UserPlus, Loader2, Search, X } from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import { useKaderSocket } from '@/hooks/useKaderSocket'
import { useMutationClearActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import apiClient from '@/lib/axios'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import { generateTempId } from '@/lib/offline-db'
import { TukarMejaModal } from '@/components/kader/TukarMejaModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SearchBalitaResult {
  balitaId: string
  namaBalita: string
  nikBalita: string | null
  wargaId: string
  namaWarga: string
  nomorPonsel: string
}

type StatusAntrianValue =
  | 'menunggu'
  | 'dipanggil'
  | 'selesai'
  | 'ditangguhkan'
  | 'tidak_hadir'
  | 'dibatalkan'

interface AntrianItem {
  id: string
  nomorUrut: number
  statusAntrian: StatusAntrianValue
  balitaId: string
  balita: { namaBalita: string; jenisKelamin: string; tanggalLahir: string }
  warga: { rt: string | null }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ageInMonths(tanggalLahir: string): number {
  const birth = new Date(tanggalLahir)
  const now = new Date()
  return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.4375))
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
    'data' in (error as { response: Record<string, unknown> }).response
  )
}

// ── Guard wrapper ──────────────────────────────────────────────────────────────

export default function Meja1Page() {
  const navigate = useNavigate()
  const { activeSlotId, reset: resetStore } = useKaderMejaStore()
  const clearActiveMejaMutation = useMutationClearActiveMeja()

  useEffect(() => {
    if (!activeSlotId) navigate('/kader/dashboard', { replace: true })
  }, [activeSlotId, navigate])

  if (!activeSlotId) return null

  return (
    <Meja1Content
      activeSlotId={activeSlotId}
      clearActiveMejaMutation={clearActiveMejaMutation}
      resetStore={resetStore}
    />
  )
}

// ── Inner component (after guard) ──────────────────────────────────────────────

interface Meja1ContentProps {
  activeSlotId: string
  clearActiveMejaMutation: ReturnType<typeof useMutationClearActiveMeja>
  resetStore: () => void
}

function Meja1Content({ activeSlotId, clearActiveMejaMutation, resetStore }: Meja1ContentProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isOnline = useOfflineStatus()
  const { enqueueOperation } = useOfflineSync()

  const [showTukarMeja, setShowTukarMeja] = useState(false)
  const [selectedRt, setSelectedRt] = useState<string>('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [showGoShow, setShowGoShow] = useState(false)
  const [goShowBalitaId, setGoShowBalitaId] = useState('')
  const [goShowWargaId, setGoShowWargaId] = useState('')
  const [goShowQuery, setGoShowQuery] = useState('')
  const [goShowSelected, setGoShowSelected] = useState<SearchBalitaResult | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Realtime
  useKaderSocket(activeSlotId)

  // Search balita untuk go-show
  const { data: searchResults = [], isFetching: isSearching } = useQuery<SearchBalitaResult[]>({
    queryKey: ['kader', 'search-balita', goShowQuery],
    queryFn: () =>
      apiClient
        .get('/kader/search-balita', { params: { q: goShowQuery } })
        .then((r) => r.data.data as SearchBalitaResult[]),
    enabled: goShowQuery.length >= 2,
    staleTime: 10_000,
  })

  // Antrian list
  const { data: antrianList = [], isLoading } = useQuery<AntrianItem[]>({
    queryKey: ['antrian', 'kader', activeSlotId],
    queryFn: () =>
      apiClient
        .get(`/kader/slot/${activeSlotId}/antrian`)
        .then((r) => r.data.data as AntrianItem[]),
    enabled: !!activeSlotId,
  })

  // Mutations
  const hadirMutation = useMutation({
    mutationFn: (payload: { antrianId: string; balitaId: string; namaBalita: string }) =>
      apiClient.patch(`/antrian/${payload.antrianId}/hadir`).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', activeSlotId] })
      toast({ description: 'Kehadiran berhasil dicatat.' })
    },
    onError: (error) => {
      const msg = isAxiosLikeError(error) ? error.response.data.message : 'Terjadi kesalahan.'
      toast({ description: msg, variant: 'destructive' })
    },
  })

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

  const goShowMutation = useMutation({
    mutationFn: (body: { slotId: string; balitaId: string; wargaId: string }) =>
      apiClient.post('/kader/go-show', body).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', activeSlotId] })
      toast({ description: 'Antrian go-show berhasil dibuat.' })
      resetGoShow()
    },
    onError: (error) => {
      const msg = isAxiosLikeError(error) ? error.response.data.message : 'Terjadi kesalahan.'
      toast({ description: msg, variant: 'destructive' })
    },
  })

  async function handleHadir(payload: { antrianId: string; balitaId: string; namaBalita: string }) {
    if (!isOnline) {
      try {
        await enqueueOperation('kehadiran', {
          id: generateTempId(),
          antrianId: payload.antrianId,
          action: 'hadir' as const,
          slotId: activeSlotId,
          balitaId: payload.balitaId,
          namaBalita: payload.namaBalita,
          timestamp: Date.now(),
        })
        toast({ description: 'Tersimpan lokal, akan sync saat online' })
      } catch {
        // WR-03: enqueue failed — IDB unavailable or quota exceeded; warn kader
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }
    hadirMutation.mutate(payload)
  }

  async function handleTangguhkan(antrianId: string) {
    if (!isOnline) {
      try {
        await enqueueOperation('kehadiran', {
          id: generateTempId(),
          antrianId,
          action: 'tangguhkan' as const,
          slotId: activeSlotId,
          timestamp: Date.now(),
        })
        toast({ description: 'Tersimpan lokal, akan sync saat online' })
      } catch {
        // WR-03: enqueue failed — warn kader
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }
    tangguhkanMutation.mutate(antrianId)
  }

  function resetGoShow() {
    setGoShowBalitaId('')
    setGoShowWargaId('')
    setGoShowQuery('')
    setGoShowSelected(null)
    setShowDropdown(false)
    setShowGoShow(false)
  }

  function selectBalita(item: SearchBalitaResult) {
    setGoShowSelected(item)
    setGoShowBalitaId(item.balitaId)
    setGoShowWargaId(item.wargaId)
    setGoShowQuery('')
    setShowDropdown(false)
  }

  const handleKeluarMeja = () => {
    clearActiveMejaMutation.mutate()
    resetStore()
    navigate('/kader/dashboard', { replace: true })
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const hadirCount = antrianList.filter(
    (a) => a.statusAntrian === 'selesai' || a.statusAntrian === 'dipanggil',
  ).length
  const belumCount = antrianList.filter(
    (a) => a.statusAntrian === 'menunggu' || a.statusAntrian === 'ditangguhkan',
  ).length
  const total = antrianList.length
  const progressPct = total > 0 ? Math.round((hadirCount / total) * 100) : 0

  // RT list for filter chips
  const rtList = ['Semua', ...Array.from(new Set(antrianList.map((a) => a.warga.rt ?? 'Tidak Diketahui'))).sort()]

  // Filtered list
  const filtered = antrianList.filter((a) => {
    const rtMatch = selectedRt === 'Semua' || (a.warga.rt ?? 'Tidak Diketahui') === selectedRt
    const searchMatch =
      !searchQuery ||
      a.balita.namaBalita.toLowerCase().includes(searchQuery.toLowerCase())
    return rtMatch && searchMatch
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-white" />
            <div>
              <p className="text-white font-bold text-sm">MEJA 1 — Pendaftaran</p>
              <p className="text-[#b9f8cf] text-xs">Mode Pelayanan Aktif · Layar Terkunci</p>
            </div>
          </div>
          <button
            onClick={() => setShowTukarMeja(true)}
            className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium"
          >
            Tukar Meja
          </button>
        </div>

        {/* Stat badges */}
        <div className="flex gap-2 mb-3">
          <span className="bg-[rgba(5,223,114,0.3)] rounded-full px-3 py-1 text-[#dcfce7] text-xs font-semibold">
            Hadir {hadirCount}
          </span>
          <span className="bg-[rgba(5,223,114,0.2)] rounded-full px-3 py-1 text-[#b9f8cf] text-xs font-semibold">
            Belum {belumCount}
          </span>
          <span className="bg-[rgba(255,255,255,0.2)] rounded-full px-3 py-1 text-white text-xs font-semibold">
            Total {total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-[8px] bg-[#016630] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#05df72] rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[#b9f8cf] text-xs text-right">
            {hadirCount}/{total} balita sudah hadir
          </p>
        </div>
        <SyncPendingBadge />
      </div>

      {/* ── Filter chips ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-none">
        {rtList.map((rt) => (
          <button
            key={rt}
            onClick={() => setSelectedRt(rt)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedRt === rt
                ? 'bg-[#008236] text-white border border-[#008236]'
                : 'bg-white text-gray-600 border border-[#e5e7eb]'
            }`}
          >
            {rt === 'Semua' ? 'Semua' : `RT ${rt}`}
          </button>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="bg-white px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M10.5 10.5L13 13" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama balita..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* ── Antrian list ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">
            {antrianList.length === 0 ? 'Belum ada antrian di sesi ini.' : 'Tidak ada hasil pencarian.'}
          </div>
        ) : (
          filtered.map((antrian) => {
            const status = antrian.statusAntrian
            const isHadir = status === 'selesai' || status === 'dipanggil'
            const isTangguhkan = status === 'ditangguhkan'
            const isMenunggu = status === 'menunggu'
            const isTidakHadir = status === 'tidak_hadir' || status === 'dibatalkan'
            const usia = ageInMonths(antrian.balita.tanggalLahir)

            let borderClass = 'border-[#dcfce7]'
            if (isHadir) borderClass = 'border-[#b9f8cf]'
            if (isTangguhkan) borderClass = 'border-[#fed7aa]'
            if (isTidakHadir) borderClass = 'border-[#e5e7eb] opacity-60'

            return (
              <div
                key={antrian.id}
                className={`bg-white rounded-[14px] border ${borderClass} px-4 py-3 flex items-center gap-3`}
              >
                {/* Number */}
                <span className="text-[#99a1af] text-sm font-semibold w-6 flex-shrink-0">
                  {String(antrian.nomorUrut).padStart(2, '0')}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[#1e2939] font-bold text-sm truncate">
                    {antrian.balita.namaBalita}
                  </p>
                  <p className="text-[#99a1af] text-xs">
                    {usia} bln · RT {antrian.warga.rt ?? '—'}
                  </p>
                </div>

                {/* Action */}
                {isHadir && (
                  <span className="bg-[#dcfce7] text-[#008236] text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">
                    Hadir ✓
                  </span>
                )}
                {/* menunggu: Hadir + Tangguhkan */}
                {isMenunggu && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() =>
                        handleHadir({
                          antrianId: antrian.id,
                          balitaId: antrian.balitaId,
                          namaBalita: antrian.balita.namaBalita,
                        })
                      }
                      disabled={hadirMutation.isPending}
                      className="bg-[#f0fdf4] border border-[#b9f8cf] text-[#008236] text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50 active:bg-[#dcfce7]"
                    >
                      {hadirMutation.isPending && hadirMutation.variables?.antrianId === antrian.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        'Hadir'
                      )}
                    </button>
                    <button
                      onClick={() => handleTangguhkan(antrian.id)}
                      disabled={tangguhkanMutation.isPending}
                      className="bg-[#fff7ed] border border-[#fed7aa] text-[#ea580c] text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50 active:bg-[#ffedd5]"
                    >
                      {tangguhkanMutation.isPending && tangguhkanMutation.variables === antrian.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        'Tangguhkan'
                      )}
                    </button>
                  </div>
                )}
                {/* ditangguhkan: hanya Hadir (bisa dipanggil lagi), badge Ditangguhkan */}
                {isTangguhkan && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="bg-[#fff7ed] text-[#ea580c] text-xs font-semibold px-2 py-0.5 rounded-full">
                      Ditunda
                    </span>
                    <button
                      onClick={() =>
                        handleHadir({
                          antrianId: antrian.id,
                          balitaId: antrian.balitaId,
                          namaBalita: antrian.balita.namaBalita,
                        })
                      }
                      disabled={hadirMutation.isPending}
                      className="bg-[#f0fdf4] border border-[#b9f8cf] text-[#008236] text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50 active:bg-[#dcfce7]"
                    >
                      {hadirMutation.isPending && hadirMutation.variables?.antrianId === antrian.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        'Hadir'
                      )}
                    </button>
                  </div>
                )}
                {isTidakHadir && (
                  <span className="bg-[#f3f4f6] text-[#6a7282] text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0">
                    Tidak Hadir
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 space-y-2">
        {/* Go-show form (collapsible) */}
        {showGoShow && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 mb-2">
            <p className="text-sm font-semibold text-gray-700">Daftar Manual (Go-Show)</p>

            {/* Selected balita chip */}
            {goShowSelected ? (
              <div className="bg-white border border-[#b9f8cf] rounded-xl px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">{goShowSelected.namaBalita}</p>
                  <p className="text-xs text-gray-500">{goShowSelected.namaWarga} · {goShowSelected.nomorPonsel}</p>
                </div>
                <button
                  onClick={() => { setGoShowSelected(null); setGoShowBalitaId(''); setGoShowWargaId('') }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              /* Search input */
              <div ref={searchRef} className="relative">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Cari nama anak, NIK, nama ibu, atau HP..."
                    value={goShowQuery}
                    onChange={(e) => { setGoShowQuery(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
                  />
                  {isSearching && <Loader2 size={12} className="animate-spin text-gray-400 flex-shrink-0" />}
                </div>

                {showDropdown && goShowQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    {searchResults.length === 0 && !isSearching ? (
                      <p className="text-xs text-gray-400 px-3 py-3 text-center">Tidak ada hasil</p>
                    ) : (
                      searchResults.map((item) => (
                        <button
                          key={item.balitaId}
                          type="button"
                          onClick={() => selectBalita(item)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-semibold text-gray-800">{item.namaBalita}</p>
                          <p className="text-xs text-gray-400">
                            {item.namaWarga} · {item.nomorPonsel}
                            {item.nikBalita ? ` · NIK ${item.nikBalita}` : ''}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={resetGoShow}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-semibold text-gray-500"
              >
                Batal
              </button>
              <button
                disabled={goShowMutation.isPending || !goShowBalitaId || !goShowWargaId}
                onClick={() =>
                  goShowMutation.mutate({
                    slotId: activeSlotId,
                    balitaId: goShowBalitaId,
                    wargaId: goShowWargaId,
                  })
                }
                className="flex-1 bg-[#008236] rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {goShowMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Daftarkan
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setShowGoShow(!showGoShow)}
            className="flex-1 border border-[#05df72] text-[#008236] rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <UserPlus size={15} />
            Daftar Manual
          </button>
          <button
            onClick={handleKeluarMeja}
            disabled={clearActiveMejaMutation.isPending}
            className="flex-1 bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {clearActiveMejaMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            Selesai Meja 1
          </button>
        </div>
      </div>
      <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId} />
    </div>
  )
}
