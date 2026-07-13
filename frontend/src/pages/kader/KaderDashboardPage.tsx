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
import { ChevronRight, AlertTriangle, Download, Info } from 'lucide-react'
import {
  LineChart,
  Line,
  Legend,
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
    sangatPendek: number
    pendek: number
    normalTbU: number
    tinggi: number
    obesitas: number
    giziLebih: number
    berisikoGiziLebih: number
    normalBbTb: number
    kurangBbTb: number
  }>
  distribusiGiziBulanIni: {
    normal: number
    kurang: number
    buruk: number
    pendek: number
  }
  distribusiTbUBulanIni?: {
    sangatPendek: number
    pendek: number
    normal: number
    tinggi: number
  }
  distribusiBbTbBulanIni?: {
    kurang: number
    normal: number
    berisikoGiziLebih: number
    giziLebih: number
    obesitas: number
  }
  peringatanRisiko: Array<{
    balitaId: string
    namaBalita: string
    zScoreBbU: number | null
    zScoreTbU: number | null
    statusGizi: string
  }>
  daftarBalita: Array<{
    balitaId: string
    namaBalita: string
    nikBalita: string | null
    tanggalLahir: string
    jenisKelamin: string
    usiaMonths: number
    zScoreBbU: number | null
    zScoreTbU: number | null
    statusGizi: string | null
    beratBadan: number | null
    tinggiBadan: number | null
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

function getPercent(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 1000) / 10
}

