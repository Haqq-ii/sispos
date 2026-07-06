import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  User,
  LogOut,
  MapPin,
  Activity,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'

// ── Nav items (3 only — match Figma Make exactly) ────────────────────────────

interface NavItem {
  label: string
  labelShort: string
  to: string
  icon: React.ElementType
  end: boolean
  activePrefix?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    labelShort: 'Dashboard',
    to: '/kader/dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: 'Pelayanan Hari-H',
    labelShort: 'Pelayanan',
    to: '/kader/pelayanan',
    icon: PlayCircle,
    end: false,
    activePrefix: '/kader/pelayanan',
  },
  {
    label: 'Profil Kader',
    labelShort: 'Profil',
    to: '/kader/profil',
    icon: User,
    end: false,
  },
]

// ── KaderLayout ───────────────────────────────────────────────────────────────

export default function KaderLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { clearAuth, user } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore error — clear session regardless
    }
    clearAuth()
    navigate('/login', { replace: true })
  }

  function isActive(item: NavItem, navLinkActive: boolean): boolean {
    if (item.activePrefix) {
      return location.pathname.startsWith(item.activePrefix)
    }
    return navLinkActive
  }

  const sidebarW = collapsed ? 'w-16' : 'w-64'

  return (
    <div className="flex bg-[#f9fafb] h-screen overflow-hidden">

      {/* Mobile dark overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 bg-white border-r border-[#f3f4f6] shadow-sm flex flex-col transition-all duration-300 ${sidebarW} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-16 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center shadow-sm z-50"
        >
          {collapsed
            ? <ChevronRight size={12} className="text-gray-500" />
            : <ChevronLeft size={12} className="text-gray-500" />
          }
        </button>

        {/* Branding */}
        <div className={`pt-5 pb-4 flex-shrink-0 ${collapsed ? 'px-3' : 'px-4'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-green-700 rounded-xl w-10 h-10 flex items-center justify-center flex-shrink-0">
              <Activity size={18} className="text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0 overflow-hidden">
                <p className="text-[#1e2939] font-extrabold text-base leading-tight">SISPOS</p>
                <p className="text-[#99a1af] text-xs leading-tight">Portal Kader</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive: navActive }) => {
                  const active = isActive(item, navActive)
                  return [
                    'flex items-center gap-3 rounded-xl transition-colors text-sm font-medium',
                    collapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5',
                    active
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'text-gray-600 hover:bg-gray-50',
                  ].join(' ')
                }}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-[#f3f4f6] px-2 pb-4 pt-3 flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-xs">
                  {user?.namaLengkap?.[0]?.toUpperCase() ?? 'K'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[#364153] font-semibold text-sm truncate">
                  {user?.namaLengkap ?? 'Kader'}
                </p>
                <div className="flex items-center gap-1">
                  <MapPin size={10} className="text-[#99a1af] flex-shrink-0" />
                  <p className="text-[#99a1af] text-xs truncate">Posyandu Anda</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => void handleLogout()}
            className={[
              'flex items-center gap-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-colors',
              collapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2',
            ].join(' ')}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-20 md:hidden bg-white border-b border-[#f3f4f6] h-14 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-gray-600 hover:bg-gray-100"
          aria-label="Buka menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center gap-2">
          <div className="bg-green-700 rounded-lg w-7 h-7 flex items-center justify-center">
            <Activity size={14} className="text-white" />
          </div>
          <span className="font-bold text-[#1e2939] text-sm">SISPOS</span>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main
        className={`flex-1 flex flex-col min-h-0 overflow-hidden transition-all duration-300 pt-14 md:pt-0 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}
      >
        {/* Scrollable content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </div>

        {/* ── Mobile Bottom Navigation ──────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#f3f4f6] shadow-lg">
          <div className="grid grid-cols-3 h-16">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive: navActive }) => {
                    const active = isActive(item, navActive)
                    return [
                      'flex flex-col items-center justify-center gap-0.5 transition-colors',
                      active ? 'text-green-700' : 'text-gray-500',
                    ].join(' ')
                  }}
                >
                  <Icon size={20} />
                  <span className="text-[10px] leading-tight">{item.labelShort}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      </main>
    </div>
  )
}
