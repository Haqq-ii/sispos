/**
 * TumbuhKembangPage — Riwayat tumbuh kembang balita.
 *
 * Route: /citizen/tumbuh-kembang
 *
 * Fitur:
 * - Green header dengan 3 stat cards (BB, TB, Z-Score)
 * - Tab navigation: Grafik | Riwayat | Imunisasi
 * - Default tab: Riwayat — menampilkan daftar pemeriksaan historis
 * - Grafik & Imunisasi: placeholder "segera hadir"
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RiwayatRecord {
  id: string
  createdAt: string
  beratBadan: number
  tinggiBadan: number
  zScore: number
  statusGizi: string
}

interface LatestStats {
  beratBadan?: number
  tinggiBadan?: number
  zScore?: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(isoStr: string): string {
  const d = new Date(isoStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function getStatusStyle(status: string): string {
  const s = status?.toLowerCase() ?? ''
  if (s.includes('normal')) return 'bg-[#dcfce7] text-[#008236]'
  if (s.includes('kurang') || s.includes('kurus')) return 'bg-[#fef3c6] text-[#b45309]'
  if (s.includes('buruk') || s.includes('sangat')) return 'bg-[#fee2e2] text-[#dc2626]'
  return 'bg-[#f3f4f6] text-[#6a7282]'
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TumbuhKembangPage() {
  const [activeTab, setActiveTab] = useState<'grafik' | 'riwayat' | 'imunisasi'>('riwayat')

  // Fetch riwayat pemeriksaan — try /growth/riwayat
  const { data: riwayat, isLoading } = useQuery<RiwayatRecord[]>({
    queryKey: ['growth', 'riwayat'],
    queryFn: () =>
      apiClient.get('/growth/riwayat').then((r) => {
        const d = r.data.data
        return Array.isArray(d) ? d : []
      }),
    staleTime: 60_000,
    // Gracefully handle 404 / not-yet-implemented endpoints
    retry: false,
  })

  // Derive latest stats from most recent record
  const latest: LatestStats =
    riwayat && riwayat.length > 0
      ? {
          beratBadan: riwayat[0].beratBadan,
          tinggiBadan: riwayat[0].tinggiBadan,
          zScore: riwayat[0].zScore,
        }
      : {}

  const statCards = [
    {
      label: 'Berat Badan',
      value: latest.beratBadan !== undefined ? `${latest.beratBadan} kg` : '-- kg',
    },
    {
      label: 'Tinggi Badan',
      value: latest.tinggiBadan !== undefined ? `${latest.tinggiBadan} cm` : '-- cm',
    },
    {
      label: 'Z-Score',
      value: latest.zScore !== undefined ? String(latest.zScore) : '--',
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[#f9fafb] pb-8">
      {/* ── Green header ─────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/citizen/dashboard"
            className="bg-[rgba(0,166,62,0.5)] rounded-[14px] p-2 flex-shrink-0"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft size={20} className="text-white" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-2xl leading-tight">Tumbuh Kembang</h1>
            <p className="text-[#b9f8cf] text-xs">Data balita</p>
          </div>
        </div>

        {/* 3 stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-[rgba(255,255,255,0.15)] rounded-[14px] p-3">
              <p className="text-[#b9f8cf] text-xs">{stat.label}</p>
              <p className="text-white font-bold text-base mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab navigation ────────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div className="bg-white border border-[#f3f4f6] rounded-[14px] p-1 flex gap-1 shadow-sm">
          {(['grafik', 'riwayat', 'imunisasi'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-[#008236] text-white shadow-sm'
                  : 'text-[#6a7282] hover:text-[#364153]'
              }`}
            >
              {tab === 'grafik' ? 'Grafik' : tab === 'riwayat' ? 'Riwayat' : 'Imunisasi'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="px-4 mt-4 space-y-3">
        {/* ── Riwayat tab ─────────────────────────────────────────────────── */}
        {activeTab === 'riwayat' && (
          <>
            {isLoading && (
              <>
                <Skeleton className="h-[120px] rounded-2xl" />
                <Skeleton className="h-[120px] rounded-2xl" />
                <Skeleton className="h-[120px] rounded-2xl" />
              </>
            )}

            {!isLoading && (!riwayat || riwayat.length === 0) && (
              <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 text-center shadow-sm">
                <p className="text-[#1e2939] font-semibold text-sm">Belum ada data pemeriksaan</p>
                <p className="text-[#99a1af] text-xs mt-1 leading-relaxed">
                  Data tumbuh kembang akan ditampilkan setelah pemeriksaan pertama di Posyandu.
                </p>
              </div>
            )}

            {!isLoading &&
              riwayat &&
              riwayat.length > 0 &&
              riwayat.map((record) => (
                <div
                  key={record.id}
                  className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[#1e2939] font-semibold text-sm">
                        {formatDate(record.createdAt)}
                      </p>
                      <p className="text-[#99a1af] text-xs">Pemeriksaan rutin</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-[10px] ${getStatusStyle(
                        record.statusGizi
                      )}`}
                    >
                      {record.statusGizi}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-[#f9fafb] border border-[#f3f4f6] rounded-[10px] p-2 text-center">
                      <p className="text-[#364153] font-bold text-sm">{record.beratBadan} kg</p>
                      <p className="text-[#99a1af] text-xs">BB</p>
                    </div>
                    <div className="bg-[#f9fafb] border border-[#f3f4f6] rounded-[10px] p-2 text-center">
                      <p className="text-[#364153] font-bold text-sm">{record.tinggiBadan} cm</p>
                      <p className="text-[#99a1af] text-xs">TB</p>
                    </div>
                    <div className="bg-[#f0fdf4] rounded-[10px] p-2 text-center">
                      <p className="text-[#008236] font-bold text-sm">{record.zScore}</p>
                      <p className="text-[#99a1af] text-xs">Z-Score</p>
                    </div>
                  </div>
                </div>
              ))}
          </>
        )}

        {/* ── Grafik tab ───────────────────────────────────────────────────── */}
        {activeTab === 'grafik' && (
          <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 text-center shadow-sm">
            <p className="text-[#99a1af]">Fitur akan segera tersedia</p>
          </div>
        )}

        {/* ── Imunisasi tab ────────────────────────────────────────────────── */}
        {activeTab === 'imunisasi' && (
          <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 text-center shadow-sm">
            <p className="text-[#99a1af]">Fitur akan segera tersedia</p>
          </div>
        )}
      </div>
    </div>
  )
}
