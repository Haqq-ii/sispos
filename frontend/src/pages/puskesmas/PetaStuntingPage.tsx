import 'leaflet/dist/leaflet.css'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import apiClient from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StuntingMapPoint {
  posyanduId: string
  namaPosyandu: string
  kelurahan: string
  lat: number
  lng: number
  total: number
  breakdown: Record<string, number>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function usePuskesmasStunting(bulan: string) {
  return useQuery<StuntingMapPoint[]>({
    queryKey: ['dashboard', 'stunting', bulan],
    queryFn: () =>
      apiClient
        .get('/dashboard/stunting', { params: { bulan } })
        .then((r) => r.data.data as StuntingMapPoint[]),
    enabled: !!bulan,
    staleTime: 5 * 60 * 1000,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBulanDefault(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

function formatBulanLabel(bulan: string): string {
  const [year, month] = bulan.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
}

function getRisikoCount(breakdown: Record<string, number>): number {
  return (
    (breakdown.buruk ?? 0) +
    (breakdown.sangat_pendek ?? 0) +
    (breakdown.kurang ?? 0) +
    (breakdown.pendek ?? 0)
  )
}

function getMarkerColor(breakdown: Record<string, number>): string {
  if ((breakdown.buruk ?? 0) + (breakdown.sangat_pendek ?? 0) > 0) return '#ef4444'
  if ((breakdown.kurang ?? 0) + (breakdown.pendek ?? 0) > 0) return '#f59e0b'
  return '#22c55e'
}

function getLevelBadge(breakdown: Record<string, number>): { label: string; cls: string } {
  const buruk = (breakdown.buruk ?? 0) + (breakdown.sangat_pendek ?? 0)
  const sedang = (breakdown.kurang ?? 0) + (breakdown.pendek ?? 0)
  if (buruk > 0) return { label: 'Tinggi', cls: 'bg-red-100 text-red-700' }
  if (sedang > 0) return { label: 'Sedang', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Rendah', cls: 'bg-green-100 text-green-700' }
}

// ── PetaStuntingPage ──────────────────────────────────────────────────────────

export default function PetaStuntingPage() {
  const [bulan, setBulan] = useState<string>(getBulanDefault)
  const { data: stuntingData, isLoading } = usePuskesmasStunting(bulan)

  const totalBalita = useMemo(
    () => (stuntingData ?? []).reduce((s, p) => s + p.total, 0),
    [stuntingData],
  )
  const totalRisiko = useMemo(
    () => (stuntingData ?? []).reduce((s, p) => s + getRisikoCount(p.breakdown), 0),
    [stuntingData],
  )
  const zonaKritis = useMemo(
    () =>
      (stuntingData ?? []).filter(
        (p) => (p.breakdown.buruk ?? 0) + (p.breakdown.sangat_pendek ?? 0) > 0,
      ).length,
    [stuntingData],
  )

  const ranked = useMemo(
    () =>
      [...(stuntingData ?? [])].sort(
        (a, b) => getRisikoCount(b.breakdown) - getRisikoCount(a.breakdown),
      ),
    [stuntingData],
  )

  const barData = useMemo(
    () =>
      ranked.map((p) => ({
        name: p.namaPosyandu.replace('Posyandu ', '').slice(0, 12),
        total: p.total,
        risiko: getRisikoCount(p.breakdown),
      })),
    [ranked],
  )

  return (
    <div className="min-h-full bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-800 font-bold text-lg">Peta Sebaran Stunting</h1>
            <p className="text-gray-400 text-xs">
              Visualisasi risiko stunting tingkat posyandu
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Bulan:</label>
            <input
              type="month"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-green-400 bg-white"
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5 pb-8">
        {/* ── KPI row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-gray-800 leading-none">{totalBalita}</p>
            <p className="text-gray-500 text-sm mt-1">Total Balita</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-red-600 leading-none">{totalRisiko}</p>
            <p className="text-gray-500 text-sm mt-1">Total Risiko Stunting</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-amber-600 leading-none">
              {totalBalita > 0 ? ((totalRisiko / totalBalita) * 100).toFixed(1) : '0'}%
            </p>
            <p className="text-gray-500 text-sm mt-1">Tingkat Risiko</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-red-700 leading-none">{zonaKritis}</p>
            <p className="text-gray-500 text-sm mt-1">Zona Kritis</p>
          </div>
        </div>

        {/* ── Map + Ranking ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Map */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-gray-800 text-sm font-bold">Peta Wilayah Kerja</p>
              <div className="flex items-center gap-4 text-xs">
                {[
                  { color: '#22c55e', label: 'Normal' },
                  { color: '#f59e0b', label: 'Sedang' },
                  { color: '#ef4444', label: 'Tinggi' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {isLoading && (
                <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80">
                  <p className="text-sm text-gray-400">Memuat data peta...</p>
                </div>
              )}
              {/*
                CRITICAL: Do NOT add key prop to MapContainer — causes "Map container is already initialized" error.
                MapContainer stays always mounted; only CircleMarker children re-render when bulan changes.
              */}
              <MapContainer
                center={[-7.7971, 110.3688]}
                zoom={12}
                style={{ height: '340px', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {stuntingData?.map((point) => {
                  if (!point.lat || !point.lng) return null
                  return (
                    <CircleMarker
                      key={point.posyanduId}
                      center={[point.lat, point.lng]}
                      radius={Math.max(8, Math.sqrt(point.total) * 3)}
                      pathOptions={{
                        color: getMarkerColor(point.breakdown),
                        fillColor: getMarkerColor(point.breakdown),
                        fillOpacity: 0.7,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <div className="min-w-[180px]">
                          <p className="font-semibold text-gray-900 mb-1">{point.namaPosyandu}</p>
                          <p className="text-xs text-gray-500 mb-2">{point.kelurahan}</p>
                          <div className="border-t pt-2 space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total balita:</span>
                              <span className="font-medium">{point.total}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Risiko:</span>
                              <span className="text-red-600 font-medium">
                                {getRisikoCount(point.breakdown)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Normal:</span>
                              <span className="text-emerald-600 font-medium">
                                {point.breakdown.normal ?? 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            </div>
          </div>

          {/* Ranking panel */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-gray-800 text-sm font-bold">Peringkat Risiko</p>
            </div>
            {ranked.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                Tidak ada data untuk bulan ini
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {ranked.map((p, i) => {
                  const risiko = getRisikoCount(p.breakdown)
                  const badge = getLevelBadge(p.breakdown)
                  return (
                    <div key={p.posyanduId} className="px-4 py-3 flex items-center gap-3">
                      <span className="text-gray-400 text-sm font-bold w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 text-sm font-semibold truncate">
                          {p.namaPosyandu}
                        </p>
                        <p className="text-gray-400 text-xs truncate">{p.kelurahan}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-gray-800 text-sm font-bold">
                          {p.total > 0
                            ? ((risiko / p.total) * 100).toFixed(0)
                            : '0'}
                          %
                        </p>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── BarChart comparison ──────────────────────────────────────────── */}
        {barData.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-gray-800 font-bold mb-4">
              Perbandingan Risiko Stunting Antar Posyandu
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val, name) => [
                    val,
                    name === 'risiko' ? 'Kasus Risiko' : 'Total Balita',
                  ]}
                />
                <Bar dataKey="total" fill="#bfdbfe" name="total" radius={[4, 4, 0, 0]} />
                <Bar dataKey="risiko" fill="#ef4444" name="risiko" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!isLoading && (!stuntingData || stuntingData.length === 0) && (
          <div className="py-8 bg-white rounded-2xl border border-gray-100 text-center">
            <p className="text-sm text-gray-400">
              Tidak ada data posyandu dengan koordinat untuk bulan{' '}
              <span className="font-medium text-gray-600">{formatBulanLabel(bulan)}</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
