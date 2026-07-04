import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut, ClipboardList, ChevronRight, Play, Download } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { useActiveMeja } from '@/hooks/useActiveMeja'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePwaStore } from '@/stores/usePwaStore'
import { SyncPendingBadge } from '@/components/offline/SyncPendingBadge'
import apiClient from '@/lib/axios'

interface TodaySlot {
  id: string
  nomorSesi: number
  labelSesi: string
  jamMulai: string
  jamSelesai: string
  kuota: number
  terisi: number
  durasiRataAktual: number | null
  totalAntrian: number
}

interface TodayJadwal {
  jadwalId: string
  tanggalPelaksanaan: string
  estimasiDurasiMenit: number
  statusJadwal: string
  slotSesi: TodaySlot[]
}

export default function KaderDashboardPage() {
  const navigate = useNavigate()
  const { clearAuth, user } = useAuthStore()
  const { setActiveMeja, setLocked } = useKaderMejaStore()
  const { deferredPrompt, triggerInstall } = usePwaStore()
  const showInstall = deferredPrompt !== null && !window.matchMedia('(display-mode: standalone)').matches

  const { data: activeMejaData, isLoading: isLoadingActiveMeja } = useActiveMeja()

  const { data: todayJadwal, isLoading: isLoadingJadwal } = useQuery<TodayJadwal | null>({
    queryKey: ['kader', 'today-slots'],
    queryFn: () =>
      apiClient.get('/kader/today-slots').then((r) => r.data.data as TodayJadwal | null),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!isLoadingActiveMeja && activeMejaData) {
      setActiveMeja(activeMejaData.activeMeja, activeMejaData.slotId)
      setLocked(true)
      // Always recover to Meja 1 — mejas 3-5 require router state (antrianId/pemeriksaanId)
      // that isn't persisted across page reloads
      navigate('/kader/meja/1', { replace: true })
    }
  }, [isLoadingActiveMeja, activeMejaData, navigate, setActiveMeja, setLocked])

  const handleLogout = async () => {
    try { await apiClient.post('/auth/logout') } catch {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  const totalKuota = todayJadwal?.slotSesi.reduce((s, sl) => s + sl.kuota, 0) ?? 0
  const totalTerdaftar = todayJadwal?.slotSesi.reduce((s, sl) => s + sl.terisi, 0) ?? 0
  const totalAntrian = todayJadwal?.slotSesi.reduce((s, sl) => s + sl.totalAntrian, 0) ?? 0
  const isLoading = isLoadingActiveMeja || isLoadingJadwal

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-12 pb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Selamat datang,</p>
            <p className="text-white font-bold text-xl leading-tight">
              {user?.namaLengkap ?? 'Kader'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[#b9f8cf] text-xs">Kader Posyandu</p>
              {user?.role === 'ketua_kader' && (
                <span className="bg-[#ffb900] text-[#7b3306] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  KETUA
                </span>
              )}
            </div>
            <div className="mt-2">
              <SyncPendingBadge />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {showInstall && (
              <button
                onClick={() => { void triggerInstall() }}
                className="bg-[rgba(0,166,62,0.6)] border border-[rgba(0,201,80,0.5)] rounded-xl px-3 py-1.5 text-white text-xs font-medium flex items-center gap-1.5 min-h-[44px]"
              >
                <Download className="h-3.5 w-3.5" />
                Pasang Aplikasi
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-[rgba(255,255,255,0.15)] rounded-xl p-2.5"
            >
              <LogOut size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[62px] rounded-[14px] bg-white/20" />
            ))}
          </div>
        ) : todayJadwal ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-white font-bold text-2xl leading-none">{totalKuota}</p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Total<br/>Kuota</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-white font-bold text-2xl leading-none">{totalTerdaftar}</p>
              <p className="text-[#b9f8cf] text-[10px] leading-tight mt-1">Hadir<br/>Hari Ini</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-[#ffd230] font-bold text-2xl leading-none">{totalAntrian}</p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Antrian<br/>Aktif</p>
            </div>
          </div>
        ) : (
          <div className="bg-[rgba(255,255,255,0.12)] rounded-[14px] px-3 py-3 text-center">
            <p className="text-[#b9f8cf] text-xs">Tidak ada jadwal hari ini</p>
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </>
        ) : !todayJadwal ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="text-gray-300 mb-3" size={48} />
            <p className="text-sm text-gray-500">Tidak ada jadwal pelayanan hari ini.</p>
            <p className="text-xs text-gray-400 mt-1">Hubungi Puskesmas untuk membuat jadwal.</p>
          </div>
        ) : (
          <>
            {/* JADWAL PELAYANAN card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Jadwal Pelayanan
              </p>
              {todayJadwal.slotSesi.map((slot) => {
                const pct = slot.kuota > 0 ? Math.round((slot.terisi / slot.kuota) * 100) : 0
                return (
                  <div key={slot.id} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{slot.labelSesi}</p>
                        <p className="text-xs text-gray-400">{slot.jamMulai} – {slot.jamSelesai} WIB</p>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        {slot.terisi}/{slot.kuota}
                      </span>
                    </div>
                    <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00a63e] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Mulai Pelayanan per slot */}
            {todayJadwal.slotSesi.map((slot) => (
              <button
                key={slot.id}
                onClick={() =>
                  navigate('/kader/pelayanan', {
                    state: { slotId: slot.id, slotLabel: slot.labelSesi },
                  })
                }
                className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3.5 flex items-center justify-between active:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#008236] rounded-xl flex items-center justify-center">
                    <Play size={16} className="text-white fill-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">Mulai Pelayanan Hari-H</p>
                    <p className="text-xs text-gray-500">{slot.labelSesi} · {slot.jamMulai} WIB</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
