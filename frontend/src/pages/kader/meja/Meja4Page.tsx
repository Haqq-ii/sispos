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
import { Mic, MicOff, Loader2, LogOut, Sparkles, Save, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { usePatchPemeriksaan } from '@/hooks/usePemeriksaan'
import apiClient from '@/lib/axios'

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
      className: 'bg-green-100 text-green-800 border border-green-300',
      label: 'NORMAL',
    },
    waspada: {
      className: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
      label: 'WASPADA',
    },
    kritis: {
      className: 'bg-red-100 text-red-800 border border-red-300',
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

  const state = location.state as {
    antrianId?: string
    balitaId?: string
    namaBalita?: string
    pemeriksaanId?: string
    tandaKlinis?: TandaKlinis | null
    statusGizi?: string | null
  } | null

  const antrianId = state?.antrianId
  const balitaId = state?.balitaId
  const namaBalita = state?.namaBalita ?? 'Balita'
  const pemeriksaanId = state?.pemeriksaanId
  const tandaKlinis = state?.tandaKlinis

  // Guard: pemeriksaanId harus ada
  if (!pemeriksaanId) {
    navigate('/kader/dashboard', { replace: true })
    return null
  }

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

  // Voice recorder state
  const { isRecording, audioBlob, startRecording, stopRecording } = useVoiceRecorder()

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

  function handleSimpanCatatan() {
    if (!catatanValue.trim()) {
      toast({ description: 'Catatan konsultasi kosong.', variant: 'destructive' })
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-base font-bold text-gray-900">Meja 4 — Konseling & AI</h1>
          <p className="text-xs text-gray-500">{namaBalita}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleKeluar} className="text-red-600">
          <LogOut className="h-4 w-4 mr-1" />
          Keluar Meja
        </Button>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-6">

        {/* ── Perekaman Suara ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Perekaman Suara (Opsional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              {!isRecording ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => void startRecording()}
                  disabled={transcribeMutation.isPending}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Mulai Rekam
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50 animate-pulse"
                  onClick={stopRecording}
                >
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop Rekam
                </Button>
              )}
            </div>

            {/* Indicator rekaman aktif */}
            {isRecording && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Merekam...
              </div>
            )}

            {/* Loading transkripsi */}
            {transcribeMutation.isPending && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memproses audio...
              </div>
            )}

            {/* Hasil transkripsi */}
            {transcribeMutation.isSuccess && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 font-medium">Hasil transkripsi:</p>
                <div className="bg-gray-50 border rounded-md px-3 py-2 text-sm text-gray-800 min-h-[60px]">
                  {transcribeMutation.data || (
                    <span className="text-gray-400 italic">Tidak ada ucapan terdeteksi</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── AI Early Warning ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              AI Early Warning Stunting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => earlyWarningMutation.mutate()}
              disabled={earlyWarningMutation.isPending}
            >
              {earlyWarningMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Early Warning
                </>
              )}
            </Button>

            {/* Hasil Early Warning */}
            {earlyWarningData && (
              <div className="border rounded-lg p-4 space-y-3 bg-white">
                {/* Level badge */}
                <div className="flex items-center gap-3">
                  <LevelBadge level={earlyWarningData.level} />
                </div>

                {/* Ringkasan */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Ringkasan:</p>
                  <p className="text-sm text-gray-800">{earlyWarningData.ringkasan}</p>
                </div>

                {/* Rekomendasi */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Rekomendasi:</p>
                  <p className="text-sm text-gray-800">{earlyWarningData.rekomendasi}</p>
                </div>

                <p className="text-xs text-gray-400 italic">
                  Rekomendasi AI telah disimpan secara otomatis.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Catatan Konsultasi ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Catatan Konsultasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Native textarea — @/components/ui/textarea belum ada (pola: InlineProgress plan 03-02) */}
            <textarea
              placeholder="Ketik catatan konsultasi atau gunakan perekam suara di atas..."
              value={catatanValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCatatanValue(e.target.value)}
              className="w-full min-h-[100px] text-sm border border-gray-300 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleSimpanCatatan}
              disabled={saveCatatanMutation.isPending || !catatanValue.trim()}
            >
              {saveCatatanMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Simpan Catatan
                </>
              )}
            </Button>
            {saveCatatanMutation.isSuccess && (
              <p className="text-xs text-green-600 text-center">Catatan tersimpan.</p>
            )}
          </CardContent>
        </Card>

        {/* ── Lanjut ke Meja 5 ──────────────────────────────────────── */}
        <Button
          type="button"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleLanjut}
        >
          Lanjut ke Meja 5
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
