/**
 * Meja2Page — Meja 2: Penimbangan (BB/TB) + Z-Score WHO 2006
 *
 * Features:
 * - Custom numeric keypad for BB (kg) + TB (cm)
 * - Biological validation gate: if BB > 30 kg → Dialog konfirmasi sebelum kirim
 * - POST /api/growth/pemeriksaan → Z-Score response
 * - Z-Score result card: WAZ, HAZ, WHZ + statusGizi badge
 * - "Lanjut ke Meja 3" → navigate with state { antrianId, balitaId, namaBalita, pemeriksaanId }
 * - Guard: if !activeSlotId → redirect to /kader/dashboard
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Delete, Loader2, AlertTriangle, Users } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useMutationClearActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { useCreatePemeriksaan, type PemeriksaanRecord } from '@/hooks/usePemeriksaan'
import apiClient from '@/lib/axios'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import { generateTempId } from '@/lib/offline-db'

// ── Antrian item type (subset dari Meja 1) ────────────────────────────────────

interface AntrianItem {
  id: string
  nomorUrut: number
  statusAntrian: string
  balitaId: string
  balita: { namaBalita: string; tanggalLahir: string }
}

// ── Status gizi styles ────────────────────────────────────────────────────────

const STATUS_GIZI_STYLE: Record<string, string> = {
  normal: 'bg-[#dcfce7] text-[#00a63e]',
  kurang: 'bg-yellow-100 text-yellow-700',
  buruk: 'bg-red-100 text-red-700',
  lebih: 'bg-orange-100 text-orange-700',
  obesitas: 'bg-orange-100 text-orange-700',
  pendek: 'bg-purple-100 text-purple-700',
  sangat_pendek: 'bg-purple-100 text-purple-700',
}

const STATUS_GIZI_LABEL: Record<string, string> = {
  normal: 'Normal',
  kurang: 'Berat Badan Kurang',
  buruk: 'Gizi Buruk',
  lebih: 'Berat Badan Lebih',
  obesitas: 'Obesitas',
  pendek: 'Pendek',
  sangat_pendek: 'Sangat Pendek',
}

// ── Error helper ──────────────────────────────────────────────────────────────

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

// ── Keypad helpers ────────────────────────────────────────────────────────────

function appendKey(current: string, key: string): string {
  if (key === '.' && current.includes('.')) return current
  if (key === '.' && current === '') return '0.'
  if (current === '0' && key !== '.') return key
  return current + key
}

function backspaceStr(current: string): string {
  return current.slice(0, -1)
}

// ── Guard wrapper ─────────────────────────────────────────────────────────────

export default function Meja2Page() {
  const navigate = useNavigate()
  const { activeSlotId, setActivePemeriksaanId, reset: resetStore } = useKaderMejaStore()
  const clearActiveMejaMutation = useMutationClearActiveMeja()

  useEffect(() => {
    if (!activeSlotId) navigate('/kader/dashboard', { replace: true })
  }, [activeSlotId, navigate])

  if (!activeSlotId) return null

  return (
    <Meja2Content
      activeSlotId={activeSlotId}
      clearActiveMejaMutation={clearActiveMejaMutation}
      resetStore={resetStore}
      setActivePemeriksaanId={setActivePemeriksaanId}
    />
  )
}

// ── Inner component ───────────────────────────────────────────────────────────

interface Meja2ContentProps {
  activeSlotId: string
  clearActiveMejaMutation: ReturnType<typeof useMutationClearActiveMeja>
  resetStore: () => void
  setActivePemeriksaanId: (id: string | null) => void
}

function Meja2Content({
  activeSlotId,
  clearActiveMejaMutation,
  resetStore,
  setActivePemeriksaanId,
}: Meja2ContentProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { activeAntrianId, activeBalitaId, activeNamaBalita, setActiveAntrian } = useKaderMejaStore()
  const isOnline = useOfflineStatus()
  const { enqueueOperation } = useOfflineSync()

  const routeState = location.state as {
    antrianId?: string
    balitaId?: string
    namaBalita?: string
  } | null

  // Prioritas: route state → store fallback
  const [antrianId, setAntrianId] = useState<string | undefined>(
    routeState?.antrianId ?? activeAntrianId ?? undefined
  )
  const [balitaId, setBalitaId] = useState<string | undefined>(
    routeState?.balitaId ?? activeBalitaId ?? undefined
  )
  const [namaBalita, setNamaBalita] = useState<string>(
    routeState?.namaBalita ?? activeNamaBalita ?? 'Balita'
  )

  // Fetch antrian untuk picker (hanya kalau belum ada balitaId)
  const { data: antrianList = [], isLoading: pickerLoading } = useQuery<AntrianItem[]>({
    queryKey: ['antrian', 'kader', activeSlotId],
    queryFn: () =>
      apiClient.get(`/kader/slot/${activeSlotId}/antrian`).then((r) => r.data.data as AntrianItem[]),
    enabled: !balitaId,
  })
  const dipanggilList = antrianList.filter((a) => a.statusAntrian === 'dipanggil')

  // ── Local state ─────────────────────────────────────────────────────────────
  const [activeField, setActiveField] = useState<'bb' | 'tb'>('bb')
  const [bbStr, setBbStr] = useState('')
  const [tbStr, setTbStr] = useState('')
  const [showKonfirmasi, setShowKonfirmasi] = useState(false)
  const [pemResult, setPemResult] = useState<PemeriksaanRecord | null>(null)

  const bbValue = parseFloat(bbStr) || 0
  const tbValue = parseFloat(tbStr) || 0
  const isBbFilled = bbStr !== '' && bbValue > 0

  const createPemeriksaan = useCreatePemeriksaan()
  const isSaving = createPemeriksaan.isPending

  // ── Keypad handler ──────────────────────────────────────────────────────────

  const handleKey = (key: string) => {
    if (activeField === 'bb') {
      setBbStr((prev) => appendKey(prev, key))
    } else {
      setTbStr((prev) => appendKey(prev, key))
    }
  }

  const handleBackspace = () => {
    if (activeField === 'bb') {
      setBbStr((prev) => backspaceStr(prev))
    } else {
      setTbStr((prev) => backspaceStr(prev))
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  // Security: X-Konfirmasi-Biologis header is sent by useCreatePemeriksaan hook
  // when konfirmasiBiologis=true (T-03-04-02). Backend enforces gate — UI is UX layer only.
  async function doSubmit(konfirmasiBiologis: boolean) {
    if (!balitaId) {
      toast({
        description: 'Data balita tidak tersedia. Kembali ke Meja 1 dan pilih balita.',
        variant: 'destructive',
      })
      return
    }

    // Offline branch (Pitfall 3 — avoids Z-Score result blocking navigation)
    if (!isOnline) {
      const tempPemeriksaanId = generateTempId()
      try {
        await enqueueOperation('pemeriksaan', {
          id: generateTempId(),
          tempPemeriksaanId,
          type: 'create' as const,
          data: {
            balitaId,
            antrianId,
            beratBadan: bbValue,
            tinggiBadan: tbStr !== '' && tbValue > 0 ? tbValue : undefined,
            konfirmasiBiologis,
          },
          timestamp: Date.now(),
        })
        setActivePemeriksaanId(tempPemeriksaanId)
        toast({ description: 'Tersimpan lokal, akan sync saat online' })
        setShowKonfirmasi(false)
        navigate('/kader/meja/3', {
          state: { antrianId, balitaId, namaBalita, pemeriksaanId: tempPemeriksaanId },
        })
      } catch {
        // WR-03: IDB unavailable or quota exceeded — warn kader before proceeding
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }

    createPemeriksaan.mutate(
      {
        balitaId,
        antrianId,
        beratBadan: bbValue,
        tinggiBadan: tbStr !== '' && tbValue > 0 ? tbValue : undefined,
        konfirmasiBiologis,
      },
      {
        onSuccess: (result) => {
          setActivePemeriksaanId(result.id)
          setPemResult(result)
          setShowKonfirmasi(false)
          toast({ description: 'Data timbang berhasil disimpan.' })
        },
        onError: (err) => {
          const msg = isAxiosLikeError(err) ? err.response.data.message : 'Terjadi kesalahan.'
          toast({ description: msg, variant: 'destructive' })
        },
      }
    )
  }

  function handleSimpan() {
    if (!isBbFilled) return
    if (bbValue > 30) {
      setShowKonfirmasi(true)
      return
    }
    doSubmit(false)
  }

  const handlePilihBalita = (item: AntrianItem) => {
    setAntrianId(item.id)
    setBalitaId(item.balitaId)
    setNamaBalita(item.balita.namaBalita)
    setActiveAntrian(item.id, item.balitaId, item.balita.namaBalita)
  }

  const handleKeluarMeja = () => {
    clearActiveMejaMutation.mutate()
    resetStore()
    navigate('/kader/dashboard', { replace: true })
  }

  const handleLanjutMeja3 = () => {
    navigate('/kader/meja/3', {
      state: {
        antrianId,
        balitaId,
        namaBalita,
        pemeriksaanId: pemResult?.id,
      },
    })
  }

  // ── Keypad layout ───────────────────────────────────────────────────────────

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-[#00a63e] px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="bg-[rgba(0,166,62,0.5)] rounded-xl p-2"
            >
              <ChevronLeft size={18} className="text-white" />
            </button>
            <div>
              <p className="text-white font-bold text-sm">MEJA 2 — Pengukuran BB/TB</p>
              <p className="text-[#b9f8cf] text-xs">Timbang &amp; ukur tinggi badan</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/kader/pelayanan', { state: { slotId: activeSlotId, slotLabel: 'Sesi Aktif' } })}
            className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium"
          >
            Tukar Meja
          </button>
        </div>
        <SyncPendingBadge />
      </div>

      {/* ── Sub-header: balita ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-[#1e2939] text-sm">{balitaId ? namaBalita : 'Pilih balita terlebih dahulu'}</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-[#99a1af] text-xs">
          ← Kembali
        </button>
      </div>

      {/* ── Picker balita (tampil jika belum ada balitaId) ───────────────── */}
      {!balitaId && !pemResult && (
        <div className="flex-1 px-4 py-4">
          <div className="bg-white rounded-2xl border border-amber-200 p-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-amber-600" />
              <p className="text-sm font-semibold text-amber-700">Pilih balita yang akan ditimbang</p>
            </div>
            {pickerLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : dipanggilList.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Belum ada balita yang hadir. Kembali ke Meja 1 untuk tandai kehadiran.
              </p>
            ) : (
              <div className="space-y-2">
                {dipanggilList.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handlePilihBalita(item)}
                    className="w-full bg-[#f0fdf4] border border-[#b9f8cf] rounded-xl px-4 py-3 flex items-center justify-between text-left active:bg-[#dcfce7]"
                  >
                    <div>
                      <p className="font-semibold text-[#1e2939] text-sm">{item.balita.namaBalita}</p>
                      <p className="text-xs text-gray-400">No. {String(item.nomorUrut).padStart(2, '0')}</p>
                    </div>
                    <span className="text-[#008236] text-xs font-semibold">Pilih →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!pemResult ? (
        <>
          {/* ── BB / TB display cards ────────────────────────────────────── */}
          <div className="px-4 py-4 flex gap-3">
            <button
              onClick={() => setActiveField('bb')}
              className={`flex-1 rounded-2xl px-4 py-4 text-left border transition-colors ${
                activeField === 'bb'
                  ? 'bg-[#f0fdf4] border-[#00c950]'
                  : 'bg-white border-[#e5e7eb]'
              }`}
            >
              <p className="text-xs text-gray-400 mb-1">Berat Badan</p>
              <p
                className={`text-3xl font-bold leading-none ${
                  activeField === 'bb' ? 'text-[#00a63e]' : 'text-[#364153]'
                }`}
              >
                {bbStr || '0'}
              </p>
              <p className="text-xs text-gray-400 mt-1">kg</p>
            </button>

            <button
              onClick={() => setActiveField('tb')}
              className={`flex-1 rounded-2xl px-4 py-4 text-left border transition-colors ${
                activeField === 'tb'
                  ? 'bg-[#f0fdf4] border-[#00c950]'
                  : 'bg-white border-[#e5e7eb]'
              }`}
            >
              <p className="text-xs text-gray-400 mb-1">Tinggi Badan</p>
              <p
                className={`text-3xl font-bold leading-none ${
                  activeField === 'tb' ? 'text-[#00a63e]' : 'text-[#364153]'
                }`}
              >
                {tbStr || '0'}
              </p>
              <p className="text-xs text-gray-400 mt-1">cm</p>
            </button>
          </div>

          {/* Hint */}
          <p className="text-center text-xs text-gray-400 px-4 -mt-2 mb-2">
            {activeField === 'bb'
              ? 'Masukkan berat badan dalam kg'
              : 'Tinggi badan opsional — ketuk kolom kiri untuk kembali ke BB'}
          </p>

          {/* ── Custom keypad ──────────────────────────────────────────────── */}
          <div className="px-4 pb-2 grid grid-cols-3 gap-2.5">
            {KEYS.map((key) => {
              const isBackspace = key === '⌫'
              const isDot = key === '.'
              return (
                <button
                  key={key}
                  onClick={() => (isBackspace ? handleBackspace() : handleKey(key))}
                  className={`rounded-2xl h-14 text-xl font-semibold flex items-center justify-center active:scale-95 transition-transform ${
                    isBackspace
                      ? 'bg-[#fef2f2] border border-[#ffc9c9]'
                      : isDot
                      ? 'bg-[#f3f4f6] border border-[#e5e7eb] text-gray-600'
                      : 'bg-white border border-[#e5e7eb] text-gray-800 shadow-sm'
                  }`}
                >
                  {isBackspace ? <Delete size={20} className="text-[#e7000b]" /> : key}
                </button>
              )
            })}
          </div>

          {/* ── Action buttons ─────────────────────────────────────────────── */}
          <div className="px-4 pt-2 pb-3 flex gap-2">
            <button
              onClick={() => setActiveField(activeField === 'bb' ? 'tb' : 'bb')}
              className="flex-1 bg-[#f3f4f6] rounded-2xl py-3.5 text-sm font-semibold text-gray-600"
            >
              {activeField === 'bb' ? 'Pindah ke Tinggi Badan' : 'Pindah ke Berat Badan'}
            </button>
            <button
              onClick={handleSimpan}
              disabled={!isBbFilled || isSaving}
              className={`flex-1 rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                isBbFilled && !isSaving
                  ? 'bg-[#00a63e] text-white'
                  : 'bg-[#e5e7eb] text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Simpan Data
            </button>
          </div>

          {/* Keluar Meja */}
          <div className="px-4 pb-4">
            <button
              onClick={handleKeluarMeja}
              className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] rounded-2xl py-3 text-sm font-semibold"
            >
              Selesai Meja 2
            </button>
          </div>
        </>
      ) : (
        /* ── Z-Score result ────────────────────────────────────────────── */
        <div className="flex-1 px-4 py-4 space-y-3">
          <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 flex gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Berat Badan</p>
              <p className="text-2xl font-bold text-[#1e2939]">
                {pemResult.beratBadan}{' '}
                <span className="text-sm font-normal text-gray-400">kg</span>
              </p>
            </div>
            {pemResult.tinggiBadan !== null && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Tinggi Badan</p>
                <p className="text-2xl font-bold text-[#1e2939]">
                  {pemResult.tinggiBadan}{' '}
                  <span className="text-sm font-normal text-gray-400">cm</span>
                </p>
              </div>
            )}
          </div>

          <div className="bg-[#f0fdf4] border border-[#b9f8cf] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Hasil Z-Score WHO 2006</p>
              {pemResult.statusGizi && (
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    STATUS_GIZI_STYLE[pemResult.statusGizi] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {STATUS_GIZI_LABEL[pemResult.statusGizi] ?? pemResult.statusGizi}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {[
                { label: 'BB / Umur (WAZ)', val: pemResult.zScoreBbU },
                { label: 'TB / Umur (HAZ)', val: pemResult.zScoreTbU },
                { label: 'BB / TB (WHZ)', val: pemResult.zScoreBbTb },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-mono font-semibold text-[#1e2939]">
                    {val !== null ? val.toFixed(2) : '—'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 border-t pt-2">
              Z-Score dihitung berdasarkan standar WHO 2006
            </p>
          </div>

          <button
            onClick={handleLanjutMeja3}
            className="w-full bg-[#008236] text-white rounded-2xl py-4 text-sm font-bold"
          >
            Lanjut ke Meja 3 →
          </button>
        </div>
      )}

      {/* ── Biological confirmation Dialog ────────────────────────────────── */}
      <Dialog
        open={showKonfirmasi}
        onOpenChange={(open: boolean) => {
          if (!open) setShowKonfirmasi(false)
        }}
      >
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <DialogTitle>Konfirmasi Nilai Tidak Biasa</DialogTitle>
            </div>
            <DialogDescription className="text-left">
              Berat badan <strong>{bbStr} kg</strong> sangat tidak biasa untuk balita (umumnya
              tidak melebihi 30 kg). Pastikan data sudah benar sebelum menyimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              onClick={() => doSubmit(true)}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
              ) : (
                'Ya, Data Sudah Benar — Simpan'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowKonfirmasi(false)}
              disabled={isSaving}
              className="w-full"
            >
              Koreksi Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
