import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Map, Users, Calendar, FileText, ClipboardList, Activity } from 'lucide-react'
import apiClient from '@/lib/axios'

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
    staleTime: 5 * 60 * 1000, // 5 menit
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBulanDefault(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

function formatBulanLabel(bulan: string): string {
  const [year, month] = bulan.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

// ── StatsCard component ────────────────────────────────────────────────────────

interface StatsCardProps {
  label: string
  value: number
  color: string
  bgColor: string
  isLoading: boolean
}

function StatsCard({ label, value, color, bgColor, isLoading }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-8 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString('id-ID')}</p>
          <div className={`mt-3 h-1 rounded-full ${bgColor} opacity-40`} />
        </>
      )}
    </div>
  )
}

// ── Quick action item ──────────────────────────────────────────────────────────

interface QuickActionProps {
  label: string
  description: string
  to: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
}

function QuickAction({ label, description, to, icon: Icon, iconColor, iconBg }: QuickActionProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-green-200 transition-all group"
    >
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 text-sm group-hover:text-[#008236] transition-colors">
          {label}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{description}</p>
      </div>
    </Link>
  )
}

// ── PuskesmasDashboardPage ────────────────────────────────────────────────────

export default function PuskesmasDashboardPage() {
  const [bulan, setBulan] = useState<string>(getBulanDefault)
  const { data: stats, isLoading } = usePuskesmasDashboardStats(bulan)

  const bermasalah =
    (stats?.breakdown?.buruk ?? 0) +
    (stats?.breakdown?.sangat_pendek ?? 0) +
    (stats?.breakdown?.kurang ?? 0) +
    (stats?.breakdown?.pendek ?? 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Puskesmas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Data bulan {formatBulanLabel(bulan)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="bulan-filter" className="text-sm text-gray-600 font-medium whitespace-nowrap">
            Filter bulan:
          </label>
          <input
            id="bulan-filter"
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008236] focus:border-transparent"
          />
        </div>
      </div>

      {/* ── Stats cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Total Pemeriksaan"
          value={stats?.totalPemeriksaan ?? 0}
          color="text-[#008236]"
          bgColor="bg-green-500"
          isLoading={isLoading}
        />
        <StatsCard
          label="Total Balita"
          value={stats?.totalBalita ?? 0}
          color="text-blue-600"
          bgColor="bg-blue-500"
          isLoading={isLoading}
        />
        <StatsCard
          label="Gizi Normal"
          value={stats?.breakdown?.normal ?? 0}
          color="text-emerald-600"
          bgColor="bg-emerald-500"
          isLoading={isLoading}
        />
        <StatsCard
          label="Bermasalah"
          value={bermasalah}
          color="text-red-600"
          bgColor="bg-red-500"
          isLoading={isLoading}
        />
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Activity size={16} className="text-[#008236]" />
          Aksi Cepat
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction
            label="Lihat Peta Stunting"
            description="Visualisasi sebaran stunting per posyandu"
            to="/puskesmas/peta"
            icon={Map}
            iconColor="text-[#008236]"
            iconBg="bg-green-50"
          />
          <QuickAction
            label="Manajemen Kader"
            description="Kelola akun dan status kader posyandu"
            to="/puskesmas/pengguna"
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
          <QuickAction
            label="Jadwal Posyandu"
            description="Buat dan kelola jadwal pelayanan"
            to="/puskesmas/jadwal"
            icon={Calendar}
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
          />
          <QuickAction
            label="Laporan Bulanan"
            description="Ekspor laporan e-PPGBM format Kemenkes"
            to="/puskesmas/laporan"
            icon={FileText}
            iconColor="text-orange-600"
            iconBg="bg-orange-50"
          />
        </div>
      </div>

      {/* ── Audit log shortcut ────────────────────────────────────────────── */}
      <div className="mt-2">
        <Link
          to="/puskesmas/audit-log"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#008236] transition-colors"
        >
          <ClipboardList size={14} />
          <span>Lihat Audit Log</span>
        </Link>
      </div>
    </div>
  )
}
