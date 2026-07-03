import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Map, Users, Calendar, FileText, ClipboardList } from 'lucide-react'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/useAuthStore'

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
      className="flex items-center gap-3 bg-white border border-[#f3f4f6] rounded-2xl shadow-sm p-4 hover:shadow-md hover:border-[#b9f8cf] transition-all group"
    >
      <div className={`w-10 h-10 rounded-[14px] ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[#1e2939] text-sm group-hover:text-[#008236] transition-colors">
          {label}
        </p>
        <p className="text-xs text-[#99a1af] mt-0.5 truncate">{description}</p>
      </div>
    </Link>
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

  return (
    <div className="min-h-full bg-[#f9fafb] pb-8">
      {/* ── Green Header ──────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-5 py-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Dashboard Puskesmas</p>
            <p className="text-white font-bold text-xl leading-tight">
              {user?.namaLengkap ?? 'Puskesmas'}
            </p>
            <p className="text-[#b9f8cf] text-xs mt-1">Data bulan {formatBulanLabel(bulan)}</p>
          </div>
          <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="px-3 py-1.5 text-xs border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.15)] text-white rounded-[14px] focus:outline-none focus:bg-[rgba(255,255,255,0.25)]"
          />
        </div>

        {/* Stat boxes in header */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3 h-16 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-white font-bold text-xl leading-none">
                {(stats?.totalPemeriksaan ?? 0).toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Total Pemeriksaan</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-white font-bold text-xl leading-none">
                {(stats?.totalBalita ?? 0).toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Total Balita</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-[#7bf1a8] font-bold text-xl leading-none">
                {(stats?.breakdown?.normal ?? 0).toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Gizi Normal</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-[#fb2c36] font-bold text-xl leading-none">
                {bermasalah.toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Bermasalah</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="px-4 mt-4 space-y-4">
        {/* Quick actions */}
        <div>
          <p className="text-[#6a7282] text-xs font-semibold tracking-wider mb-3">AKSI CEPAT</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction
              label="Lihat Peta Stunting"
              description="Visualisasi sebaran stunting per posyandu"
              to="/puskesmas/peta"
              icon={Map}
              iconColor="text-[#008236]"
              iconBg="bg-[#f0fdf4]"
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

        {/* Audit log shortcut */}
        <div>
          <Link
            to="/puskesmas/audit-log"
            className="inline-flex items-center gap-2 text-sm text-[#6a7282] hover:text-[#008236] transition-colors"
          >
            <ClipboardList size={14} />
            <span>Lihat Audit Log</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
