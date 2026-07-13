import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar, ChevronRight, Map, Users, FileText,
  ClipboardList, TrendingUp, TrendingDown,
} from 'lucide-react'
import {
  Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, LineChart, Line, Legend,
} from 'recharts'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/useAuthStore'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalPemeriksaan: number
  totalBalita: number
  totalBalitaSasaran: number
  breakdown: Record<string, number>
  partisipasiDS: {
    ditimbang: number
    sasaran: number
    persen: number
    status: 'baik' | 'cukup' | 'rendah'
  }
  redFlagsPosyandu: Array<{
    posyanduId: string
    namaPosyandu: string
    wilayah?: string
    kasusKritisBulanIni: number
    kasusKritisBulanLalu: number
    lonjakan: number
  }>
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


  const partisipasiDS = stats?.partisipasiDS ?? {
    ditimbang: 0,
    sasaran: 0,
    persen: 0,
    status: 'rendah' as const,
  }
  const dsPercent = Math.min(100, Math.max(0, partisipasiDS.persen))
  const dsStatusLabel: Record<typeof partisipasiDS.status, string> = {
    baik: 'Baik',
    cukup: 'Cukup',
    rendah: 'Perlu ditingkatkan',
  }
  const dsStatusClass: Record<typeof partisipasiDS.status, string> = {
    baik: 'bg-green-100 text-green-700',
    cukup: 'bg-amber-100 text-amber-700',
    rendah: 'bg-red-100 text-red-700',
  }
  const redFlags = stats?.redFlagsPosyandu ?? []
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
            <p className="text-gray-400 text-xs">6 bulan terakhir berdasarkan z-score</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Proporsi ringkasan */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm min-w-0">
            <div className="mb-4">
              <p className="text-gray-800 text-sm font-bold">Proporsi Ringkasan Risiko Gizi</p>
              <p className="text-gray-400 text-xs">{formatBulanLabel(bulan)}</p>
            </div>
            {pieData.length > 0 ? (
              <>
                <div className="flex justify-center mb-4">
                  <PieChart width={150} height={150}>
                    <Pie
                      data={pieData}
                      cx={75}
                      cy={75}
                      innerRadius={46}
                      outerRadius={66}
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
                <div className="space-y-2">
                  {RINGKASAN_GIZI_ITEMS.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-gray-500 text-xs truncate">{item.name}</span>
                      </div>
                      <span className="text-gray-800 text-xs font-bold flex-shrink-0">
                        {distribusiRingkasan[item.key].toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                {isLoading ? 'Memuat...' : 'Tidak ada data'}
              </div>
            )}
          </div>

          {/* Partisipasi D/S */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm min-w-0">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <p className="text-gray-800 text-sm font-bold">Tingkat Partisipasi D/S</p>
                <p className="text-gray-400 text-xs">Balita diperiksa dari total sasaran</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ${dsStatusClass[partisipasiDS.status]}`}>
                {dsStatusLabel[partisipasiDS.status]}
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Kehadiran</p>
                <p className="text-3xl font-bold text-gray-800 leading-none">
                  {partisipasiDS.persen.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                </p>
              </div>
              <div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full transition-all"
                    style={{ width: `${dsPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 text-xs">
                  <span className="text-gray-500">{partisipasiDS.ditimbang.toLocaleString('id-ID')} / {partisipasiDS.sasaran.toLocaleString('id-ID')} balita</span>
                  <span className="text-gray-400 flex-shrink-0">Target 80%</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Dihitung dari balita unik yang memiliki pemeriksaan pada bulan terpilih.
              </p>
            </div>
          </div>

          {/* Red flags */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm min-w-0">
            <div className="mb-4">
              <p className="text-gray-800 text-sm font-bold">Tindak Lanjut Segera</p>
              <p className="text-gray-400 text-xs">Posyandu dengan lonjakan kasus kritis</p>
            </div>
            {redFlags.length > 0 ? (
              <div className="space-y-3">
                {redFlags.map((item) => (
                  <div key={item.posyanduId} className="rounded-xl border border-gray-100 p-3 bg-gray-50 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.namaPosyandu}</p>
                        {item.wilayah && <p className="text-[11px] text-gray-400 truncate">{item.wilayah}</p>}
                      </div>
                      <span className="text-xs font-bold text-red-600 flex-shrink-0">
                        {item.lonjakan > 0 ? `+${item.lonjakan}` : item.lonjakan}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {item.lonjakan > 0
                        ? `+${item.lonjakan} kasus kritis dari bulan lalu`
                        : `${item.lonjakan} kasus kritis dari bulan lalu`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Total kritis bulan ini: {item.kasusKritisBulanIni.toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-center text-gray-400 text-sm px-4">
                {isLoading ? 'Memuat...' : 'Tidak ada lonjakan kasus kritis bulan ini.'}
              </div>
            )}
          </div>
        </div>
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









