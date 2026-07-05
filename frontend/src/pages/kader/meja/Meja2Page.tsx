/**
 * Meja2Page — Meja 2: Penimbangan BB/TB
 *
 * Alur (Figma Make):
 * Step 1 — Daftar balita hadir (dipanggil), tandai sudah diukur dgn checkmark
 * Step 2 — Pilih balita → Numpad BB+TB (keduanya wajib)
 *           Simpan → toast sukses 2 detik → kembali ke Step 1 otomatis
 * "Selesai Meja 2" → modal konfirmasi → keluar ke dashboard
 *
 * Tidak ada navigate ke Meja 3 dari sini (setiap meja independen).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  Delete,
  Loader2,
  AlertTriangle,
  Users,
  CheckCircle,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useMutationClearActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { useCreatePemeriksaan } from '@/hooks/usePemeriksaan'
import apiClient from '@/lib/axios'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import { generateTempId } from '@/lib/offline-db'
import { TukarMejaModal } from '@/components/kader/TukarMejaModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AntrianItem {
  id: string
  nomorUrut: number
  statusAntrian: string
  balitaId: string
  balita: { namaBalita: string; tanggalLahir: string }
  pemeriksaan?: Array<{ id: string; beratBadan: number | null; tinggiBadan: number | null }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function appendKey(current: string, key: string): string {
  if (key === '.' && current.includes('.')) return current
  if (key === '.' && current === '') return '0.'
  if (current === '0' && key !== '.') return key
  if (current.length >= 6) return current
  return current + key
}

function backspaceStr(current: string): string {
  return current.slice(0, -1)
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
  const { toast } = useToast()
  const { setActiveAntrian } = useKaderMejaStore()
  const isOnline = useOfflineStatus()
  const { enqueueOperation } = useOfflineSync()
  const queryClient = useQueryClient()

  const [showTukarMeja, setShowTukarMeja] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [savedData, setSavedData] = useState<Record<string, { bb: string; tb: string }>>({})

  // Selected balita (Step 2)
  const [antrianId, setAntrianId] = useState<string | undefined>(undefined)
  const [balitaId, setBalitaId] = useState<string | undefined>(undefined)
  const [namaBalita, setNamaBalita] = useState<string>('Balita')

  // Always fetch so list stays fresh after saves
  const { data: antrianList = [], isLoading: pickerLoading } = useQuery<AntrianItem[]>({
    queryKey: ['antrian', 'kader', activeSlotId],
    queryFn: () =>
      apiClient
        .get(`/kader/slot/${activeSlotId}/antrian`)
        .then((r) => r.data.data as AntrianItem[]),
  })
  const dipanggilList = antrianList.filter((a) => a.statusAntrian === 'dipanggil')

  // Numpad state
  const [activeField, setActiveField] = useState<'bb' | 'tb'>('bb')
  const [bbStr, setBbStr] = useState('')
  const [tbStr, setTbStr] = useState('')
  const [showKonfirmasi, setShowKonfirmasi] = useState(false)
  const [konfirmasiInfo, setKonfirmasiInfo] = useState<{
    field: string
    value: string
    suggestion: string
  } | null>(null)

  const bbValue = parseFloat(bbStr) || 0
  const tbValue = parseFloat(tbStr) || 0
  const isBothFilled = bbStr !== '' && bbValue > 0 && tbStr !== '' && tbValue > 0

  const createPemeriksaan = useCreatePemeriksaan()
  const isSaving = createPemeriksaan.isPending

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleKey = (key: string) => {
    if (activeField === 'bb') setBbStr((prev) => appendKey(prev, key))
    else setTbStr((prev) => appendKey(prev, key))
  }

  const handleBackspace = () => {
    if (activeField === 'bb') setBbStr((prev) => backspaceStr(prev))
    else setTbStr((prev) => backspaceStr(prev))
  }

  const handlePilihBalita = (item: AntrianItem) => {
    setAntrianId(item.id)
    setBalitaId(item.balitaId)
    setNamaBalita(item.balita.namaBalita)
    setActiveAntrian(item.id, item.balitaId, item.balita.namaBalita)
  }

  const handleKembaliKeDaftar = () => {
    setBalitaId(undefined)
    setAntrianId(undefined)
    setNamaBalita('Balita')
    setBbStr('')
    setTbStr('')
    setActiveField('bb')
  }

  const handleKeluarMeja = () => {
    clearActiveMejaMutation.mutate()
    resetStore()
    navigate('/kader/dashboard', { replace: true })
  }

  async function doSubmit(konfirmasiBiologis: boolean) {
    if (!balitaId) return

    const onSaved = (pemId: string) => {
      setActivePemeriksaanId(pemId)
      setSavedData((prev) => ({ ...prev, [balitaId]: { bb: bbStr, tb: tbStr } }))
      setShowKonfirmasi(false)
      setShowSaveSuccess(true)
      setTimeout(() => setShowSaveSuccess(false), 2000)
      void queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', activeSlotId] })
      handleKembaliKeDaftar()
    }

    if (!isOnline) {
      const tempId = generateTempId()
      try {
        await enqueueOperation('pemeriksaan', {
          id: generateTempId(),
          tempPemeriksaanId: tempId,
          type: 'create' as const,
          data: { balitaId, antrianId, beratBadan: bbValue, tinggiBadan: tbValue, konfirmasiBiologis },
          timestamp: Date.now(),
        })
        onSaved(tempId)
      } catch {
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }

    createPemeriksaan.mutate(
      { balitaId, antrianId, beratBadan: bbValue, tinggiBadan: tbValue, konfirmasiBiologis },
      {
        onSuccess: (result) => onSaved(result.id),
        onError: (err) => {
          if (isAxiosLikeError(err) && err.response.data.error === 'PEMERIKSAAN_SUDAH_ADA') {
            // Treat duplicate as success — mark locally as done and go back
            setSavedData((prev) => ({ ...prev, [balitaId]: { bb: bbStr, tb: tbStr } }))
            void queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', activeSlotId] })
            toast({ description: 'Sudah ditimbang sebelumnya — data dipertahankan.' })
            handleKembaliKeDaftar()
            return
          }
          const msg = isAxiosLikeError(err) ? err.response.data.message : 'Terjadi kesalahan.'
          toast({ description: msg, variant: 'destructive' })
        },
      }
    )
  }

  function handleSimpan() {
    if (!isBothFilled) return
    if (bbValue < 1.5 || bbValue > 40) {
      setKonfirmasiInfo({ field: 'Berat Badan', value: bbStr, suggestion: 'Batas wajar balita: 1,5–40 kg' })
      setShowKonfirmasi(true)
      return
    }
    if (tbValue < 35 || tbValue > 130) {
      setKonfirmasiInfo({ field: 'Tinggi Badan', value: tbStr, suggestion: 'Batas wajar balita: 35–130 cm' })
      setShowKonfirmasi(true)
      return
    }
    void doSubmit(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="bg-green-600 px-4 pt-10 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-green-500/60 rounded-xl p-2">
              <ChevronLeft size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">MEJA 2 — Pengukuran BB/TB</p>
              <p className="text-green-200 text-xs">Mode Pelayanan Aktif · Layar Terkunci</p>
            </div>
          </div>
          <button
            onClick={() => setShowTukarMeja(true)}
            className="px-3 py-1.5 bg-green-500/60 text-white text-xs rounded-xl border border-green-400/50 font-medium"
          >
            Tukar Meja
          </button>
        </div>
        <SyncPendingBadge />
      </div>

      {/* ── Step 1: Daftar balita ─────────────────────────────────────────── */}
      {!balitaId && (
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          <p className="text-gray-600 text-sm font-semibold mb-3">Pilih balita yang sudah hadir:</p>
          {pickerLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : dipanggilList.length === 0 ? (
            <div className="text-center py-10">
              <Users size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Belum ada balita yang hadir.</p>
              <p className="text-xs text-gray-400 mt-1">Kembali ke Meja 1 untuk tandai kehadiran.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dipanggilList.map((item) => {
                // done = server confirms pemeriksaan exists OR optimistic local state
                const serverDone =
                  Array.isArray(item.pemeriksaan) &&
                  item.pemeriksaan.length > 0 &&
                  item.pemeriksaan[0].beratBadan !== null
                const done = serverDone || !!savedData[item.balitaId]
                const localData = savedData[item.balitaId]
                const displayBb = localData?.bb ?? item.pemeriksaan?.[0]?.beratBadan?.toString() ?? '—'
                const displayTb = localData?.tb ?? item.pemeriksaan?.[0]?.tinggiBadan?.toString() ?? '—'
                return (
                  <button
                    key={item.id}
                    onClick={() => !done && handlePilihBalita(item)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition ${
                      done
                        ? 'border-green-200 bg-green-50 opacity-70 cursor-default'
                        : 'border-gray-200 bg-white hover:border-green-400 hover:bg-green-50 active:scale-95'
                    }`}
                  >
                    <span className="text-gray-400 text-sm w-8 text-center font-bold">
                      #{String(item.nomorUrut).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <p className="text-gray-800 text-sm font-semibold">{item.balita.namaBalita}</p>
                      {done && (
                        <p className="text-green-600 text-xs mt-0.5 font-medium">
                          ✓ BB: {displayBb} kg · TB: {displayTb} cm
                        </p>
                      )}
                    </div>
                    {done
                      ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                      : <span className="text-gray-400 text-xs font-semibold">Pilih →</span>
                    }
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowEndConfirm(true)}
              className="px-5 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold"
            >
              Selesai Meja 2
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Numpad BB/TB ──────────────────────────────────────────── */}
      {balitaId && (
        <div className="flex-1 flex flex-col">
          {/* Balita sub-header */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-gray-800 text-sm font-bold">{namaBalita}</p>
            </div>
            <button
              onClick={handleKembaliKeDaftar}
              className="p-2 rounded-xl bg-gray-100"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          {/* BB / TB field display */}
          <div className="px-4 py-4 flex gap-3">
            <button
              onClick={() => setActiveField('bb')}
              className={`flex-1 p-3 rounded-2xl border-2 text-left transition ${
                activeField === 'bb' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <p className="text-gray-400 text-xs mb-1">Berat Badan (kg)</p>
              <p className={`text-2xl font-extrabold ${activeField === 'bb' ? 'text-green-600' : 'text-gray-700'}`}>
                {bbStr || '—'}
              </p>
              {activeField === 'bb' && (
                <div className="w-0.5 h-4 bg-green-500 animate-pulse inline-block ml-0.5" />
              )}
            </button>
            <button
              onClick={() => setActiveField('tb')}
              className={`flex-1 p-3 rounded-2xl border-2 text-left transition ${
                activeField === 'tb' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <p className="text-gray-400 text-xs mb-1">Tinggi Badan (cm)</p>
              <p className={`text-2xl font-extrabold ${activeField === 'tb' ? 'text-green-600' : 'text-gray-700'}`}>
                {tbStr || '—'}
              </p>
              {activeField === 'tb' && (
                <div className="w-0.5 h-4 bg-green-500 animate-pulse inline-block ml-0.5" />
              )}
            </button>
          </div>

          {/* Keypad */}
          <div className="px-4 flex-1">
            <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
              <p className="text-gray-400 text-xs text-center mb-3">
                Input angka via kalkulator (tanpa keyboard QWERTY)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {KEYS.map((key) => {
                  const isBackspace = key === '⌫'
                  const isDot = key === '.'
                  return (
                    <button
                      key={key}
                      onClick={() => (isBackspace ? handleBackspace() : handleKey(key))}
                      className={`h-14 rounded-2xl text-xl font-bold flex items-center justify-center active:scale-90 transition-transform ${
                        isBackspace
                          ? 'bg-red-50 text-red-500 border border-red-200'
                          : isDot
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-white text-gray-800 border border-gray-200 shadow-sm hover:bg-gray-50'
                      }`}
                    >
                      {isBackspace ? <Delete size={20} /> : key}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => setActiveField(activeField === 'bb' ? 'tb' : 'bb')}
                  className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold"
                >
                  Pindah ke {activeField === 'bb' ? 'Tinggi Badan' : 'Berat Badan'}
                </button>
                <button
                  onClick={handleSimpan}
                  disabled={!isBothFilled || isSaving}
                  className="py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold shadow-md flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  Simpan Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Validation warning modal ──────────────────────────────────────── */}
      {showKonfirmasi && konfirmasiInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={20} className="text-amber-500" />
              <p className="text-gray-800 font-bold">Angka di Luar Batas Biologis Wajar</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
              <p className="text-amber-700 text-sm">
                {konfirmasiInfo.field}:{' '}
                <span className="font-bold">{konfirmasiInfo.value}</span>
              </p>
              <p className="text-amber-600 text-xs mt-1">{konfirmasiInfo.suggestion}</p>
              <p className="text-amber-600 text-xs mt-1">
                Apakah Anda yakin data ini benar? Angka abnormal akan diblokir untuk menjaga akurasi grafik Z-Score.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowKonfirmasi(false)}
                className="py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold"
              >
                Koreksi Angka
              </button>
              <Button
                onClick={() => void doSubmit(true)}
                disabled={isSaving}
                className="py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold h-auto"
              >
                {isSaving
                  ? <Loader2 size={14} className="animate-spin mx-auto" />
                  : 'Yakin, Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── End confirm modal ─────────────────────────────────────────────── */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="text-gray-800 font-bold mb-2">Selesai Pelayanan Meja 2?</p>
            <p className="text-gray-500 text-sm mb-4">
              {dipanggilList.length - Object.keys(savedData).length} balita belum diinput datanya.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleKeluarMeja}
                className="py-3 bg-red-600 text-white rounded-xl text-sm font-semibold"
              >
                Ya, Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save success toast ────────────────────────────────────────────── */}
      {showSaveSuccess && (
        <div className="fixed bottom-6 left-4 right-4 bg-green-600 text-white rounded-2xl p-4 flex items-center gap-3 shadow-lg z-50">
          <CheckCircle size={20} />
          <p className="text-sm font-semibold">Data BB/TB berhasil disimpan!</p>
        </div>
      )}

      <TukarMejaModal
        open={showTukarMeja}
        onClose={() => setShowTukarMeja(false)}
        slotId={activeSlotId}
      />
    </div>
  )
}
