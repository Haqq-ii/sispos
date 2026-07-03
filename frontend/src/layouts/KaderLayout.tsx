import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FileText,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    to: '/kader/dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: 'Pelayanan Hari-H',
    to: '/kader/pelayanan',
    icon: Users,
    end: false,
  },
  {
    label: 'Rekap Harian',
    to: '/kader/rekap',
    icon: FileText,
    end: false,
  },
] as const

// ── KaderLayout ───────────────────────────────────────────────────────────────

export default function KaderLayout() {
  const navigate = useNavigate()
  const { clearAuth } = useAuthStore()

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
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:min-h-screen bg-white border-r border-gray-200 shadow-sm">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#008236] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">SP</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">SISPOS</p>
              <p className="text-xs text-[#008236] font-medium">Kader Posyandu</p>
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
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-green-50 text-[#008236] font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                ].join(' ')
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
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

        {/* ── Mobile Bottom Navigation ─────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
          <div className="grid grid-cols-3 h-16">
            {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                    isActive ? 'text-[#008236]' : 'text-gray-500',
                  ].join(' ')
                }
              >
                <Icon size={20} />
                <span className="truncate max-w-[72px] text-center leading-tight">
                  {label === 'Pelayanan Hari-H' ? 'Pelayanan' : label}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>
      </main>
    </div>
  )
}
