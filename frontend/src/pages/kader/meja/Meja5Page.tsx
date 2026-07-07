/**
 * Meja5Page — Meja 5: Imunisasi
 * Figma: node 5:11874, 5:12010, 5:12441
 *
 * Flow:
 *   1. Tampilkan riwayat imunisasi balita aktif
 *   2. Inline form "Tambah Imunisasi Hari Ini" (namaVaksin + dosisKe)
 *   3. "Selesai Pelayanan" → selesaikanAntrian → navigate ke /kader/rekap
 *
 * State source: router state dari Meja4Page
 *   { antrianId, balitaId, namaBalita, pemeriksaanId }
 * slotId: from useKaderMejaStore.activeSlotId
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Plus, Syringe, Loader2, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import apiClient from '@/lib/axios'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import { generateTempId } from '@/lib/offline-db'
import { TukarMejaModal } from '@/components/kader/TukarMejaModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ImunisasiItem {
  id: string
  namaVaksin: string
  dosisKe: number
  tanggalInjeksi: string
  keterangan?: string | null
}

interface SelesaiResult {
  antrianId: string
  durasiLayananBaru: number
  durasiRataAktual: number
}

// ── Vaksin options (standar Kemenkes) ──────────────────────────────────────────

const VAKSIN_OPTIONS = [
  'BCG',
  'Hepatitis B',
  'Polio (OPV)',
  'Polio (IPV)',
  'DPT-HB-Hib',
  'Campak-Rubella (MR)',
  'DPT Lanjutan',
  'Campak-Rubella Lanjutan',
  'Japanese Encephalitis',
  'Vitamin A',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTanggal(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Meja5Page() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { activeSlotId, setActiveMeja, setActivePemeriksaanId, setLocked } = useKaderMejaStore()
  const isOnline = useOfflineStatus()
  const { enqueueOperation } = useOfflineSync()

  const [showTukarMeja, setShowTukarMeja] = useState(false)

  // Two-step: step 1 = select balita, step 2 = imunisasi UI
  const [selectedAntrianId, setSelectedAntrianId] = useState<string | undefined>(undefined)
  const [selectedBalitaId, setSelectedBalitaId] = useState<string | null>(null)
  const [selectedNama, setSelectedNama] = useState('')

  // Aliases untuk kode di bawah
  const antrianId = selectedAntrianId
  const balitaId = selectedBalitaId
  const namaBalita = selectedNama

  // Kembali ke Step 1 (daftar) tanpa keluar meja
  const handleKembaliKeDaftar = () => {
    setSelectedAntrianId(undefined)
    setSelectedBalitaId(null)
    setSelectedNama('')
  }

  // Guard: require activeSlotId
  useEffect(() => {
    if (!activeSlotId) {
      navigate('/kader/dashboard', { replace: true })
    }
  }, [activeSlotId, navigate])

  // Step 1: hadirList query
  const { data: antrianList = [], isLoading: hadirListLoading } = useQuery<Array<{
    id: string; nomorUrut: number; statusAntrian: string; balitaId: string;
    balita: { namaBalita: string }
  }>>({
    queryKey: ['antrian', 'kader', activeSlotId],
    queryFn: () =>
      apiClient.get(`/kader/slot/${activeSlotId}/antrian`).then((r) => r.data.data),
    enabled: !selectedAntrianId && !!activeSlotId,
  })
  const hadirList = antrianList.filter(
    (a) => ['dipanggil', 'sedang_dilayani', 'selesai'].includes(a.statusAntrian),
  )

  // ── All hooks before any return ────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [namaVaksin, setNamaVaksin] = useState('')
  const [dosisKe, setDosisKe] = useState('1')

  const { data: riwayat = [], isLoading: riwayatLoading } = useQuery<ImunisasiItem[]>({
    queryKey: ['imunisasi', balitaId],
    queryFn: () =>
      apiClient.get(`/immunization/balita/${balitaId}`).then((r) => r.data.data as ImunisasiItem[]),
    enabled: !!balitaId,
  })

  const todayCount = riwayat.filter((i) => isToday(i.tanggalInjeksi)).length
  const doneCount = riwayat.length

  const tambahMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/immunization', {
        balitaId,
        namaVaksin,
        dosisKe: parseInt(dosisKe, 10),
        tanggalInjeksi: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imunisasi', balitaId] })
      setShowForm(false)
      setNamaVaksin('')
      setDosisKe('1')
      toast({ title: 'Imunisasi dicatat', description: `${namaVaksin} dosis ${dosisKe} berhasil disimpan.` })
      // Tetap di detail pasien — kader bisa tambah imunisasi lagi
    },
    onError: () => {
      toast({ title: 'Gagal menyimpan', description: 'Coba lagi.', variant: 'destructive' })
    },
  })

  const selesaiMutation = useMutation<SelesaiResult, Error>({
    mutationFn: async () => {
      const response = await apiClient.patch(`/antrian/${antrianId}/selesai`)
      return (response.data as { data: SelesaiResult }).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', activeSlotId] })
      toast({ title: 'Pelayanan selesai', description: `${namaBalita} telah selesai dilayani.` })
      handleKembaliKeDaftar()
    },
    onError: (err) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  // ── Offline handlers ──────────────────────────────────────────────────────

  async function handleTambahImunisasi() {
    // WR-05: Guard balitaId — null propagates to immunization API (422) or offline queue
    if (!balitaId) {
      toast({ description: 'Data balita tidak ditemukan. Kembali ke Meja 1.', variant: 'destructive' })
      return
    }

    if (!isOnline) {
      try {
        await enqueueOperation('meja5', {
          id: generateTempId(),
          type: 'immunization' as const,
          data: {
            balitaId,
            namaVaksin,
            dosisKe: parseInt(dosisKe, 10),
            tanggalInjeksi: new Date().toISOString(),
          },
          timestamp: Date.now(),
        })
        toast({ description: 'Tersimpan lokal, akan sync saat online' })
        setShowForm(false)
        setNamaVaksin('')
        setDosisKe('1')
      } catch {
        // WR-03: IDB unavailable or quota exceeded — warn kader
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }
    tambahMutation.mutate()
  }

  async function handleSelesai() {
    if (!isOnline) {
      try {
        await enqueueOperation('meja5', {
          id: generateTempId(),
          type: 'selesai' as const,
          data: {
            antrianId,
            slotId: activeSlotId,
          },
          timestamp: Date.now(),
        })
        toast({ description: 'Tersimpan lokal, akan sync saat online' })
        handleKembaliKeDaftar()
      } catch {
        // WR-03: IDB unavailable or quota exceeded — warn kader
        toast({ description: 'Gagal simpan offline — coba lagi', variant: 'destructive' })
      }
      return
    }
    selesaiMutation.mutate()
  }

  // Exit seluruh meja — dipanggil dari Step 1 "Selesai Meja 5"
  const handleKeluarMeja = async () => {
    try { await apiClient.delete('/kader/active-meja') } catch (e) {
      if (import.meta.env.DEV) console.warn('[Meja5] Failed to clear active-meja:', e)
    }
    setLocked(false)
    setActiveMeja(null, null)
    setActivePemeriksaanId(null)
    navigate('/kader/rekap', { state: { slotId: activeSlotId }, replace: true })
  }

  // Guard: activeSlotId wajib ada — useEffect handles navigation above
  if (!activeSlotId) return null

  // ── Step 1: select balita ──────────────────────────────────────────────────
  if (!selectedAntrianId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-[#e17100] px-4 pt-10 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Syringe size={16} className="text-white" />
              <div>
                <p className="text-white font-bold text-sm">MEJA 5 — Imunisasi</p>
                <p className="text-[#fee685] text-xs">Pilih balita untuk imunisasi</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SyncPendingBadge />
              <button onClick={() => setShowTukarMeja(true)} className="bg-[rgba(254,154,0,0.6)] border border-[rgba(255,185,0,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium">
                Tukar Meja
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">Pilih balita untuk imunisasi:</p>
          {hadirListLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : hadirList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 text-center">
              <p className="text-sm text-amber-700 font-semibold mb-1">Belum ada balita hadir</p>
              <p className="text-xs text-gray-400">Tandai kehadiran di Meja 1 terlebih dahulu.</p>
            </div>
          ) : (
            hadirList.map((item) => {
              const done = item.statusAntrian === 'selesai'
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedAntrianId(item.id)
                    setSelectedBalitaId(item.balitaId)
                    setSelectedNama(item.balita.namaBalita)
                  }}
                  className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm active:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#99a1af] text-xs font-semibold w-6">{String(item.nomorUrut).padStart(2, '0')}</span>
                    <p className={`font-bold text-sm ${done ? 'text-gray-400' : 'text-[#1e2939]'}`}>{item.balita.namaBalita}</p>
                  </div>
                  <CheckCircle size={16} className={done ? 'text-green-500 flex-shrink-0' : 'text-gray-300 flex-shrink-0'} />
                </button>
              )
            })
          )}
        </div>

        <div className="bg-white border-t border-gray-100 p-4">
          <Button
            variant="ghost"
            className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] font-semibold rounded-2xl h-12 hover:bg-red-50"
            onClick={() => void handleKeluarMeja()}
          >
            <LogOut size={16} className="mr-2" />Selesai Meja 5
          </Button>
        </div>
        <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId ?? ''} />
      </div>
    )
  }

  // ── Step 2: imunisasi for selected balita ──────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header — orange sesuai Figma */}
      <div className="bg-[#e17100] px-4 pt-10 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Syringe size={16} className="text-white" />
            <div>
              <p className="text-white font-bold text-sm">MEJA 5 — Imunisasi</p>
              <p className="text-[#fee685] text-xs">Catat &amp; rekam riwayat imunisasi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncPendingBadge />
            <button
              onClick={() => setShowTukarMeja(true)}
              className="bg-[rgba(254,154,0,0.6)] border border-[rgba(255,185,0,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium"
            >
              Tukar Meja
            </button>
          </div>
        </div>
      </div>

      {/* Sub-header — nama balita */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-[#1e2939] text-sm">{namaBalita}</p>
        </div>
        <button
          onClick={handleKembaliKeDaftar}
          className="text-[#99a1af] text-xs font-medium"
        >
          ← Kembali
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Riwayat imunisasi card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="font-bold text-[#364153] text-sm">Riwayat Imunisasi</p>
            {!riwayatLoading && (
              <p className="text-[#e17100] text-xs font-medium">{doneCount} vaksin tercatat</p>
            )}
          </div>

          {/* Vaccine list */}
          {riwayatLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : riwayat.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">Belum ada riwayat imunisasi</p>
            </div>
          ) : (
            riwayat.map((item, idx) => {
              const today = isToday(item.tanggalInjeksi)
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 ${idx < riwayat.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${today ? 'bg-blue-50' : 'bg-[#dcfce7]'}`}>
                    {today
                      ? <Plus size={14} className="text-blue-500" />
                      : <CheckCircle size={14} className="text-[#008236]" />
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#364153]">
                      {item.namaVaksin} — Dosis {item.dosisKe}
                    </p>
                    <p className="text-xs text-[#99a1af]">{formatTanggal(item.tanggalInjeksi)}</p>
                  </div>
                  {/* Badge */}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    today
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-[#dcfce7] text-[#008236]'
                  }`}>
                    {today ? 'Hari ini' : '✓'}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Tambah imunisasi */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full border-2 border-dashed border-[#ffd230] rounded-2xl py-3 flex items-center justify-center gap-2 text-[#e17100] text-sm font-semibold"
          >
            <Plus size={16} />
            Catat Imunisasi Hari Ini
          </button>
        ) : (
          <div className="bg-white border border-[#fee685] rounded-2xl shadow-sm p-4 space-y-3">
            <p className="font-bold text-[#364153] text-sm">Tambah Imunisasi Hari Ini</p>

            {/* Nama vaksin */}
            <div>
              <label className="text-xs font-medium text-[#4a5565] block mb-1">Nama Vaksin</label>
              <select
                value={namaVaksin}
                onChange={(e) => setNamaVaksin(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e17100]"
              >
                <option value="">-- Pilih vaksin --</option>
                {VAKSIN_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Dosis */}
            <div>
              <label className="text-xs font-medium text-[#4a5565] block mb-1">Dosis ke-</label>
              <select
                value={dosisKe}
                onChange={(e) => setDosisKe(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e17100]"
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>Dosis ke-{d}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => { setShowForm(false); setNamaVaksin(''); setDosisKe('1') }}
                className="border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-[#4a5565]"
              >
                Batal
              </button>
              <button
                disabled={!namaVaksin || !balitaId || tambahMutation.isPending}
                onClick={handleTambahImunisasi}
                className="bg-[#e17100] rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {tambahMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Tambahkan
              </button>
            </div>
          </div>
        )}

        {/* Info hari ini */}
        {todayCount > 0 && (
          <p className="text-xs text-center text-[#e17100]">
            {todayCount} imunisasi dicatat hari ini
          </p>
        )}
      </div>

      {/* Footer — Selesai Pasien Ini (kembali ke daftar setelah selesai) */}
      <div className="bg-white border-t border-gray-100 p-4">
        <Button
          variant="ghost"
          className="w-full bg-[#fef2f2] border border-[#ffc9c9] text-[#e7000b] font-semibold rounded-2xl h-12 hover:bg-red-50"
          onClick={handleSelesai}
          disabled={selesaiMutation.isPending}
        >
          {selesaiMutation.isPending
            ? <><Loader2 size={16} className="animate-spin mr-2" />Memproses...</>
            : <><CheckCircle size={16} className="mr-2" />Selesai Pasien Ini</>
          }
        </Button>
      </div>
      <TukarMejaModal open={showTukarMeja} onClose={() => setShowTukarMeja(false)} slotId={activeSlotId ?? ''} />
    </div>
  )
}
