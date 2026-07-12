import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar, ChevronRight, Map, Users, FileText,
  ClipboardList, TrendingUp, TrendingDown,
} from 'lucide-react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, LineChart, Line, Legend,
} from 'recharts'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/useAuthStore'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalPemeriksaan: number
  totalBalita: number
  breakdown: Record<string, number>
  distribusiRingkasanGiziBulanIni: {
    normal: number
    kurangPendek: number
    burukSangatPendek: number
    lebihObesitas: number
  }
  trenRingkasanGizi: Array<{
    bulan: string
    normal: number
    kurangPendek: number
    burukSangatPendek: number
    lebihObesitas: number
  }>
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

const RINGKASAN_GIZI_ITEMS = [
  { key: 'normal', name: 'Normal', color: '#15803d' },
  { key: 'kurangPendek', name: 'Kurang/Pendek', color: '#f59e0b' },
  { key: 'burukSangatPendek', name: 'Buruk/Sgt Pendek', color: '#ef4444' },
  { key: 'lebihObesitas', name: 'Lebih/Obesitas', color: '#60a5fa' },
] as const

type RingkasanGiziKey = (typeof RINGKASAN_GIZI_ITEMS)[number]['key']

const EMPTY_RINGKASAN_GIZI: Record<RingkasanGiziKey, number> = {
  normal: 0,
  kurangPendek: 0,
  burukSangatPendek: 0,
  lebihObesitas: 0,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

  const distribusiRingkasan = stats?.distribusiRingkasanGiziBulanIni ?? EMPTY_RINGKASAN_GIZI
  const totalRingkasan =
    distribusiRingkasan.normal +
    distribusiRingkasan.kurangPendek +
    distribusiRingkasan.burukSangatPendek +
    distribusiRingkasan.lebihObesitas
  const bermasalah =
    distribusiRingkasan.kurangPendek +
    distribusiRingkasan.burukSangatPendek +
    distribusiRingkasan.lebihObesitas
  const pieData = RINGKASAN_GIZI_ITEMS.map((item) => ({
    ...item,
    value: distribusiRingkasan[item.key],
  })).filter((d) => d.value > 0)

  const barData = RINGKASAN_GIZI_ITEMS.map((item) => ({
    name: item.name,
    nilai: distribusiRingkasan[item.key],
    color: item.color,
  }))
  const trendLines = RINGKASAN_GIZI_ITEMS
  const trendData = (stats?.trenRingkasanGizi ?? []).map((row) => {
    const total =
      row.normal +
      row.kurangPendek +
      row.burukSangatPendek +
      row.lebihObesitas
    return {
      ...row,
      total,
      normalPct: getPercent(row.normal, total),
      kurangPendekPct: getPercent(row.kurangPendek, total),
      burukSangatPendekPct: getPercent(row.burukSangatPendek, total),
      lebihObesitasPct: getPercent(row.lebihObesitas, total),
    }
  })


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
              value={totalRingkasan.toLocaleString('id-ID')}
              sub={`Bulan ${formatBulanLabel(bulan)}`}
            />
            <KPICard
              label="Total Balita"
              value={(stats?.totalBalita ?? 0).toLocaleString('id-ID')}
              sub="Balita diperiksa bulan ini"
            />
            <KPICard
              label="Gizi Normal"
              value={distribusiRingkasan.normal.toLocaleString('id-ID')}
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
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="mb-4">
            <p className="text-gray-800 text-sm font-bold">Tren Ringkasan Risiko Gizi (%)</p>
            <p className="text-gray-400 text-xs">Persentase dari balita yang diperiksa tiap bulan</p>
          </div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={trendData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={formatPercentTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
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
          ) : (
            <div className="h-[230px] flex items-center justify-center text-gray-400 text-sm">
              {isLoading ? 'Memuat...' : 'Belum ada data tren'}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* BarChart distribusi */}
          <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="mb-4">
              <p className="text-gray-800 text-sm font-bold">Distribusi Ringkasan Risiko Gizi</p>
              <p className="text-gray-400 text-xs">{formatBulanLabel(bulan)}</p>
            </div>
            {barData.some((item) => item.nilai > 0) ? (
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
            <p className="text-gray-800 text-sm font-bold mb-3">Proporsi Ringkasan Risiko Gizi</p>
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






