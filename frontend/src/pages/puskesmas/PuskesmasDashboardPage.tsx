import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar, ChevronRight, Map, Users, FileText,
  ClipboardList, TrendingUp, TrendingDown,
} from 'lucide-react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie,
} from 'recharts'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/useAuthStore'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalPemeriksaan: number
  totalBalita: number
  breakdown: Record<string, number>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function usePuskesmasDashboardStats(bulan: string) {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats', bulan],
    queryFn: () =>
      apiClient
        .get('/dashboard/stats', { params: { bulan } })
        .then((r) => r.data.data as DashboardStats),
    staleTime: 5 * 60 * 1000,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBulanDefault(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

function formatBulanLabel(bulan: string): string {
  const [year, month] = bulan.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
}

const GIZI_COLORS: Record<string, string> = {
  normal: '#15803d',
  kurang: '#f59e0b',
  pendek: '#f59e0b',
  buruk: '#ef4444',
  sangat_pendek: '#dc2626',
  lebih: '#93c5fd',
  obesitas: '#60a5fa',
}

const GIZI_LABELS: Record<string, string> = {
  normal: 'Normal',
  kurang: 'Kurang',
  pendek: 'Pendek',
  buruk: 'Buruk',
  sangat_pendek: 'Sangat Pendek',
  lebih: 'Lebih',
  obesitas: 'Obesitas',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, positive, warning,
}: {
  label: string; value: string; sub: string; positive?: boolean; warning?: boolean
}) {
  const valueColor = warning
    ? 'text-red-600'
    : positive
    ? 'text-[#008236]'
    : 'text-gray-800'
  const Icon = warning ? TrendingDown : TrendingUp
  const iconColor = warning ? 'text-red-400' : positive ? 'text-green-500' : 'text-amber-500'
  const subColor = warning ? 'text-red-500' : positive ? 'text-green-600' : 'text-gray-400'

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold leading-none mb-1 ${valueColor}`}>{value}</p>
      <div className="flex items-center gap-1 mt-2">
        <Icon className={`w-3 h-3 ${iconColor}`} />
        <span className={`text-xs ${subColor}`}>{sub}</span>
      </div>
    </div>
  )
}

// ── PuskesmasDashboardPage ────────────────────────────────────────────────────

export default function PuskesmasDashboardPage() {
  const [bulan, setBulan] = useState<string>(getBulanDefault)
  const { data: stats, isLoading } = usePuskesmasDashboardStats(bulan)
  const { user } = useAuthStore()

  const bermasalah =
    (stats?.breakdown?.buruk ?? 0) +
    (stats?.breakdown?.sangat_pendek ?? 0) +
    (stats?.breakdown?.kurang ?? 0) +
    (stats?.breakdown?.pendek ?? 0)

  const pieData = [
    { name: 'Normal', value: stats?.breakdown?.normal ?? 0, color: '#15803d' },
    {
      name: 'Kurang/Pendek',
      value: (stats?.breakdown?.kurang ?? 0) + (stats?.breakdown?.pendek ?? 0),
      color: '#f59e0b',
    },
    {
      name: 'Buruk/Sgt Pendek',
      value: (stats?.breakdown?.buruk ?? 0) + (stats?.breakdown?.sangat_pendek ?? 0),
      color: '#ef4444',
    },
    {
      name: 'Lebih/Obesitas',
      value: (stats?.breakdown?.lebih ?? 0) + (stats?.breakdown?.obesitas ?? 0),
      color: '#93c5fd',
    },
  ].filter((d) => d.value > 0)

  const barData = Object.entries(stats?.breakdown ?? {}).map(([key, value]) => ({
    name: GIZI_LABELS[key] ?? key,
    nilai: value,
    color: GIZI_COLORS[key] ?? '#d1d5db',
  }))

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-full bg-gray-50">
      {/* ── Sticky top header ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-gray-800 font-bold text-lg">Dashboard Monitoring</h1>
          <p className="text-gray-400 text-xs">
            {user?.namaLengkap ?? 'Puskesmas'} · {todayLabel}
          </p>
        </div>
        <MonthYearPicker value={bulan} onChange={setBulan} />
      </div>

      <div className="px-6 py-5 space-y-5 pb-8">
        {/* ── KPI 4-col ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 border border-gray-100 h-24 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Total Pemeriksaan"
              value={(stats?.totalPemeriksaan ?? 0).toLocaleString('id-ID')}
              sub={`Bulan ${formatBulanLabel(bulan)}`}
            />
            <KPICard
              label="Total Balita"
              value={(stats?.totalBalita ?? 0).toLocaleString('id-ID')}
              sub="Di wilayah kerja"
            />
            <KPICard
              label="Gizi Normal"
              value={(stats?.breakdown?.normal ?? 0).toLocaleString('id-ID')}
              sub="Status baik"
              positive
            />
            <KPICard
              label="Bermasalah"
              value={bermasalah.toLocaleString('id-ID')}
              sub="Butuh perhatian"
              warning
            />
          </div>
        )}

        {/* ── Charts 2/3 + 1/3 ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* BarChart distribusi */}
          <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="mb-4">
              <p className="text-gray-800 text-sm font-bold">Distribusi Status Gizi</p>
              <p className="text-gray-400 text-xs">{formatBulanLabel(bulan)}</p>
            </div>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="nilai" radius={[4, 4, 0, 0]} name="Balita">
                    {barData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[190px] flex items-center justify-center text-gray-400 text-sm">
                {isLoading ? 'Memuat...' : 'Belum ada data pemeriksaan bulan ini'}
              </div>
            )}
          </div>

          {/* PieChart status gizi */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-gray-800 text-sm font-bold mb-3">Proporsi Status Gizi</p>
            {pieData.length > 0 ? (
              <>
                <div className="flex justify-center mb-3">
                  <PieChart width={140} height={140}>
                    <Pie
                      data={pieData}
                      cx={65}
                      cy={65}
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </div>
                <div className="space-y-1.5">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-gray-500 text-xs">{item.name}</span>
                      </div>
                      <span className="text-gray-800 text-xs font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                {isLoading ? 'Memuat...' : 'Tidak ada data'}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions ────────────────────────────────────────────────── */}
        <div>
          <p className="text-gray-400 text-xs font-semibold tracking-wider mb-3">AKSI CEPAT</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                label: 'Peta Sebaran Stunting',
                sub: 'Visualisasi risiko stunting per wilayah',
                to: '/puskesmas/peta',
                icon: Map,
              },
              {
                label: 'Manajemen Kader',
                sub: 'Kelola akun dan status kader posyandu',
                to: '/puskesmas/pengguna',
                icon: Users,
              },
              {
                label: 'Jadwal Posyandu',
                sub: 'Buat dan kelola jadwal pelayanan',
                to: '/puskesmas/jadwal',
                icon: Calendar,
              },
              {
                label: 'Laporan e-PPGBM',
                sub: 'Ekspor laporan format Kemenkes',
                to: '/puskesmas/laporan',
                icon: FileText,
              },
              {
                label: 'Audit Log',
                sub: 'Riwayat aktivitas sistem',
                to: '/puskesmas/audit-log',
                icon: ClipboardList,
              },
            ].map(({ label, sub, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition text-left"
              >
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 text-sm font-semibold">{label}</p>
                  <p className="text-gray-400 text-xs truncate">{sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
