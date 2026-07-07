/**
 * Meja4Page — Meja 4: Konsultasi + AI Early Warning + Voice (Figma Make two-step)
 *
 * Step 1: Select hadir balita from antrian list
 * Step 2: Collapsible AI Early Warning + Voice-to-Text notes + Save
 *         "Selesai Meja 4" → handleKeluarMeja (clear active meja + navigate dashboard)
 *
 * Removed: "Lanjut ke Meja 5" navigation
 * Guard: activeSlotId required (from store)
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Mic, MicOff, Loader2, Sparkles, Save, ChevronRight, ChevronDown,
} from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { usePatchPemeriksaan } from '@/hooks/usePemeriksaan'
import { useMutationClearActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import apiClient from '@/lib/axios'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import { generateTempId } from '@/lib/offline-db'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TukarMejaModal } from '@/components/kader/TukarMejaModal'

// ── Types ──────────────────────────────────────────────────────────────────

interface AntrianItem {
  id: string
  nomorUrut: number
  statusAntrian: string
  balitaId: string
  balita: { namaBalita: string }
  warga?: { namaIbu?: string }
  pemeriksaan?: Array<{ id: string; beratBadan: number | null }>
}

interface TandaKlinis {
  rambutKemerahan: boolean
  perutBuncit: boolean
  edema: boolean
  pucat: boolean
  lainnya?: string | null
}

interface EarlyWarningData {
  level: 'normal' | 'waspada' | 'kritis'
  ringkasan: string
  rekomendasi: string
}

// ── Level badge ────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: 'normal' | 'waspada' | 'kritis' }) {
  const config = {
    normal: { className: 'bg-[#dcfce7] text-[#00a63e] border border-[#b9f8cf]', label: 'NORMAL' },
    waspada: { className: 'bg-yellow-50 text-yellow-700 border border-yellow-200', label: 'WASPADA' },
    kritis: { className: 'bg-[#fef2f2] text-[#e7000b] border border-[#ffc9c9]', label: 'KRITIS' },
  }
  const { className, label } = config[level]
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${className}`}>
      {label}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Meja4Page() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    activePemeriksaanId, activeAntrianId, activeBalitaId, activeNamaBalita,
    activeSlotId, reset: resetStore,
  } = useKaderMejaStore()
  const clearActiveMejaMutation = useMutationClearActiveMeja()
  const { toast } = useToast()
  const isOnline = useOfflineStatus()
  const { enqueueOperation } = useOfflineSync()

  const state = location.state as {
    antrianId?: string
    balitaId?: string
    namaBalita?: string
    pemeriksaanId?: string
    tandaKlinis?: TandaKlinis | null
  } | null

  // Step selection state — always start at Step 1 (balita picker)
  const [selectedBalitaId, setSelectedBalitaId] = useState<string | null>(null)
  const [selectedAntrianId] = useState<string | undefined>(undefined)
  const [selectedNama, setSelectedNama] = useState('')
  const [selectedPemeriksaanId, setSelectedPemeriksaanId] = useState<string | null>(
    state?.pemeriksaanId ?? activePemeriksaanId ?? null
  )
  const tandaKlinis = state?.tandaKlinis ?? null

  const [showTukarMeja, setShowTukarMeja] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [earlyWarningData, setEarlyWarningData] = useState<EarlyWarningData | null>(null)
  const [catatanValue, setCatatanValue] = useState('')

  // Guard: require activeSlotId
  useEffect(() => {
    if (!activeSlotId) navigate('/kader/dashboard', { replace: true })
  }, [activeSlotId, navigate])

  // Voice recorder
  const { isRecording, audioBlob, secondsLeft, startRecording, stopRecording } = useVoiceRecorder()

  // Transcribe mutation
  const transcribeMutation = useMutation<string, Error, Blob>({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const response = await apiClient.post('/voice/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 15_000,
      })
      return (response.data as { data: { transcript: string } }).data.transcript
    },
    onError: () => {
      toast({ description: 'Gagal transkripsi audio. Ketik catatan secara manual.', variant: 'destructive' })
    },
  })

  useEffect(() => {
    if (audioBlob) transcribeMutation.mutate(audioBlob)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob])

  useEffect(() => {
    if (transcribeMutation.data) {
      setCatatanValue((prev) => (!prev ? transcribeMutation.data! : prev))
    }
  }, [transcribeMutation.data])

  // Early warning mutation
  const earlyWarningMutation = useMutation<EarlyWarningData, Error>({
    mutationFn: async () => {
      const response = await apiClient.post('/ai/early-warning', {
        pemeriksaanId: selectedPemeriksaanId ?? undefined,
        balitaId: selectedBalitaId ?? undefined,
        // Kirim undefined (bukan null) agar Zod .optional() tidak menolak
        tandaKlinis: tandaKlinis ?? undefined,
      })
      return (response.data as { data: EarlyWarningData }).data
    },
    onSuccess: (data) => setEarlyWarningData(data),
    onError: (err) => {
      const axiosErr = err as unknown as { response?: { data?: { message?: string; error?: string } } }
      const backendMsg = axiosErr?.response?.data?.message
      const errCode = axiosErr?.response?.data?.error
      if (errCode === 'DATA_TIDAK_LENGKAP') {
        toast({ description: backendMsg ?? 'Data timbang belum ada. Lakukan Meja 2 terlebih dahulu.', variant: 'destructive' })
      } else {
        toast({ description: backendMsg ?? 'Gagal generate AI Early Warning. Coba lagi.', variant: 'destructive' })
      }
    },
  })

  // Save catatan mutation
  const saveCatatanMutation = usePatchPemeriksaan()

  async function handleSimpanCatatan() {
    if (!catatanValue.trim()) {
      toast({ description: 'Catatan konsultasi kosong.', variant: 'destructive' })
      return
    }
    if (!selectedPemeriksaanId) {
      toast({ description: 'Pemeriksaan tidak tersedia. Lakukan timbang di Meja 2 terlebih dahulu.', variant: 'destructive' })
      return
    }

    if (!isOnline) {
      try {
        await enqueueOperation('pemeriksaan', {
          id: generateTempId(),
          tempPemeriksaanId: selectedPemeriksaanId,
          type: 'patch-catatan' as const,
          data: { catatanKonsultasi: catatanValue, rekomendasiAi: null, catatanSTT: null },
          timestamp: Date.now(),
        })
        toast({ description: 'Tersimpan lokal, akan sync saat online' })
      } catch {
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }

    saveCatatanMutation.mutate(
      { id: selectedPemeriksaanId, catatanKonsultasi: catatanValue },
      {
        onSuccess: () => {
          toast({ description: 'Catatan konsultasi berhasil disimpan.' })
          setSelectedBalitaId(null)
          setSelectedNama('')
          setCatatanValue('')
        },
        onError: () => toast({ description: 'Gagal menyimpan catatan. Coba lagi.', variant: 'destructive' }),
      }
    )
  }

  const handleKeluarMeja = () => {
    clearActiveMejaMutation.mutate(undefined, {
      onSuccess: () => {
        resetStore()
        navigate('/kader/dashboard', { replace: true })
      },
      onError: () => {
        toast({ description: 'Gagal keluar meja. Coba lagi.', variant: 'destructive' })
      },
    })
  }

  // Step 1: hadirList query
  const { data: antrianList = [], isLoading: listLoading } = useQuery<AntrianItem[]>({
    queryKey: ['antrian', 'kader', activeSlotId],
    queryFn: () =>
      apiClient.get(`/kader/slot/${activeSlotId}/antrian`).then((r) => r.data.data as AntrianItem[]),
    enabled: !selectedBalitaId && !!activeSlotId,
  })
  const hadirList = antrianList.filter(
    (a) => ['dipanggil', 'sedang_dilayani', 'selesai'].includes(a.statusAntrian),
  )

  if (!activeSlotId) return null

  // ── Step 1 ──────────────────────────────────────────────────────────────

  if (!selectedBalitaId) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex flex-col">
        <div className="bg-[#008236] px-4 pt-10 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">MEJA 4 — Konsultasi</p>
              <p className="text-[#b9f8cf] text-xs">Pilih balita untuk konsultasi</p>
            </div>
            <div className="flex items-center gap-2">
              <SyncPendingBadge />
              <button onClick={() => setShowTukarMeja(true)} className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium">
                Tukar Meja
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">Pilih balita untuk konsultasi:</p>
          {listLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : hadirList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 text-center">
              <p className="text-sm text-amber-700 font-semibold mb-1">Belum ada balita hadir</p>
              <p className="text-xs text-gray-400">Tandai kehadiran di Meja 1 terlebih dahulu.</p>
            </div>
          ) : (
            hadirList.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedBalitaId(item.balitaId)
                  setSelectedNama(item.balita.namaBalita)
                  // Set pemeriksaanId dari data server (getSlotAntrian includes pemeriksaan[])
                  const serverPemId = item.pemeriksaan?.find((p) => p.beratBadan !== null)?.id ?? null
                  setSelectedPemeriksaanId(serverPemId)
                }}
                className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm active:bg-gray-50 text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#99a1af] text-xs font-semibold w-6">{String(item.nomorUrut).padStart(2, '0')}</span>
                    <p className="font-bold text-[#1e2939] text-sm">{item.balita.namaBalita}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            ))
          )}
        </div>

        <div className="bg-white border-t border-gray-100 px-4 py-3">
          <button onClick={handleKeluarMeja} disabled={clearActiveMejaMutation.isPending} className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {clearActiveMejaMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Selesai Meja 4
          </button>
        </div>
        <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId} />
      </div>
    )
  }

  // ── Step 2 ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">
      <div className="bg-[#008236] px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedBalitaId(null)} className="bg-[rgba(0,166,62,0.5)] rounded-xl p-2">
              <ChevronRight size={16} className="text-white rotate-180" />
            </button>
            <div>
              <p className="text-white font-bold text-sm">MEJA 4 — Konsultasi</p>
              <p className="text-[#b9f8cf] text-xs">AI Early Warning + Voice-to-Text · {selectedNama}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncPendingBadge />
            <button onClick={() => setShowTukarMeja(true)} className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium">
              Tukar Meja
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* AI Early Warning — collapsible */}
        <div className="bg-white rounded-2xl border border-[#f3f4f6] shadow-sm overflow-hidden">
          <button
            onClick={() => setShowAI(!showAI)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <p className="text-xs font-semibold text-[#99a1af] uppercase tracking-wide">
              AI Early Warning Stunting
            </p>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${showAI ? 'rotate-180' : ''}`} />
          </button>

          {showAI && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`w-full bg-[#008236] text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 ${!isOnline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#00a63e]'}`}
                      onClick={() => earlyWarningMutation.mutate()}
                      disabled={!isOnline || earlyWarningMutation.isPending}
                    >
                      {earlyWarningMutation.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Memproses...</>
                        : <><Sparkles className="h-4 w-4" />Generate AI Early Warning</>
                      }
                    </button>
                  </TooltipTrigger>
                  {!isOnline && <TooltipContent side="top"><p>Tidak tersedia offline</p></TooltipContent>}
                </Tooltip>
              </TooltipProvider>
              {!selectedPemeriksaanId && (
                <p className="text-xs text-amber-600 text-center">Lakukan timbang di Meja 2 untuk AI Early Warning</p>
              )}
              {earlyWarningData && (
                <div className="bg-white border border-[#f3f4f6] rounded-2xl p-4 space-y-3">
                  <LevelBadge level={earlyWarningData.level} />
                  <div><p className="text-xs font-semibold text-[#99a1af] mb-1">Ringkasan:</p><p className="text-sm text-[#1e2939]">{earlyWarningData.ringkasan}</p></div>
                  <div><p className="text-xs font-semibold text-[#99a1af] mb-1">Rekomendasi:</p><p className="text-sm text-[#1e2939]">{earlyWarningData.rekomendasi}</p></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Voice-to-Text + Catatan */}
        <div className="bg-white rounded-2xl border border-[#f3f4f6] shadow-sm p-4">
          <p className="text-xs font-semibold text-[#99a1af] uppercase tracking-wide mb-4">
            Catatan Konsultasi
          </p>
          <div className="flex flex-col items-center gap-2 mb-4">
            {!isRecording ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`w-14 h-14 rounded-full flex items-center justify-center bg-[#008236] text-white transition-colors ${!isOnline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#00a63e] active:scale-95'}`}
                      onClick={() => void startRecording()}
                      disabled={!isOnline || transcribeMutation.isPending}
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  {!isOnline && <TooltipContent side="top"><p>Tidak tersedia offline</p></TooltipContent>}
                </Tooltip>
              </TooltipProvider>
            ) : (
              <button type="button" className="w-14 h-14 rounded-full flex items-center justify-center bg-[#e7000b] text-white animate-pulse" onClick={stopRecording}>
                <MicOff className="h-5 w-5" />
              </button>
            )}
            <p className="text-xs text-[#99a1af]">
              {isRecording
                ? `Merekam... ${secondsLeft !== null ? `${secondsLeft}s` : ''}`
                : 'Ketuk untuk rekam suara'}
            </p>
          </div>
          {transcribeMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-[#99a1af] text-sm mb-3">
              <Loader2 className="h-4 w-4 animate-spin" />Memproses audio...
            </div>
          )}
          <textarea
            placeholder="Ketik catatan konsultasi atau gunakan perekam suara di atas..."
            value={catatanValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCatatanValue(e.target.value)}
            className="w-full min-h-[100px] text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#008236]"
          />
          <button
            type="button"
            className="mt-3 w-full border border-[#e5e7eb] rounded-xl py-2.5 text-sm font-semibold text-gray-600 flex items-center justify-center gap-2 disabled:opacity-40"
            onClick={handleSimpanCatatan}
            disabled={saveCatatanMutation.isPending || !catatanValue.trim()}
          >
            {saveCatatanMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</>
              : <><Save className="h-4 w-4" />Simpan Catatan</>
            }
          </button>
          {saveCatatanMutation.isSuccess && (
            <p className="text-xs text-[#008236] text-center mt-2">Catatan tersimpan.</p>
          )}
        </div>

      </div>

      {/* Selesai Meja 4 */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={handleKeluarMeja}
          disabled={clearActiveMejaMutation.isPending}
          className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {clearActiveMejaMutation.isPending && <Loader2 size={14} className="animate-spin" />}
          Selesai Meja 4
        </button>
      </div>
      <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId} />
    </div>
  )
}
