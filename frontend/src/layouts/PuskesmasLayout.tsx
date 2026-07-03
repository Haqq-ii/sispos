import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  Map,
  Calendar,
  Users,
  FileText,
  Shield,
  LogOut,
  Activity,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/puskesmas/dashboard', icon: LayoutGrid, end: true },
  { label: 'Peta Stunting', to: '/puskesmas/peta', icon: Map, end: false },
  { label: 'Manajemen Jadwal', to: '/puskesmas/jadwal', icon: Calendar, end: false },
  { label: 'Manajemen Pengguna', to: '/puskesmas/pengguna', icon: Users, end: false },
  { label: 'Laporan e-PPGBM', to: '/puskesmas/laporan', icon: FileText, end: false },
  { label: 'Audit Log', to: '/puskesmas/audit-log', icon: Shield, end: false },
] as const

const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 4)

// ── PuskesmasLayout ───────────────────────────────────────────────────────────

export default function PuskesmasLayout() {
  const navigate = useNavigate()
  const { clearAuth, user } = useAuthStore()

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore error — clear session regardless
    }
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f9fafb]">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:min-h-screen bg-white border-r border-[#f3f4f6] shadow-sm">
        {/* Header */}
        <div className="px-5 py-5 border-b border-[#f3f4f6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#008236] rounded-[14px] flex items-center justify-center flex-shrink-0">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1e2939] leading-tight">SISPOS</p>
              <p className="text-xs text-[#6a7282]">Portal Puskesmas</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive
                  ? 'bg-[#f0fdf4] border border-[#b9f8cf] text-[#008236] font-semibold rounded-[14px] flex items-center gap-3 px-[13px] py-[11px] text-sm'
                  : 'text-[#4a5565] rounded-[14px] flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50'
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer: user info + logout */}
        <div className="px-3 py-4 border-t border-[#f3f4f6] space-y-3">
          <div className="px-3">
            <p className="text-[#1e2939] text-sm font-semibold truncate">
              {user?.namaLengkap ?? 'Puskesmas'}
            </p>
            <p className="text-[#6a7282] text-xs mt-0.5">Portal Puskesmas</p>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-[14px] text-sm font-medium text-[#fb2c36] hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </div>

        {/* ── Mobile Bottom Navigation (4 items) ───────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#f3f4f6] shadow-lg">
          <div className="grid grid-cols-4 h-16">
            {MOBILE_NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 transition-colors',
                    isActive ? 'text-[#008236]' : 'text-[#4a5565]',
                  ].join(' ')
                }
              >
                <Icon size={20} />
                <span className="text-[10px] text-center leading-tight max-w-[60px] truncate">
                  {label === 'Manajemen Jadwal'
                    ? 'Jadwal'
                    : label === 'Manajemen Pengguna'
                    ? 'Pengguna'
                    : label}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>
      </main>
    </div>
  )
}