function formatPercentTooltip(
  value: unknown,
  name: unknown,
  item: { dataKey?: unknown; payload?: Record<string, number> }
): [string, string] {
  const pct = typeof value === 'number' ? value : Number(value ?? 0)
  const dataKey = typeof item.dataKey === 'string' ? item.dataKey : ''
  const countKey = dataKey.endsWith('Pct') ? dataKey.slice(0, -3) : dataKey
  const payload = item.payload ?? {}
  const count = payload[countKey] ?? 0
  const total = payload.total ?? 0
  const label = typeof name === 'string' ? name : String(name ?? '')
  return [`${pct.toFixed(1)}% (${count}/${total})`, label]
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
  const [balitaSearch, setBalitaSearch] = useState('')
  const [balitaSort, setBalitaSort] = useState<'az' | 'za' | 'zscore-asc' | 'zscore-desc'>('az')
  const [balitaFilterGizi, setBalitaFilterGizi] = useState<string>('semua')
  const [balitaFilterGender, setBalitaFilterGender] = useState<string>('semua')
  const [trendMetric, setTrendMetric] = useState<'tbu' | 'bbtb'>('tbu')

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

  // Pie chart follows the same indicator selector as the monthly trend.
  const distribusiData = dashboardStats
    ? trendMetric === 'tbu'
      ? [
          { name: 'Sangat Pendek', value: dashboardStats.distribusiTbUBulanIni?.sangatPendek ?? 0, color: '#dc2626' },
          { name: 'Pendek', value: dashboardStats.distribusiTbUBulanIni?.pendek ?? 0, color: '#f97316' },
          { name: 'Normal', value: dashboardStats.distribusiTbUBulanIni?.normal ?? 0, color: '#16a34a' },
          { name: 'Tinggi', value: dashboardStats.distribusiTbUBulanIni?.tinggi ?? 0, color: '#0ea5e9' },
        ]
      : [
          { name: 'Wasting/Kurang', value: dashboardStats.distribusiBbTbBulanIni?.kurang ?? 0, color: '#64748b' },
          { name: 'Normal', value: dashboardStats.distribusiBbTbBulanIni?.normal ?? 0, color: '#16a34a' },
          { name: 'Berisiko', value: dashboardStats.distribusiBbTbBulanIni?.berisikoGiziLebih ?? 0, color: '#f59e0b' },
          { name: 'Lebih', value: dashboardStats.distribusiBbTbBulanIni?.giziLebih ?? 0, color: '#f97316' },
          { name: 'Obesitas', value: dashboardStats.distribusiBbTbBulanIni?.obesitas ?? 0, color: '#dc2626' },
        ]
    : []
  const donutTitle = trendMetric === 'tbu' ? 'Proporsi TB/U Bulan Ini' : 'Proporsi BB/TB Bulan Ini'
  const trendLines = trendMetric === 'tbu'
    ? [
        { key: 'sangatPendek', name: 'Sangat Pendek', color: '#dc2626' },
        { key: 'pendek', name: 'Pendek', color: '#f97316' },
        { key: 'normalTbU', name: 'Normal', color: '#16a34a' },
        { key: 'tinggi', name: 'Tinggi', color: '#0ea5e9' },
      ]
    : [
        { key: 'kurangBbTb', name: 'Wasting/Kurang', color: '#64748b' },
        { key: 'normalBbTb', name: 'Normal', color: '#16a34a' },
        { key: 'berisikoGiziLebih', name: 'Berisiko', color: '#f59e0b' },
        { key: 'giziLebih', name: 'Lebih', color: '#f97316' },
        { key: 'obesitas', name: 'Obesitas', color: '#dc2626' },
      ]
  const trendData = (dashboardStats?.trenGiziBulanan ?? []).map((row) => {
    const totalTbU = row.sangatPendek + row.pendek + row.normalTbU + row.tinggi
    const totalBbTb = row.kurangBbTb + row.normalBbTb + row.berisikoGiziLebih + row.giziLebih + row.obesitas
    const total = trendMetric === 'tbu' ? totalTbU : totalBbTb
    return {
      ...row,
      total,
      sangatPendekPct: getPercent(row.sangatPendek, totalTbU),
      pendekPct: getPercent(row.pendek, totalTbU),
      normalTbUPct: getPercent(row.normalTbU, totalTbU),
      tinggiPct: getPercent(row.tinggi, totalTbU),
      kurangBbTbPct: getPercent(row.kurangBbTb, totalBbTb),
      normalBbTbPct: getPercent(row.normalBbTb, totalBbTb),
      berisikoGiziLebihPct: getPercent(row.berisikoGiziLebih, totalBbTb),
      giziLebihPct: getPercent(row.giziLebih, totalBbTb),
      obesitasPct: getPercent(row.obesitas, totalBbTb),
    }
  })


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
              <p className="text-green-200 text-xs mt-1 leading-tight">Balita<br />Terdaftar</p>
              <button
                type="button"
                onClick={() => alert(
                  'Balita Terdaftar: jumlah balita yang terdaftar di posyandu ini (termasuk yang tidak hadir).\n\n' +
                  'Berbeda dengan "Total Balita" di laporan e-PPGBM yang hanya menghitung balita yang diperiksa pada bulan berjalan.'
                )}
                className="text-green-300 mt-0.5 mx-auto block"
                title="Info definisi Balita Terdaftar"
                aria-label="Info definisi Balita Terdaftar"
              >
                <Info size={9} />
              </button>
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

            {/* Tren Status Gizi - LineChart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[#99a1af] text-xs font-semibold tracking-wider uppercase">
                    Tren Status Gizi (%)
                  </p>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    6 bulan terakhir berdasarkan z-score
                  </p>
                </div>
                <div className="flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTrendMetric('tbu')}
                    className={`px-2 py-1 text-[10px] font-semibold rounded-md transition ${trendMetric === 'tbu' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
                  >
                    TB/U
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetric('bbtb')}
                    className={`px-2 py-1 text-[10px] font-semibold rounded-md transition ${trendMetric === 'bbtb' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
                  >
                    BB/TB
                  </button>
                </div>
              </div>
              {isLoadingStats ? (
                <Skeleton className="h-[170px] rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} width={36} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={formatPercentTooltip} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {trendLines.map((line) => (
                      <Line
                        key={line.key}
                        type="monotone"
                        dataKey={`${line.key}Pct`}
                        stroke={line.color}
                        name={line.name}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status Gizi Bulan Ini — PieChart donut */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[#99a1af] text-xs font-semibold tracking-wider uppercase mb-3">
                {donutTitle}
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
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-xs text-gray-600">{item.name}</span>
                        </div>
                        <span className="flex-shrink-0 text-xs font-semibold text-gray-800">{item.value}</span>
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
          <div className="pb-6 space-y-2">
            {/* Search */}
            <div className="flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 shadow-sm">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <circle cx="6" cy="6" r="5" stroke="#9ca3af" strokeWidth="1.5" />
                <path d="M10.5 10.5L13 13" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Cari nama atau NIK..."
                value={balitaSearch}
                onChange={(e) => setBalitaSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
              />
              {balitaSearch && (
                <button onClick={() => setBalitaSearch('')} className="text-gray-400 hover:text-gray-600">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort chips */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {([ ['az','A–Z'], ['za','Z–A'], ['zscore-asc','Risiko ↑'], ['zscore-desc','Risiko ↓'] ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setBalitaSort(val)}
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    balitaSort === val
                      ? 'bg-[#008236] text-white border-[#008236]'
                      : 'bg-white text-gray-600 border-[#e5e7eb]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Status gizi filter chips */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {(['semua','normal','kurang','buruk','pendek'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setBalitaFilterGizi(val)}
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    balitaFilterGizi === val
                      ? val === 'semua'
                        ? 'bg-[#1e2939] text-white border-[#1e2939]'
                        : statusGiziBadgeClass(val) + ' border-transparent'
                      : 'bg-white text-gray-600 border-[#e5e7eb]'
                  }`}
                >
                  {val === 'semua' ? 'Semua Gizi' : val.charAt(0).toUpperCase() + val.slice(1)}
                </button>
              ))}
            </div>

            {/* Jenis kelamin filter */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {([ ['semua','Semua'], ['laki_laki','Laki-laki'], ['perempuan','Perempuan'] ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setBalitaFilterGender(val)}
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    balitaFilterGender === val
                      ? 'bg-[#0ea5e9] text-white border-[#0ea5e9]'
                      : 'bg-white text-gray-600 border-[#e5e7eb]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* List */}
            {isLoadingStats ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : (() => {
              const q = balitaSearch.trim().toLowerCase()
              let result = (dashboardStats?.daftarBalita ?? [])
                .filter((b) =>
                  (!q || b.namaBalita.toLowerCase().includes(q) || (b.nikBalita ?? '').toLowerCase().includes(q)) &&
                  (balitaFilterGizi === 'semua' || b.statusGizi === balitaFilterGizi) &&
                  (balitaFilterGender === 'semua' || b.jenisKelamin === balitaFilterGender)
                )
              result = [...result].sort((a, b) => {
                if (balitaSort === 'az') return a.namaBalita.localeCompare(b.namaBalita, 'id')
                if (balitaSort === 'za') return b.namaBalita.localeCompare(a.namaBalita, 'id')
                if (balitaSort === 'zscore-asc') return (a.zScoreBbU ?? 999) - (b.zScoreBbU ?? 999)
                return (b.zScoreBbU ?? -999) - (a.zScoreBbU ?? -999)
              })
              const total = dashboardStats?.daftarBalita?.length ?? 0
              const isFiltered = q || balitaFilterGizi !== 'semua' || balitaFilterGender !== 'semua'
              return (
                <>
                  <p className="text-[#99a1af] text-xs">
                    {isFiltered ? `${result.length} dari ${total} balita` : `${total} balita terdaftar`}
                  </p>
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    {result.length === 0 ? (
                      <p className="text-[#99a1af] text-xs text-center p-4">
                        Tidak ada balita yang sesuai filter.
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {result.map((b) => (
                          <div key={b.balitaId} className="flex items-center justify-between px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[#1e2939] text-sm font-semibold truncate">{b.namaBalita}</p>
                              <p className="text-[#99a1af] text-xs">
                                {b.jenisKelamin === 'laki_laki' ? 'L' : 'P'} · {b.usiaMonths} bln
                                {b.beratBadan != null ? ` · ${b.beratBadan} kg` : ''}
                                {b.tinggiBadan != null ? ` · ${b.tinggiBadan} cm` : ''}
                              </p>
                              {b.zScoreBbU != null && (
                                <p className="text-[#99a1af] text-[10px]">
                                  BB/U: {b.zScoreBbU.toFixed(1)} SD
                                  {b.zScoreTbU != null ? ` · TB/U: ${b.zScoreTbU.toFixed(1)} SD` : ''}
                                </p>
                              )}
                              {b.nikBalita && (
                                <p className="text-[#c2c9d6] text-[10px]">NIK {b.nikBalita}</p>
                              )}
                            </div>
                            <span className={`ml-3 shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusGiziBadgeClass(b.statusGizi ?? '')}`}>
                              {b.statusGizi ? b.statusGizi.replace(/_/g, ' ') : '–'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
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
                    {Math.max(0,
                      (todayJadwal?.slotSesi.reduce((s, sl) => s + sl.totalAntrian, 0) ?? 0)
                      - (dashboardStats?.hadirHariIni ?? 0)
                    )}
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





