import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  CalendarPlus,
  TrendingUp,
  MessageCircle,
  Users,
  User,
  LogOut,
  MapPin,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
  end: boolean
  /** When set, the item is active for any path that starts with this prefix */
  activePrefix?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Beranda',
    to: '/citizen/dashboard',
    icon: Home,
    end: true,
  },
  {
    label: 'Antrian',
    to: '/citizen/antrian/pilih-tanggal',
    icon: CalendarPlus,
    end: false,
    activePrefix: '/citizen/antrian',
  },
  {
    label: 'Tumbuh Kembang',
    to: '/citizen/tumbuh-kembang',
    icon: TrendingUp,
    end: false,
  },
  {
    label: 'AI Assistant',
    to: '/citizen/chat-gizi',
    icon: MessageCircle,
    end: false,
  },
  {
    label: 'Family Account',
    to: '/citizen/family-account',
    icon: Users,
    end: false,
  },
  {
    label: 'Profil Saya',
    to: '/citizen/profil',
    icon: User,
    end: false,
  },
]

// Mobile bottom nav — only first 4 items
const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 4)

// ── CitizenLayout ─────────────────────────────────────────────────────────────

export default function CitizenLayout() {
  const navigate = useNavigate()
  const location = useLocation()
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

  function isActive(item: NavItem, navLinkActive: boolean): boolean {
    if (item.activePrefix) {
      return location.pathname.startsWith(item.activePrefix)
    }
    return navLinkActive
  }

  const firstLetter = user?.namaLengkap?.[0]?.toUpperCase() ?? 'W'

  return (
    <div className="flex flex-col md:flex-row bg-[#f9fafb] h-screen overflow-hidden">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex md:flex-col md:h-full bg-white border-r border-[#f3f4f6] flex-shrink-0"
        style={{ width: '256px' }}
      >
        {/* Branding */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="bg-[#00a63e] rounded-[14px] w-10 h-10 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">SP</span>
            </div>
            <div>
              <p className="text-[#1e2939] font-extrabold text-base leading-tight">SISPOS</p>
              <p className="text-[#99a1af] text-xs leading-tight">Portal Warga</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive: navActive }) => {
                  const active = isActive(item, navActive)
                  return active
                    ? 'bg-[#f0fdf4] border border-[#b9f8cf] text-[#008236] font-semibold rounded-[14px] flex items-center gap-3 px-[13px] py-[11px] text-sm'
                    : 'text-[#4a5565] rounded-[14px] flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors'
                }}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User section at bottom */}
        <div className="px-3 pb-5 pt-3 border-t border-[#f3f4f6] flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-[#008236] rounded-[10px] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">{firstLetter}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[#364153] font-semibold text-sm truncate">
                {user?.namaLengkap ?? 'Warga'}
              </p>
              <div className="flex items-center gap-1">
                <MapPin size={10} className="text-[#99a1af] flex-shrink-0" />
                <p className="text-[#99a1af] text-xs truncate">Posyandu Anda</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="text-[#fb2c36] hover:bg-red-50 flex items-center gap-2 px-3 py-2 rounded-[14px] text-sm w-full transition-colors"
          >
            <LogOut size={16} className="flex-shrink-0" />
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
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#f3f4f6] shadow-lg">
          <div className="grid grid-cols-4 h-16">
            {MOBILE_NAV_ITEMS.map((item) => {
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
                      active ? 'text-[#008236]' : 'text-[#4a5565]',
                    ].join(' ')
                  }}
                >
                  <Icon size={20} />
                  <span className="text-[10px] text-center leading-tight max-w-[64px] truncate">
                    {item.label}
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
