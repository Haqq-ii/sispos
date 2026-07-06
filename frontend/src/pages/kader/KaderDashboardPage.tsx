/**
 * KaderDashboardPage — Figma Make KaderDashboard alignment
 *
 * Layout:
 *   - Green header (bg-green-700): "Dashboard Kader" label, kader name, KETUA badge,
 *     Quick Stats grid (3 cols, bg-white/15) INSIDE header
 *   - Pelayanan button card (-mt-3)
 *   - Tabs: Ringkasan | Data Balita | Absensi (useState-based)
 *     Ringkasan: Jadwal card + BarChart (tren) + PieChart (distribusi) + Peringatan Risiko
 *
 * Data sources:
 *   - GET /api/kader/today-slots → jadwal + slot info
 *   - GET /api/kader/dashboard-stats → stats + charts + risk table
 *
 * KRITIS: useActiveMeja redirect useEffect TIDAK BOLEH dihapus (lock-screen feature)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, AlertTriangle, Download } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

import { Skeleton } from '@/components/ui/skeleton'
import { useActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePwaStore } from '@/stores/usePwaStore'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import apiClient from '@/lib/axios'

// ── Interfaces ────────────────────────────────────────────────────────────

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

interface KaderDashboardStats {
  posyanduNama: string
  totalBalita: number
  risikoStunting: number
  hadirHariIni: number
  trenGiziBulanan: Array<{
    bulan: string
    normal: number
    kurang: number
    buruk: number
    pendek: number
  }>
  distribusiGiziBulanIni: {
    normal: number
    kurang: number
    buruk: number
    pendek: number
  }
  peringatanRisiko: Array<{
    balitaId: string
    namaBalita: string
    zScoreBbU: number | null
    zScoreTbU: number | null
    statusGizi: string
  }>
}

// ── Helper ────────────────────────────────────────────────────────────────

function statusGiziBadgeClass(status: string): string {
  const map: Record<string, string> = {
    normal: 'bg-[#dcfce7] text-[#16a34a]',
    kurang: 'bg-[#fef9c3] text-[#ca8a04]',
    buruk: 'bg-[#fee2e2] text-[#e7000b]',
    pendek: 'bg-[#ffedd5] text-[#f97316]',
    sangat_pendek: 'bg-[#fee2e2] text-[#e7000b]',
    lebih: 'bg-[#fef9c3] text-[#ca8a04]',
    obesitas: 'bg-[#fee2e2] text-[#e7000b]',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

function formatTanggal(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────

export default function KaderDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { setActiveMeja, setLocked } = useKaderMejaStore()
  const { deferredPrompt, triggerInstall } = usePwaStore()
  const showInstall =
    deferredPrompt !== null &&
    !(window.matchMedia?.('(display-mode: standalone)')?.matches ?? false)

  const [activeTab, setActiveTab] = useState<'overview' | 'balita' | 'absensi'>('overview')

  // Lock-screen redirect (KRITIS — jangan hapus)
  const { data: activeMejaData, isLoading: isLoadingActiveMeja } = useActiveMeja()

  // Today's jadwal + slots
  const { data: todayJadwal, isLoading: isLoadingJadwal } = useQuery<TodayJadwal | null>({
    queryKey: ['kader', 'today-slots'],
    queryFn: () =>
      apiClient.get('/kader/today-slots').then((r) => r.data.data as TodayJadwal | null),
    staleTime: 30_000,
  })

  // Dashboard stats
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery<KaderDashboardStats>({
    queryKey: ['kader', 'dashboard-stats'],
    queryFn: () =>
      apiClient.get('/kader/dashboard-stats').then((r) => r.data.data as KaderDashboardStats),
    staleTime: 60_000,
  })

  // KRITIS: auto-redirect kader ke meja aktif saat dashboard load (lock-screen feature)
  useEffect(() => {
    if (!isLoadingActiveMeja && activeMejaData) {
      setActiveMeja(activeMejaData.activeMeja, activeMejaData.slotId)
      setLocked(true)
      navigate(`/kader/meja/${activeMejaData.activeMeja}`, { replace: true })
    }
  }, [isLoadingActiveMeja, activeMejaData, navigate, setActiveMeja, setLocked])

  const isLoading = isLoadingActiveMeja || isLoadingJadwal || isLoadingStats

  // Pie chart data
  const distribusiData = dashboardStats
    ? [
        { name: 'Normal', value: dashboardStats.distribusiGiziBulanIni.normal, color: '#15803d' },
        { name: 'Kurang', value: dashboardStats.distribusiGiziBulanIni.kurang, color: '#f59e0b' },
        { name: 'Buruk', value: dashboardStats.distribusiGiziBulanIni.buruk, color: '#ef4444' },
        { name: 'Pendek', value: dashboardStats.distribusiGiziBulanIni.pendek, color: '#d1d5db' },
      ]
    : []

  // First slot for jadwal display
  const firstSlot = todayJadwal?.slotSesi?.[0]

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-green-700 px-5 pt-10 md:pt-6 pb-6">

        {/* Top row: labels + install */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-green-300 text-xs font-medium mb-0.5">Dashboard Kader</p>
            <p className="text-white font-bold text-lg leading-tight">
              {user?.namaLengkap ?? 'Kader'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-green-200 text-xs">{dashboardStats?.posyanduNama ?? 'Posyandu Anda'}</p>
              {user?.role === 'ketua_kader' && (
                <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  KETUA
                </span>
              )}
            </div>
            <div className="mt-1.5">
              <SyncPendingBadge />
            </div>
          </div>
          {showInstall && (
            <button
              onClick={() => { void triggerInstall() }}
              className="bg-white/20 border border-white/30 rounded-xl px-3 py-1.5 text-white text-xs font-medium flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Pasang
            </button>
          )}
        </div>

        {/* Quick stats — 3 cols inside header */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl opacity-40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white text-xl font-extrabold leading-none">
                {dashboardStats?.totalBalita ?? '—'}
              </p>
              <p className="text-green-200 text-xs mt-1 leading-tight">Total<br />Balita</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-amber-300 text-xl font-extrabold leading-none">
                {dashboardStats?.risikoStunting ?? '—'}
              </p>
              <p className="text-green-200 text-xs mt-1 leading-tight">Risiko<br />Stunting</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white text-xl font-extrabold leading-none">
                {dashboardStats?.hadirHariIni ?? '—'}
              </p>
              <p className="text-green-200 text-xs mt-1 leading-tight">Hadir<br />Hari Ini</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 -mt-3">

        {/* Pelayanan button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/kader/pelayanan')}
            className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-95 transition-transform"
          >
            <div className="text-left">
              <p className="text-gray-800 text-sm font-bold">Mulai Pelayanan Hari-H</p>
              <p className="text-gray-400 text-xs mt-0.5">
                {todayJadwal
                  ? `${todayJadwal.slotSesi.length} sesi tersedia · Pilih meja tugas`
                  : 'Pilih meja tugas & aktifkan Lock-Screen'}
              </p>
            </div>
            <div className="w-8 h-8 bg-green-700 rounded-xl flex items-center justify-center flex-shrink-0">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4">
          <div className="flex bg-white rounded-xl p-1 border border-gray-100 shadow-sm">
            {(
              [
                { key: 'overview', label: 'Ringkasan' },
                { key: 'balita', label: 'Data Balita' },
                { key: 'absensi', label: 'Absensi' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors',
                  activeTab === tab.key
                    ? 'bg-green-700 text-white'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Ringkasan tab ────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-3 pb-6">

            {/* Jadwal card */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-[#99a1af] text-xs font-semibold tracking-wider uppercase mb-2">
                Jadwal Pelayanan
              </p>
              {isLoadingJadwal ? (
                <Skeleton className="h-10 rounded-xl" />
              ) : !todayJadwal ? (
                <p className="text-xs text-gray-400">Tidak ada jadwal hari ini</p>
              ) : (
                <div>
                  <p className="text-[#1e2939] font-semibold text-sm">
                    {formatTanggal(todayJadwal.tanggalPelaksanaan)}
                  </p>
                  {firstSlot && (
                    <p className="text-gray-400 text-xs mt-0.5">
                      {firstSlot.jamMulai} – {firstSlot.jamSelesai} WIB · {firstSlot.labelSesi}
                    </p>
                  )}
                  {firstSlot && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600 rounded-full transition-all"
                          style={{
                            width: firstSlot.kuota > 0
                              ? `${Math.min(100, Math.round((firstSlot.terisi / firstSlot.kuota) * 100))}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {firstSlot.terisi}/{firstSlot.kuota} terdaftar
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tren Status Gizi — BarChart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[#99a1af] text-xs font-semibold tracking-wider uppercase mb-3">
                Tren Status Gizi
              </p>
              {isLoadingStats ? (
                <Skeleton className="h-[150px] rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={dashboardStats?.trenGiziBulanan ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} width={24} />
                    <Tooltip />
                    <Bar dataKey="normal" fill="#15803d" name="Normal" />
                    <Bar dataKey="kurang" fill="#f59e0b" name="Kurang" />
                    <Bar dataKey="buruk" fill="#ef4444" name="Buruk" />
                    <Bar dataKey="pendek" fill="#d1d5db" name="Pendek" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status Gizi Bulan Ini — PieChart donut */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[#99a1af] text-xs font-semibold tracking-wider uppercase mb-3">
                Status Gizi Bulan Ini
              </p>
              {isLoadingStats ? (
                <Skeleton className="h-[120px] rounded-xl" />
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={100}>
                    <PieChart>
                      <Pie
                        data={distribusiData}
                        cx="50%"
                        cy="50%"
                        innerRadius={32}
                        outerRadius={50}
                        dataKey="value"
                      >
                        {distribusiData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {distribusiData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-xs text-gray-600">{item.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-800">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Peringatan Risiko Stunting */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                <p className="text-amber-800 text-xs font-bold tracking-wider uppercase">
                  Peringatan Risiko Stunting
                </p>
              </div>
              {isLoadingStats ? (
                <Skeleton className="h-16 rounded-xl" />
              ) : !dashboardStats || dashboardStats.peringatanRisiko.length === 0 ? (
                <p className="text-amber-600 text-xs text-center py-2">
                  Belum ada data risiko stunting
                </p>
              ) : (
                <div className="space-y-0">
                  {dashboardStats.peringatanRisiko.map((item) => (
                    <div
                      key={item.balitaId}
                      className="flex items-center justify-between py-2.5 border-b border-amber-100 last:border-0"
                    >
                      <div>
                        <p className="text-[#1e2939] text-sm font-semibold">{item.namaBalita}</p>
                        <p className="text-amber-600 text-xs">
                          BB/U: {item.zScoreBbU != null ? item.zScoreBbU.toFixed(1) : '–'} SD
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusGiziBadgeClass(item.statusGizi)}`}
                      >
                        {item.statusGizi.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── Data Balita tab ──────────────────────────────────────── */}
        {activeTab === 'balita' && (
          <div className="pb-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-[#99a1af] text-xs">
                Data lengkap balita tersedia di sistem Puskesmas.
              </p>
            </div>
          </div>
        )}

        {/* ── Absensi tab ──────────────────────────────────────────── */}
        {activeTab === 'absensi' && (
          <div className="pb-6">
            {/* Stats mini cards */}
            {isLoadingStats ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-green-700 font-bold text-xl leading-none">
                    {dashboardStats?.hadirHariIni ?? 0}
                  </p>
                  <p className="text-gray-400 text-[10px] mt-1">Hadir</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-amber-500 font-bold text-xl leading-none">
                    {dashboardStats
                      ? Math.max(0, dashboardStats.totalBalita - dashboardStats.hadirHariIni)
                      : 0}
                  </p>
                  <p className="text-gray-400 text-[10px] mt-1">Belum</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-gray-400 font-bold text-xl leading-none">—</p>
                  <p className="text-gray-400 text-[10px] mt-1">Tdk Hadir</p>
                </div>
              </div>
            )}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="text-[#99a1af] text-xs">
                Detail absensi tersedia di rekap harian.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
