/**
 * Meja4Page — Meja 4: Konseling + AI Early Warning + Perekaman Suara
 *
 * Features:
 *   1. Voice recorder: Rekam → MediaRecorder WebM/Opus → Stop → auto-transcribe via /api/voice/transcribe
 *   2. AI Early Warning: Generate GPT-4o analysis via /api/ai/early-warning → level badge + ringkasan + rekomendasi
 *   3. Catatan Konsultasi: Textarea (pre-populated dari transcript) → simpan encrypted via PATCH /api/growth/pemeriksaan/:id
 *   4. Navigate ke Meja 5 (enabled selalu — AI warning opsional)
 *
 * State source: router state dari Meja3Page
 *   { antrianId, balitaId, namaBalita, pemeriksaanId, tandaKlinis, statusGizi }
 *
 * Security (CLAUDE.md §Keamanan):
 *   - OPENAI_API_KEY dan GOOGLE_APPLICATION_CREDENTIALS TIDAK pernah ke browser
 *   - catatanKonsultasi dienkripsi di backend (updatePemeriksaan)
 *   - rekomendasiAi dienkripsi di backend (AI routes earlyWarningHandler)
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Mic, MicOff, Loader2, Sparkles, Save, ArrowRight } from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { usePatchPemeriksaan } from '@/hooks/usePemeriksaan'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import apiClient from '@/lib/axios'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import { generateTempId } from '@/lib/offline-db'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TukarMejaModal } from '@/components/kader/TukarMejaModal'

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Level badge helper ─────────────────────────────────────────────────────

function LevelBadge({ level }: { level: 'normal' | 'waspada' | 'kritis' }) {
  const config = {
    normal: {
      className: 'bg-[#dcfce7] text-[#00a63e] border border-[#b9f8cf]',
      label: 'NORMAL',
    },
    waspada: {
      className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      label: 'WASPADA',
    },
    kritis: {
      className: 'bg-[#fef2f2] text-[#e7000b] border border-[#ffc9c9]',
      label: 'KRITIS',
    },
  }
  const { className, label } = config[level]
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${className}`}>
      {label}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Meja4Page() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activePemeriksaanId, activeAntrianId, activeBalitaId, activeNamaBalita } = useKaderMejaStore()

  const state = location.state as {
    antrianId?: string
    balitaId?: string
    namaBalita?: string
    pemeriksaanId?: string
    tandaKlinis?: TandaKlinis | null
    statusGizi?: string | null
  } | null

  const antrianId = state?.antrianId ?? activeAntrianId ?? undefined
  const balitaId = state?.balitaId ?? activeBalitaId ?? undefined
  const namaBalita = state?.namaBalita ?? activeNamaBalita ?? 'Balita'
  const pemeriksaanId = state?.pemeriksaanId ?? activePemeriksaanId
  const tandaKlinis = state?.tandaKlinis

  useEffect(() => {
    if (!pemeriksaanId) navigate('/kader/dashboard', { replace: true })
  }, [pemeriksaanId, navigate])

  if (!pemeriksaanId) return null

  return (
    <Meja4Content
      antrianId={antrianId}
      balitaId={balitaId}
      namaBalita={namaBalita}
      pemeriksaanId={pemeriksaanId}
      tandaKlinis={tandaKlinis ?? null}
    />
  )
}

// ── Inner Component ────────────────────────────────────────────────────────

interface Meja4ContentProps {
  antrianId: string | undefined
  balitaId: string | undefined
  namaBalita: string
  pemeriksaanId: string
  tandaKlinis: TandaKlinis | null
}

function Meja4Content({
  antrianId,
  balitaId,
  namaBalita,
  pemeriksaanId,
  tandaKlinis,
}: Meja4ContentProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { activeSlotId } = useKaderMejaStore()
  const isOnline = useOfflineStatus()
  const { enqueueOperation } = useOfflineSync()

  const [showTukarMeja, setShowTukarMeja] = useState(false)

  // Voice recorder state
  const { isRecording, audioBlob, secondsLeft, startRecording, stopRecording } = useVoiceRecorder()

  // Catatan konsultasi textarea value (editable, pre-populated dari transcript)
  const [catatanValue, setCatatanValue] = useState('')

  // Early warning result
  const [earlyWarningData, setEarlyWarningData] = useState<EarlyWarningData | null>(null)

  // ── Transcription mutation ─────────────────────────────────────────────

  const transcribeMutation = useMutation<string, Error, Blob>({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const response = await apiClient.post('/voice/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 15_000, // STT bisa lambat — extend timeout
      })
      return (response.data as { data: { transcript: string } }).data.transcript
    },
    onError: () => {
      toast({
        description: 'Gagal transkripsi audio. Ketik catatan secara manual.',
        variant: 'destructive',
      })
    },
  })

  // Auto-transcribe setelah audioBlob tersedia
  useEffect(() => {
    if (audioBlob) {
      transcribeMutation.mutate(audioBlob)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob])

  // Pre-populate catatan dari transcript saat transcript tiba
  useEffect(() => {
    if (transcribeMutation.data) {
      setCatatanValue((prev) => {
        // Hanya pre-populate jika kader belum mengetik sendiri
        if (!prev) return transcribeMutation.data!
        return prev
      })
    }
  }, [transcribeMutation.data])

  // ── Early warning mutation ─────────────────────────────────────────────

  const earlyWarningMutation = useMutation<EarlyWarningData, Error>({
    mutationFn: async () => {
      const response = await apiClient.post('/ai/early-warning', {
        pemeriksaanId,
        tandaKlinis,
      })
      return (response.data as { data: EarlyWarningData }).data
    },
    onSuccess: (data) => {
      setEarlyWarningData(data)
    },
    onError: () => {
      toast({
        description: 'Gagal generate AI Early Warning. Coba lagi.',
        variant: 'destructive',
      })
    },
  })

  // ── Catatan save mutation ──────────────────────────────────────────────

  const saveCatatanMutation = usePatchPemeriksaan()

  async function handleSimpanCatatan() {
    if (!catatanValue.trim()) {
      toast({ description: 'Catatan konsultasi kosong.', variant: 'destructive' })
      return
    }

    // Offline branch (D-14) — enqueue ke pemeriksaan_queue saat tidak ada koneksi
    if (!isOnline) {
      try {
        await enqueueOperation('pemeriksaan', {
          id: generateTempId(),
          tempPemeriksaanId: pemeriksaanId,
          type: 'patch-catatan' as const,
          data: {
            catatanKonsultasi: catatanValue,
            rekomendasiAi: null,   // D-14: null saat disimpan offline tanpa AI
            catatanSTT: null,       // D-14: null saat disimpan offline tanpa STT
          },
          timestamp: Date.now(),
        })
        toast({ description: 'Tersimpan lokal, akan sync saat online' })
        navigate('/kader/meja/5', {
          state: { antrianId, balitaId, namaBalita, pemeriksaanId },
        })
      } catch {
        // WR-03: IDB unavailable or quota exceeded — warn kader
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }

    saveCatatanMutation.mutate(
      { id: pemeriksaanId, catatanKonsultasi: catatanValue },
      {
        onSuccess: () => {
          toast({ description: 'Catatan konsultasi berhasil disimpan.' })
        },
        onError: () => {
          toast({
            description: 'Gagal menyimpan catatan. Coba lagi.',
            variant: 'destructive',
          })
        },
      }
    )
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  function handleLanjut() {
    navigate('/kader/meja/5', {
      state: { antrianId, balitaId, namaBalita, pemeriksaanId },
    })
  }

  function handleKeluar() {
    navigate('/kader/dashboard', { replace: true })
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">MEJA 4 — Konsultasi</p>
            <p className="text-[#b9f8cf] text-xs">AI Early Warning + Voice-to-Text aktif · {namaBalita}</p>
          </div>
          <div className="flex items-center gap-2">
            <SyncPendingBadge />
            <button
              onClick={() => setShowTukarMeja(true)}
              className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium"
            >
              Tukar Meja
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── Perekaman Suara ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#f3f4f6] shadow-sm p-4">
          <p className="text-xs font-semibold text-[#99a1af] uppercase tracking-wide mb-4">
            Perekaman Suara (Opsional)
          </p>
          <div className="space-y-3">
            {/* Mic circle button — centered */}
            <div className="flex flex-col items-center gap-2">
              {!isRecording ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={`w-16 h-16 rounded-full flex items-center justify-center bg-[#008236] text-white transition-colors ${!isOnline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#00a63e] active:scale-95'}`}
                        onClick={() => void startRecording()}
                        disabled={!isOnline || transcribeMutation.isPending}
                      >
                        <Mic className="h-6 w-6" />
                      </button>
                    </TooltipTrigger>
                    {!isOnline && (
                      <TooltipContent side="top">
                        <p>Tidak tersedia offline</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <button
                  type="button"
                  className="w-16 h-16 rounded-full flex items-center justify-center bg-[#e7000b] text-white animate-pulse active:scale-95 transition-transform"
                  onClick={stopRecording}
                >
                  <MicOff className="h-6 w-6" />
                </button>
              )}
              <p className="text-xs text-[#99a1af]">
                {isRecording ? 'Ketuk untuk berhenti' : 'Mulai Rekam'}
              </p>
            </div>
            {isRecording && (
              <div className="flex items-center justify-center gap-3 text-[#e7000b] text-sm">
                <span className="h-2 w-2 rounded-full bg-[#e7000b] animate-pulse" />
                <span>Merekam...</span>
                {secondsLeft !== null && (
                  <span className={`font-mono font-semibold ${secondsLeft <= 10 ? 'text-red-700' : 'text-red-500'}`}>
                    {secondsLeft}s
                  </span>
                )}
              </div>
            )}
            {transcribeMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-[#99a1af] text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memproses audio...
              </div>
            )}
            {transcribeMutation.isSuccess && (
              <div className="space-y-1">
                <p className="text-xs text-[#99a1af] font-medium">Hasil transkripsi:</p>
                <div className="bg-[#f9fafb] border border-[#f3f4f6] rounded-xl px-3 py-2 text-sm text-[#1e2939] min-h-[60px]">
                  {transcribeMutation.data || (
                    <span className="text-[#99a1af] italic">Tidak ada ucapan terdeteksi</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── AI Early Warning ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#f3f4f6] shadow-sm p-4">
          <p className="text-xs font-semibold text-[#99a1af] uppercase tracking-wide mb-3">
            AI Early Warning Stunting
          </p>
          <div className="space-y-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`w-full bg-[#008236] text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 ${!isOnline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#00a63e]'}`}
                    onClick={() => earlyWarningMutation.mutate()}
                    disabled={!isOnline || earlyWarningMutation.isPending}
                  >
                    {earlyWarningMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Memproses...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" />Generate AI Early Warning</>
                    )}
                  </button>
                </TooltipTrigger>
                {!isOnline && (
                  <TooltipContent side="top">
                    <p>Tidak tersedia offline</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            {earlyWarningData && (
              <div className="bg-white border border-[#f3f4f6] rounded-2xl p-4 space-y-3">
                <LevelBadge level={earlyWarningData.level} />
                <div>
                  <p className="text-xs font-semibold text-[#99a1af] mb-1">Ringkasan:</p>
                  <p className="text-sm text-[#1e2939]">{earlyWarningData.ringkasan}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#99a1af] mb-1">Rekomendasi:</p>
                  <p className="text-sm text-[#1e2939]">{earlyWarningData.rekomendasi}</p>
                </div>
                <p className="text-xs text-[#99a1af] italic">Rekomendasi AI telah disimpan secara otomatis.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Catatan Konsultasi ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#f3f4f6] shadow-sm p-4">
          <p className="text-xs font-semibold text-[#99a1af] uppercase tracking-wide mb-3">
            Catatan Konsultasi
          </p>
          <div className="space-y-3">
            <textarea
              placeholder="Ketik catatan konsultasi atau gunakan perekam suara di atas..."
              value={catatanValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCatatanValue(e.target.value)}
              className="w-full min-h-[100px] text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#008236] focus:border-transparent"
            />
            <button
              type="button"
              className="w-full border border-[#e5e7eb] rounded-xl py-2.5 text-sm font-semibold text-gray-600 flex items-center justify-center gap-2 disabled:opacity-40"
              onClick={handleSimpanCatatan}
              disabled={saveCatatanMutation.isPending || !catatanValue.trim()}
            >
              {saveCatatanMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</>
              ) : (
                <><Save className="h-4 w-4" />Simpan Catatan</>
              )}
            </button>
            {saveCatatanMutation.isSuccess && (
              <p className="text-xs text-[#008236] text-center">Catatan tersimpan.</p>
            )}
          </div>
        </div>

        {/* ── Action buttons ────────────────────────────────────────────── */}
        <button
          type="button"
          className="w-full bg-[#008236] text-white rounded-2xl py-4 text-sm font-bold flex items-center justify-center gap-2"
          onClick={handleLanjut}
        >
          Lanjut ke Meja 5
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleKeluar}
          className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] rounded-2xl py-3 text-sm font-semibold"
        >
          Selesai Meja 4
        </button>
      </div>
      <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId ?? ''} />
    </div>
  )
}
