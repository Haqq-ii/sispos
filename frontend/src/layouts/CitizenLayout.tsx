import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarPlus,
  MessageCircle,
  CalendarCheck,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  label: string
  labelMobile: string
  to: string
  icon: React.ElementType
  end: boolean
  /** When set, the item is active for any path that starts with this prefix */
  activePrefix?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    labelMobile: 'Dashboard',
    to: '/citizen/dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: 'Antrian',
    labelMobile: 'Antrian',
    to: '/citizen/antrian/pilih-tanggal',
    icon: CalendarPlus,
    end: false,
    activePrefix: '/citizen/antrian',
  },
  {
    label: 'Asisten Gizi',
    labelMobile: 'Asisten',
    to: '/citizen/chat-gizi',
    icon: MessageCircle,
    end: false,
  },
  {
    label: 'Daftar via Chat',
    labelMobile: 'Daftar Chat',
    to: '/citizen/chat-pendaftaran',
    icon: CalendarCheck,
    end: false,
  },
]

// ── CitizenLayout ─────────────────────────────────────────────────────────────

export default function CitizenLayout() {
  const navigate = useNavigate()
  const location = useLocation()
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

  function isActive(item: NavItem, navLinkActive: boolean): boolean {
    if (item.activePrefix) {
      return location.pathname.startsWith(item.activePrefix)
    }
    return navLinkActive
  }

  return (
    <div className="flex flex-col md:flex-row bg-gray-50 h-screen overflow-hidden">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:h-full bg-white border-r border-gray-200 shadow-sm flex-shrink-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#008236] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">SP</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">SISPOS</p>
              <p className="text-xs text-[#008236] font-medium">Warga / Citizen</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-green-50 text-[#008236] font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  ].join(' ')
                }}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-100 flex-shrink-0">
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
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Scrollable content — pb-20 leaves space above fixed mobile bottom nav */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </div>

        {/* ── Mobile Bottom Navigation ─────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
          <div className="grid grid-cols-4 h-16">
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
                      active ? 'text-[#008236]' : 'text-gray-500',
                    ].join(' ')
                  }}
                >
                  <Icon size={20} />
                  <span className="text-[10px] text-center leading-tight max-w-[64px] truncate">
                    {item.labelMobile}
                  </span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      </main>
    </div>
  )
}
