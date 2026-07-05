/**
 * TumbuhKembangPage — Riwayat tumbuh kembang balita.
 *
 * Route: /citizen/tumbuh-kembang
 *
 * Fitur:
 * - Green header dengan 3 stat cards (BB, TB, Z-Score)
 * - Tab navigation: Grafik | Riwayat | Imunisasi
 * - Grafik tab: ZScoreChart dari riwayatData (zScoreBbU, zScoreTbU, zScoreBbTb)
 * - Riwayat tab: daftar pemeriksaan historis
 * - Imunisasi tab: riwayat imunisasi dari GET /api/immunization/riwayat
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { ZScoreChart, type ZScoreDataPoint } from '@/components/kader/ZScoreChart'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RiwayatRecord {
  id: string
  createdAt: string
  tanggalPemeriksaan?: string
  beratBadan: number
  tinggiBadan: number
  zScore: number
  zScoreBbU?: number | null
  zScoreTbU?: number | null
  zScoreBbTb?: number | null
  statusGizi: string
}

interface LatestStats {
  beratBadan?: number
  tinggiBadan?: number
  zScore?: number
}

interface ImunisasiItem {
  id: string
  namaVaksin: string
  dosisKe: number
  tanggalInjeksi: string
  keterangan?: string | null
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

  // Fetch riwayat pemeriksaan (riwayatData) — GET /api/growth/riwayat
  const { data: riwayatData, isLoading } = useQuery<RiwayatRecord[]>({
    queryKey: ['growth', 'riwayat'],
    queryFn: () =>
      apiClient.get('/growth/riwayat').then((r) => {
        const d = r.data.data
        return Array.isArray(d) ? d : []
      }),
    staleTime: 60_000,
    retry: false,
  })

  // Fetch riwayat imunisasi — GET /api/immunization/riwayat (citizen-scoped via JWT)
  const { data: imunisasiList, isLoading: isLoadingImunisasi } = useQuery<ImunisasiItem[]>({
    queryKey: ['imunisasi', 'citizen'],
    queryFn: () =>
      apiClient.get('/immunization/riwayat').then((r) => {
        const d = r.data.data
        return Array.isArray(d) ? d : []
      }),
    staleTime: 60_000,
    retry: false,
  })

  // Derive latest stats from most recent record
  const latest: LatestStats =
    riwayatData && riwayatData.length > 0
      ? {
          beratBadan: riwayatData[0].beratBadan,
          tinggiBadan: riwayatData[0].tinggiBadan,
          zScore: riwayatData[0].zScore,
        }
      : {}

  // Grafik data — sort riwayatData ascending by date, then map to ZScoreDataPoint[]
  const grafikData: ZScoreDataPoint[] = [...(riwayatData ?? [])]
    .sort((a, b) => {
      const tA = new Date(a.tanggalPemeriksaan ?? a.createdAt).getTime()
      const tB = new Date(b.tanggalPemeriksaan ?? b.createdAt).getTime()
      return tA - tB
    })
    .map((record) => {
      const dateStr = record.tanggalPemeriksaan ?? record.createdAt
      const tanggal = new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
      return {
        tanggal,
        bbU: record.zScoreBbU ?? null,
        tbU: record.zScoreTbU ?? null,
        bbTb: record.zScoreBbTb ?? null,
      }
    })

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

            {!isLoading && (!riwayatData || riwayatData.length === 0) && (
              <div className="bg-white border border-[#f3f4f6] rounded-2xl p-8 text-center shadow-sm">
                <p className="text-[#1e2939] font-semibold text-sm">Belum ada data pemeriksaan</p>
                <p className="text-[#99a1af] text-xs mt-1 leading-relaxed">
                  Data tumbuh kembang akan ditampilkan setelah pemeriksaan pertama di Posyandu.
                </p>
              </div>
            )}

            {!isLoading &&
              riwayatData &&
              riwayatData.length > 0 &&
              riwayatData.map((record) => (
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
          <>
            {isLoading && <Skeleton className="h-[260px] rounded-2xl" />}

            {!isLoading && grafikData.length === 0 && (
              <p className="text-[#99a1af] text-sm text-center py-8">
                Belum ada data pemeriksaan untuk ditampilkan.
              </p>
            )}

            {!isLoading && grafikData.length > 0 && (
              <div className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm p-4">
                <p className="text-[#99a1af] text-xs font-semibold tracking-wider mb-3">
                  GRAFIK Z-SCORE
                </p>
                <ZScoreChart data={grafikData} />
              </div>
            )}
          </>
        )}

        {/* ── Imunisasi tab ────────────────────────────────────────────────── */}
        {activeTab === 'imunisasi' && (
          <>
            {isLoadingImunisasi && <Skeleton className="h-24 rounded-2xl" />}

            {!isLoadingImunisasi && (!imunisasiList || imunisasiList.length === 0) && (
              <p className="text-[#99a1af] text-sm text-center py-8">
                Belum ada riwayat imunisasi.
              </p>
            )}

            {!isLoadingImunisasi &&
              imunisasiList &&
              imunisasiList.length > 0 &&
              imunisasiList.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#f3f4f6] rounded-2xl px-4 py-3 shadow-sm"
                >
                  <p className="text-[#1e2939] font-semibold text-sm">{item.namaVaksin}</p>
                  <p className="text-[#99a1af] text-xs mt-0.5">Dosis ke-{item.dosisKe}</p>
                  <p className="text-[#6a7282] text-xs mt-1">{formatDate(item.tanggalInjeksi)}</p>
                  {item.keterangan && (
                    <p className="text-[#99a1af] text-xs mt-1 italic">{item.keterangan}</p>
                  )}
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  )
}
