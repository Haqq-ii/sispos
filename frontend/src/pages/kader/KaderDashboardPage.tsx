/**
 * KaderDashboardPage — Figma 27:2531 alignment
 *
 * Layout:
 *   - Green header: kader name, logout, SyncPendingBadge, install button
 *   - Stats row (body): Total Balita | Risiko Stunting | Hadir Hari Ini
 *   - Mulai Pelayanan Hari-H card per slot
 *   - Tabs: Ringkasan | Data Balita | Absensi
 *     Ringkasan: TREN STATUS GIZI (BarChart) + STATUS GIZI BULAN INI (PieChart) + PERINGATAN RISIKO STUNTING table
 *
 * Data sources:
 *   - GET /api/kader/today-slots → jadwal + slot cards
 *   - GET /api/kader/dashboard-stats → stats + charts + risk table
 *
 * KRITIS: useActiveMeja redirect useEffect TIDAK BOLEH dihapus (lock-screen feature)
 */
import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut, ClipboardList, ChevronRight, Play, Download } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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

// ── Component ─────────────────────────────────────────────────────────────

export default function KaderDashboardPage() {
  const navigate = useNavigate()
  const { clearAuth, user } = useAuthStore()
  const { setActiveMeja, setLocked } = useKaderMejaStore()
  const { deferredPrompt, triggerInstall } = usePwaStore()
  // WR-08: window.matchMedia is undefined in JSDOM and some legacy browsers
  const showInstall =
    deferredPrompt !== null &&
    !(window.matchMedia?.('(display-mode: standalone)')?.matches ?? false)

  // Lock-screen redirect (KRITIS — jangan hapus)
  const { data: activeMejaData, isLoading: isLoadingActiveMeja } = useActiveMeja()

  // Today's jadwal + slots
  const { data: todayJadwal, isLoading: isLoadingJadwal } = useQuery<TodayJadwal | null>({
    queryKey: ['kader', 'today-slots'],
    queryFn: () =>
      apiClient.get('/kader/today-slots').then((r) => r.data.data as TodayJadwal | null),
    staleTime: 30_000,
  })

  // Dashboard stats (Figma 27:2531 — stats row + charts + risk table)
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
      // Always recover to Meja 1 — mejas 3-5 require router state (antrianId/pemeriksaanId)
      // that isn't persisted across page reloads
      navigate('/kader/meja/1', { replace: true })
    }
  }, [isLoadingActiveMeja, activeMejaData, navigate, setActiveMeja, setLocked])

  const handleLogout = async () => {
    try { await apiClient.post('/auth/logout') } catch (e) {
      // WR-07: Best-effort logout — local auth cleared regardless
      if (import.meta.env.DEV) console.warn('[KaderDashboard] Logout API call failed:', e)
    }
    clearAuth()
    navigate('/login', { replace: true })
  }

  const isLoading = isLoadingActiveMeja || isLoadingJadwal || isLoadingStats

  // Pie chart data — distribusiGiziBulanIni
  const distribusiData = dashboardStats
    ? [
        { name: 'Normal', value: dashboardStats.distribusiGiziBulanIni.normal, color: '#16a34a' },
        { name: 'Kurang', value: dashboardStats.distribusiGiziBulanIni.kurang, color: '#fbbf24' },
        { name: 'Buruk', value: dashboardStats.distribusiGiziBulanIni.buruk, color: '#ef4444' },
        { name: 'Pendek', value: dashboardStats.distribusiGiziBulanIni.pendek, color: '#f97316' },
      ]
    : []

  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col">

      {/* ── Header (Figma: green bg, kader name, logout, install) ─────── */}
      <div className="bg-[#008236] px-4 pt-12 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Selamat datang,</p>
            <p className="text-white font-bold text-xl leading-tight">
              {user?.namaLengkap ?? 'Kader'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[#b9f8cf] text-xs">Kader Posyandu</p>
              {user?.role === 'ketua_kader' && (
                <span className="bg-[#ffb900] text-[#7b3306] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  KETUA
                </span>
              )}
            </div>
            <div className="mt-2">
              <SyncPendingBadge />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {showInstall && (
              <button
                onClick={() => { void triggerInstall() }}
                className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium flex items-center gap-1.5 min-h-[44px]"
              >
                <Download className="h-3.5 w-3.5" />
                Pasang Aplikasi
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-[rgba(255,255,255,0.15)] rounded-xl p-2.5"
            >
              <LogOut size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-4 space-y-3">

        {/* ── Stats Row: Total Balita | Risiko Stunting | Hadir Hari Ini ─ */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-3 text-center shadow-sm">
              <p className="text-[#1e2939] font-bold text-2xl leading-none">
                {dashboardStats?.totalBalita ?? 0}
              </p>
              <p className="text-[#99a1af] text-xs leading-tight mt-1">Total<br />Balita</p>
            </div>
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-3 text-center shadow-sm">
              <p className="text-[#e7000b] font-bold text-2xl leading-none">
                {dashboardStats?.risikoStunting ?? 0}
              </p>
              <p className="text-[#99a1af] text-xs leading-tight mt-1">Risiko<br />Stunting</p>
            </div>
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-3 text-center shadow-sm">
              <p className="text-[#1e2939] font-bold text-2xl leading-none">
                {dashboardStats?.hadirHariIni ?? 0}
              </p>
              <p className="text-[#99a1af] text-xs leading-tight mt-1">Hadir<br />Hari Ini</p>
            </div>
          </div>
        )}

        {/* ── Mulai Pelayanan Hari-H ────────────────────────────────── */}
        {isLoading ? (
          <>
            <Skeleton className="h-16 rounded-2xl" />
          </>
        ) : !todayJadwal ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="text-gray-300 mb-3" size={48} />
            <p className="text-sm text-gray-500">Tidak ada jadwal pelayanan hari ini.</p>
            <p className="text-xs text-gray-400 mt-1">Hubungi Puskesmas untuk membuat jadwal.</p>
          </div>
        ) : (
          todayJadwal.slotSesi.map((slot) => (
            <button
              key={slot.id}
              onClick={() =>
                navigate('/kader/pelayanan', {
                  state: { slotId: slot.id, slotLabel: slot.labelSesi },
                })
              }
              className="w-full bg-white rounded-2xl shadow-sm border border-[#f3f4f6] px-4 py-3.5 flex items-center justify-between active:bg-[#f9fafb]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#008236] rounded-xl flex items-center justify-center">
                  <Play size={16} className="text-white fill-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-800">Mulai Pelayanan Hari-H</p>
                  <p className="text-xs text-gray-500">{slot.labelSesi} · {slot.jamMulai} WIB</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))
        )}

        {/* ── Tabs: Ringkasan | Data Balita | Absensi ──────────────── */}
        <Tabs defaultValue="ringkasan">
          <TabsList className="w-full">
            <TabsTrigger value="ringkasan" className="flex-1">Ringkasan</TabsTrigger>
            <TabsTrigger value="data-balita" className="flex-1">Data Balita</TabsTrigger>
            <TabsTrigger value="absensi" className="flex-1">Absensi</TabsTrigger>
          </TabsList>

          {/* Ringkasan tab */}
          <TabsContent value="ringkasan" className="space-y-3 mt-3">

            {/* TREN STATUS GIZI — BarChart 6 bulan */}
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-4 shadow-sm">
              <p className="text-[#99a1af] text-xs font-semibold tracking-wider mb-3 uppercase">
                TREN STATUS GIZI
              </p>
              {isLoadingStats ? (
                <Skeleton className="h-[180px] rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dashboardStats?.trenGiziBulanan ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="bulan" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="normal" fill="#16a34a" />
                    <Bar dataKey="kurang" fill="#fbbf24" />
                    <Bar dataKey="buruk" fill="#ef4444" />
                    <Bar dataKey="pendek" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* STATUS GIZI BULAN INI — PieChart donut */}
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-4 shadow-sm">
              <p className="text-[#99a1af] text-xs font-semibold tracking-wider mb-3 uppercase">
                STATUS GIZI BULAN INI
              </p>
              {isLoadingStats ? (
                <Skeleton className="h-[160px] rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={distribusiData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                    >
                      {distribusiData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* PERINGATAN RISIKO STUNTING — table */}
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-4 shadow-sm">
              <p className="text-[#e7000b] text-xs font-semibold tracking-wider mb-3 uppercase">
                PERINGATAN RISIKO STUNTING
              </p>
              {isLoadingStats ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : !dashboardStats || dashboardStats.peringatanRisiko.length === 0 ? (
                <p className="text-[#99a1af] text-xs text-center py-4">
                  Tidak ada balita berisiko tinggi
                </p>
              ) : (
                <div className="space-y-0">
                  {dashboardStats.peringatanRisiko.map((item) => (
                    <div
                      key={item.balitaId}
                      className="flex items-center justify-between py-2.5 border-b border-[#f3f4f6] last:border-0"
                    >
                      <div>
                        <p className="text-[#1e2939] text-sm font-semibold">{item.namaBalita}</p>
                        <p className="text-[#99a1af] text-xs">
                          BB/U: {item.zScoreBbU != null ? item.zScoreBbU.toFixed(1) : '–'}
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

          </TabsContent>

          {/* Data Balita tab */}
          <TabsContent value="data-balita" className="mt-3">
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-4 text-center shadow-sm">
              <p className="text-[#99a1af] text-xs">
                Data lengkap tersedia di sistem Puskesmas.
              </p>
            </div>
          </TabsContent>

          {/* Absensi tab */}
          <TabsContent value="absensi" className="mt-3">
            <div className="bg-white border border-[#f3f4f6] rounded-2xl p-4 text-center shadow-sm">
              <p className="text-[#99a1af] text-xs">
                Lihat rekap kehadiran di halaman Rekap Harian.
              </p>
              <Link to="/kader/rekap" className="text-[#008236] text-xs font-medium mt-2 block">
                Ke Rekap Harian →
              </Link>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}
