/**
 * TumbuhKembangPage — Riwayat tumbuh kembang balita (Figma Make GrowthChartPage).
 *
 * Route: /citizen/tumbuh-kembang
 *
 * Fitur:
 * - Green header dengan ← back button + 3 stat cards (BB, TB, Z-Score)
 * - Tab navigation: Grafik | Riwayat | Imunisasi
 * - Grafik tab: chart type pills (Z-Score / Berat Badan / Tinggi Badan) + ZScoreChart
 * - Riwayat tab: daftar pemeriksaan historis
 * - Imunisasi tab: riwayat imunisasi dengan CheckCircle icon
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Syringe } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { Skeleton } from '@/components/ui/skeleton'
import { ZScoreChart, type ZScoreDataPoint } from '@/components/kader/ZScoreChart'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RiwayatRecord {
  id: string
  createdAt?: string
  tanggalPemeriksaan: string
  beratBadan: number
  tinggiBadan: number
  zScoreBbU?: number | null
  zScoreTbU?: number | null
  zScoreBbTb?: number | null
  statusGizi: string
}

interface LatestStats {
  beratBadan?: number
  tinggiBadan?: number
  zScoreBbU?: number | null
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
  if (s.includes('normal')) return 'bg-green-100 text-green-700'
  if (s.includes('kurang') || s.includes('kurus')) return 'bg-amber-100 text-amber-700'
  if (s.includes('buruk') || s.includes('sangat')) return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TumbuhKembangPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'grafik' | 'riwayat' | 'imunisasi'>('riwayat')
  const [chartType, setChartType] = useState<'zscore' | 'bb' | 'tb'>('zscore')

  // Fetch riwayat pemeriksaan — GET /api/growth/riwayat
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

  // riwayatData is sorted desc (newest first from API)
  // riwayatData[0] = latest record
  const latest: LatestStats =
    riwayatData && riwayatData.length > 0
      ? {
          beratBadan: riwayatData[0].beratBadan,
          tinggiBadan: riwayatData[0].tinggiBadan,
          zScoreBbU: riwayatData[0].zScoreBbU,
        }
      : {}

  // Sort ascending for chart
  const sortedData = [...(riwayatData ?? [])].sort((a, b) => {
    const tA = new Date(a.tanggalPemeriksaan ?? a.createdAt).getTime()
    const tB = new Date(b.tanggalPemeriksaan ?? b.createdAt).getTime()
    return tA - tB
  })

  // Grafik data for Z-Score chart
  const grafikData: ZScoreDataPoint[] = sortedData.map((record) => {
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

  // Grafik data for BB/TB line charts
  interface SimpleDataPoint { tanggal: string; value: number }
  const bbData: SimpleDataPoint[] = sortedData.map((record) => ({
    tanggal: new Date(record.tanggalPemeriksaan ?? record.createdAt).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }),
    value: record.beratBadan,
  }))
  const tbData: SimpleDataPoint[] = sortedData.map((record) => ({
    tanggal: new Date(record.tanggalPemeriksaan ?? record.createdAt).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }),
    value: record.tinggiBadan,
  }))

  // Z-Score trigger: which indicator drove the statusGizi badge?
  const latestRecord = riwayatData?.[0]
  const triggerIndicator = (() => {
    if (!latestRecord) return null
    const { zScoreBbU, zScoreTbU, zScoreBbTb } = latestRecord
    if (zScoreBbU != null && zScoreBbU < -3) return { ind: 'BB/U', z: zScoreBbU }
    if (zScoreBbTb != null && zScoreBbTb < -3) return { ind: 'BB/TB', z: zScoreBbTb }
    if (zScoreTbU != null && zScoreTbU < -3) return { ind: 'TB/U', z: zScoreTbU }
    if (zScoreBbU != null && zScoreBbU < -2) return { ind: 'BB/U', z: zScoreBbU }
    if (zScoreBbTb != null && zScoreBbTb < -2) return { ind: 'BB/TB', z: zScoreBbTb }
    if (zScoreTbU != null && zScoreTbU < -2) return { ind: 'TB/U', z: zScoreTbU }
    return null
  })()

  const statCards = [
    {
      label: 'BB',
      value: latest.beratBadan !== undefined ? `${latest.beratBadan} kg` : '—',
    },
    {
      label: 'TB',
      value: latest.tinggiBadan !== undefined ? `${latest.tinggiBadan} cm` : '—',
    },
    {
      label: triggerIndicator ? `Z (${triggerIndicator.ind})` : 'Z-Score BB/U',
      value: triggerIndicator
        ? triggerIndicator.z.toFixed(2)
        : (latest.zScoreBbU != null ? latest.zScoreBbU.toFixed(2) : '—'),
    },
  ]

  const chartTypePills = [
    { key: 'zscore' as const, label: 'Z-Score' },
    { key: 'bb' as const, label: 'Berat Badan' },
    { key: 'tb' as const, label: 'Tinggi Badan' },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-gray-50 pb-8">
      {/* ── Green header ─────────────────────────────────────────────────── */}
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="bg-green-600/50 rounded-xl p-2 flex-shrink-0"
            aria-label="Kembali"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-2xl leading-tight">Tumbuh Kembang</h1>
            <p className="text-green-200 text-xs">Data balita</p>
          </div>
        </div>

        {/* 3 stat cards */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white/15 rounded-xl p-3">
              <p className="text-green-200 text-xs">{stat.label}</p>
              <p className="text-white font-bold text-base mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab navigation ────────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div className="flex bg-white rounded-xl p-1 border border-gray-100 shadow-sm">
          {(['grafik', 'riwayat', 'imunisasi'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-green-700 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'grafik' ? 'Grafik' : tab === 'riwayat' ? 'Riwayat' : 'Imunisasi'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="px-4 mt-4 space-y-3">

        {/* ── Grafik tab ───────────────────────────────────────────────────── */}
        {activeTab === 'grafik' && (
          <>
            {isLoading && <Skeleton className="h-[300px] rounded-2xl" />}

            {!isLoading && grafikData.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                Belum ada data pemeriksaan untuk ditampilkan.
              </p>
            )}

            {!isLoading && sortedData.length > 0 && (
              <>
                {/* Chart type pills */}
                <div className="flex gap-2">
                  {chartTypePills.map((pill) => (
                    <button
                      key={pill.key}
                      onClick={() => setChartType(pill.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        chartType === pill.key
                          ? 'bg-green-700 text-white'
                          : 'bg-white border border-gray-200 text-gray-600'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Z-Score chart */}
                {chartType === 'zscore' && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                    <p className="text-gray-400 text-xs font-semibold tracking-wider mb-3">
                      GRAFIK Z-SCORE (BB/U · TB/U · BB/TB)
                    </p>
                    <ZScoreChart data={grafikData} />
                    {/* Interpretation */}
                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                      <p className="text-gray-500 text-xs font-semibold mb-2">Interpretasi Z-Score:</p>
                      {[
                        { range: 'Z > +2', label: 'Gemuk / Tinggi', color: 'bg-blue-100 text-blue-700' },
                        { range: '-2 s/d +2', label: 'Normal', color: 'bg-green-100 text-green-700' },
                        { range: '-3 s/d -2', label: 'Kurang', color: 'bg-amber-100 text-amber-700' },
                        { range: 'Z < -3', label: 'Buruk', color: 'bg-red-100 text-red-700' },
                      ].map((item) => (
                        <div key={item.range} className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.color}`}>
                            {item.range}
                          </span>
                          <span className="text-gray-500 text-xs">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Berat Badan chart */}
                {chartType === 'bb' && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                    <p className="text-gray-400 text-xs font-semibold tracking-wider mb-3">
                      GRAFIK BERAT BADAN (kg)
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={bbData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => `${String(v)} kg`} />
                        <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 2" />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="BB (kg)"
                          stroke="#10b981"
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tinggi Badan chart */}
                {chartType === 'tb' && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                    <p className="text-gray-400 text-xs font-semibold tracking-wider mb-3">
                      GRAFIK TINGGI BADAN (cm)
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={tbData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => `${String(v)} cm`} />
                        <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 2" />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="TB (cm)"
                          stroke="#3b82f6"
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </>
        )}

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
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                <p className="text-gray-800 font-semibold text-sm">Belum ada data pemeriksaan</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
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
                  className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-gray-800 font-semibold text-sm">
                        {formatDate(record.tanggalPemeriksaan ?? record.createdAt)}
                      </p>
                      <p className="text-gray-400 text-xs">Pemeriksaan rutin</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-xl ${getStatusStyle(
                        record.statusGizi
                      )}`}
                    >
                      {record.statusGizi}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-2 text-center">
                      <p className="text-gray-700 font-bold text-sm">{record.beratBadan} kg</p>
                      <p className="text-gray-400 text-xs">BB</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-2 text-center">
                      <p className="text-gray-700 font-bold text-sm">{record.tinggiBadan} cm</p>
                      <p className="text-gray-400 text-xs">TB</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {([
                      { label: 'BB/U', val: record.zScoreBbU },
                      { label: 'TB/U', val: record.zScoreTbU },
                      { label: 'BB/TB', val: record.zScoreBbTb },
                    ] as const).map(({ label, val }) => {
                      const v = val ?? null
                      const isCritical = v !== null && v < -3
                      const isWarn = v !== null && v < -2 && !isCritical
                      const color = isCritical
                        ? 'bg-red-50 text-red-700'
                        : isWarn ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                      return (
                        <div key={label} className={`${color} rounded-xl p-2 text-center`}>
                          <p className="font-bold text-sm">{v != null ? v.toFixed(2) : '—'}</p>
                          <p className="text-xs opacity-70">{label}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
          </>
        )}

        {/* ── Imunisasi tab ────────────────────────────────────────────────── */}
        {activeTab === 'imunisasi' && (
          <>
            {isLoadingImunisasi && <Skeleton className="h-24 rounded-2xl" />}

            {!isLoadingImunisasi && (!imunisasiList || imunisasiList.length === 0) && (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                <Syringe size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Belum ada riwayat imunisasi.</p>
              </div>
            )}

            {!isLoadingImunisasi &&
              imunisasiList &&
              imunisasiList.length > 0 &&
              imunisasiList.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-start gap-3"
                >
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 size={18} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-semibold text-sm">{item.namaVaksin}</p>
                    <p className="text-gray-400 text-xs mt-0.5">Dosis ke-{item.dosisKe}</p>
                    <p className="text-gray-500 text-xs mt-1">{formatDate(item.tanggalInjeksi)}</p>
                    {item.keterangan && (
                      <p className="text-gray-400 text-xs mt-1 italic">{item.keterangan}</p>
                    )}
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    Selesai
                  </span>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  )
}
