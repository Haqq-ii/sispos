import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Heart,
  Clock,
  TrendingUp,
  MessageSquare,
  Users,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react'
import { SisposLogo } from '@/components/brand/SisposLogo'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
  end: boolean
  activePrefix?: string
  sidebarOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Beranda',
    to: '/citizen/dashboard',
    icon: Heart,
    end: true,
  },
  {
    label: 'Antrian',
    to: '/citizen/antrian/pilih-tanggal',
    icon: Clock,
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
    label: 'AI Konsultasi Gizi',
    to: '/citizen/chat-assistant',
    icon: MessageSquare,
    end: false,
  },
  {
    label: 'Family Account',
    to: '/citizen/family-account',
    icon: Users,
    end: false,
    sidebarOnly: true,
  },
  {
    label: 'Profil Saya',
    to: '/citizen/profil',
    icon: User,
    end: false,
  },
]

const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.sidebarOnly)

// ── CitizenLayout ─────────────────────────────────────────────────────────────

export default function CitizenLayout() {
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

  function checkActive(item: NavItem, navLinkActive: boolean): boolean {
    if (item.activePrefix) {
      return location.pathname.startsWith(item.activePrefix)
    }
    return navLinkActive
  }

  const sidebarW = collapsed ? 'w-16' : 'w-64'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1"
          aria-label="Buka menu"
        >
          <Menu size={22} className="text-gray-700" />
        </button>
        <div className="flex items-center gap-2">
          <SisposLogo size={28} variant="black" className="rounded-lg" />
          <span className="font-bold text-gray-900 text-sm">SISPOS</span>
        </div>
      </div>

      {/* ── Mobile overlay ──────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 bg-white border-r shadow-sm flex flex-col transition-all duration-200 ${sidebarW} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Toggle button (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-16 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center z-50 shadow-sm"
          aria-label={collapsed ? 'Perlebar sidebar' : 'Perkecil sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={12} className="text-gray-600" />
          ) : (
            <ChevronLeft size={12} className="text-gray-600" />
          )}
        </button>

        {/* Logo area */}
        <div
          className={`px-3 pt-5 pb-4 flex items-center flex-shrink-0 ${
            collapsed ? 'justify-center' : 'gap-3'
          }`}
        >
          <SisposLogo size={40} variant="black" />
          {!collapsed && (
            <div>
              <p className="font-extrabold text-gray-900 text-base leading-tight">SISPOS</p>
              <p className="text-gray-400 text-xs leading-tight">Portal Warga</p>
            </div>
          )}
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
                  const active = checkActive(item, navActive)
                  return [
                    'flex items-center rounded-xl transition-colors',
                    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                    active
                      ? 'bg-green-50 text-green-700 border border-green-200 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50',
                  ].join(' ')
                }}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User + logout */}
        <div
          className={`border-t px-2 py-3 flex-shrink-0 ${
            collapsed ? 'flex flex-col items-center gap-2' : ''
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-xs">
                  {user?.namaLengkap?.[0]?.toUpperCase() ?? 'W'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-gray-800 font-semibold text-sm truncate">
                  {user?.namaLengkap ?? 'Warga'}
                </p>
                <p className="text-gray-400 text-xs truncate">Posyandu Anda</p>
              </div>
            </div>
          )}
          <button
            onClick={() => void handleLogout()}
            className={`text-red-600 hover:bg-red-50 flex items-center rounded-xl text-sm transition-colors w-full ${
              collapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2'
            }`}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-200 pt-14 md:pt-0 ${
          collapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </div>

        {/* ── Mobile Bottom Navigation ─────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg">
          <div className="grid grid-cols-5 h-16">
            {BOTTOM_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive: navActive }) => {
                    const active = checkActive(item, navActive)
                    return [
                      'flex flex-col items-center justify-center gap-0.5 transition-colors',
                      active ? 'text-green-700' : 'text-gray-500',
                    ].join(' ')
                  }}
                >
                  <Icon size={20} />
                  <span className="text-[9px] text-center leading-tight max-w-[56px] truncate">
                    {item.label}
                  </span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
