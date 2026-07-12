import 'leaflet/dist/leaflet.css'
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import apiClient from '@/lib/axios'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'

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
  return (breakdown.sangat_pendek ?? 0) + (breakdown.pendek ?? 0)
}

function getRisikoLevel(breakdown: Record<string, number>, total: number): 'rendah' | 'sedang' | 'tinggi' {
  if (total === 0) return 'rendah'
  const pct = getRisikoCount(breakdown) / total
  if (pct > 0.25) return 'tinggi'
  if (pct > 0.15) return 'sedang'
  return 'rendah'
}

function getMarkerColor(breakdown: Record<string, number>, total: number): string {
  const level = getRisikoLevel(breakdown, total)
  if (level === 'tinggi') return '#ef4444'
  if (level === 'sedang') return '#f59e0b'
  return '#22c55e'
}

function getLevelBadge(breakdown: Record<string, number>, total: number): { label: string; cls: string } {
  const level = getRisikoLevel(breakdown, total)
  if (level === 'tinggi') return { label: 'Tinggi', cls: 'bg-red-100 text-red-700' }
  if (level === 'sedang') return { label: 'Sedang', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Rendah', cls: 'bg-green-100 text-green-700' }
}

// ── FitBoundsOnLoad ───────────────────────────────────────────────────────────

function FitBoundsOnLoad({ points }: { points: StuntingMapPoint[] }) {
  const map = useMap()
  const validPoints = points.filter((p) => p.lat && p.lng)
  // Run whenever the point list changes (bulan switch or initial load)
  const key = validPoints.map((p) => p.posyanduId).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (validPoints.length === 0) return
    map.fitBounds(
      validPoints.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [48, 48], maxZoom: 15, animate: true },
    )
  }, [key]) // key changes whenever point set changes
  return null
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
    () => (stuntingData ?? []).filter((p) => getRisikoLevel(p.breakdown, p.total) === 'tinggi').length,
    [stuntingData],
  )

  const ranked = useMemo(
    () =>
      [...(stuntingData ?? [])].sort(
        (a, b) => getRisikoCount(b.breakdown) - getRisikoCount(a.breakdown),
      ),
    [stuntingData],
  )


  return (
    <div className="min-h-full bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-800 font-bold text-lg">Peta Sebaran Stunting</h1>
            <p className="text-gray-400 text-xs">
              Visualisasi stunting TB/U tingkat posyandu
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Bulan:</label>
            <MonthYearPicker value={bulan} onChange={setBulan} />
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5 pb-8">
        {/* ── KPI row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-gray-800 leading-none">{totalBalita}</p>
            <p className="text-gray-500 text-sm mt-1">Total Balita Terukur</p>
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
                  { color: '#22c55e', label: 'Rendah (<15%)' },
                  { color: '#f59e0b', label: 'Sedang (15–25%)' },
                  { color: '#ef4444', label: 'Tinggi (>25%)' },
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
                center={[-7.8071, 110.3688]}
                zoom={13}
                style={{ height: '340px', width: '100%' }}
              >
                {stuntingData && stuntingData.length > 0 && (
                  <FitBoundsOnLoad points={stuntingData} />
                )}
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {stuntingData?.map((point) => {
                  if (!point.lat || !point.lng) return null
                  const risiko = getRisikoCount(point.breakdown)
                  const level = getRisikoLevel(point.breakdown, point.total)
                  const color = getMarkerColor(point.breakdown, point.total)
                  const badge = getLevelBadge(point.breakdown, point.total)
                  const size = Math.max(44, Math.min(72, Math.sqrt(point.total) * 5.5))
                  const shortName = point.namaPosyandu.replace('Posyandu ', '').slice(0, 8)
                  const pct = point.total > 0 ? ((risiko / point.total) * 100).toFixed(1) : '0'
                  const icon = L.divIcon({
                    className: '',
                    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column;color:white;font-family:system-ui,sans-serif;font-weight:700;text-align:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer"><span style="font-size:${Math.max(9, Math.floor(size * 0.2))}px;line-height:1.2;padding:0 4px">${shortName}</span><span style="font-size:${Math.max(8, Math.floor(size * 0.17))}px;opacity:0.9;font-weight:500">${risiko} risiko</span></div>`,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2],
                    popupAnchor: [0, -size / 2 - 4],
                  })
                  const headerBg = level === 'tinggi' ? '#ef4444' : level === 'sedang' ? '#f59e0b' : '#22c55e'
                  return (
                    <Marker key={point.posyanduId} position={[point.lat, point.lng]} icon={icon}>
                      <Popup maxWidth={220}>
                        <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 190 }}>
                          <div style={{ background: headerBg, margin: '-8px -12px 10px', padding: '10px 14px', borderRadius: '4px 4px 0 0' }}>
                            <p style={{ color: 'white', fontWeight: 700, fontSize: 13, margin: 0 }}>{point.namaPosyandu}</p>
                            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, margin: '2px 0 0' }}>{point.kelurahan}</p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {([
                              { label: 'Total Balita', val: String(point.total), c: '#111827' },
                              { label: 'Kasus Stunting', val: String(risiko), c: '#dc2626' },
                              { label: 'Tingkat Risiko', val: `${pct}%`, c: '#111827' },
                            ] as const).map(({ label, val, c }) => (
                              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ color: '#6b7280' }}>{label}</span>
                                <span style={{ fontWeight: 600, color: c }}>{val}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: level === 'tinggi' ? '#fee2e2' : level === 'sedang' ? '#fef3c7' : '#dcfce7', color: level === 'tinggi' ? '#b91c1c' : level === 'sedang' ? '#b45309' : '#15803d' }}>{badge.label}</span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
          </div>

          {/* Ranking panel */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col max-h-[390px]">
            <div className="px-4 py-3 border-b border-gray-50 flex-shrink-0">
              <p className="text-gray-800 text-sm font-bold">Peringkat Stunting</p>
            </div>
            {ranked.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm flex-1">
                Tidak ada data untuk bulan ini
              </div>
            ) : (
              <div className="divide-y divide-gray-50 overflow-y-auto flex-1 min-h-0">
                {ranked.map((p, i) => {
                  const risiko = getRisikoCount(p.breakdown)
                  const badge = getLevelBadge(p.breakdown, p.total)
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

        {/* Empty state ────────────────────────────────────────────────── */}
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
