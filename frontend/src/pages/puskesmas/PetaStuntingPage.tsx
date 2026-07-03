import 'leaflet/dist/leaflet.css'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
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
    staleTime: 5 * 60 * 1000, // 5 menit
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBulanDefault(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

function formatBulanLabel(bulan: string): string {
  const [year, month] = bulan.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

function getMarkerColor(breakdown: Record<string, number>): string {
  if ((breakdown.buruk ?? 0) + (breakdown.sangat_pendek ?? 0) > 0) return '#ef4444' // merah
  if ((breakdown.kurang ?? 0) + (breakdown.pendek ?? 0) > 0) return '#f59e0b' // kuning
  return '#22c55e' // hijau
}

// ── PetaStuntingPage ──────────────────────────────────────────────────────────

export default function PetaStuntingPage() {
  const [bulan, setBulan] = useState<string>(getBulanDefault)
  const { data: stuntingData, isLoading } = usePuskesmasStunting(bulan)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Peta Sebaran Stunting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Data bulan {formatBulanLabel(bulan)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="bulan-filter" className="text-sm text-gray-600 font-medium whitespace-nowrap">
            Filter bulan:
          </label>
          <input
            id="bulan-filter"
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008236] focus:border-transparent"
          />
        </div>
      </div>

      {/* ── Legenda ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block" />
          Normal
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block" />
          Kurang / Pendek
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" />
          Buruk / Sangat Pendek
        </div>
      </div>

      {/* ── Map container ────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 rounded-xl">
            <p className="text-sm text-gray-500 font-medium">Memuat data peta...</p>
          </div>
        )}

        {/*
          CRITICAL: Do NOT add key prop to MapContainer — causes "Map container is already initialized" error.
          MapContainer stays always mounted; only CircleMarker children re-render when bulan changes.
        */}
        <MapContainer
          center={[-7.7971, 110.3688]}
          zoom={12}
          style={{ height: '450px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {stuntingData?.map((point) => {
            // Skip items dengan koordinat 0 atau null (belum diisi)
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
                        <span className="text-gray-600">Normal:</span>
                        <span className="text-emerald-600 font-medium">{point.breakdown.normal ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Kurang / Pendek:</span>
                        <span className="text-amber-600 font-medium">
                          {(point.breakdown.kurang ?? 0) + (point.breakdown.pendek ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Buruk / Sangat Pendek:</span>
                        <span className="text-red-600 font-medium">
                          {(point.breakdown.buruk ?? 0) + (point.breakdown.sangat_pendek ?? 0)}
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

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!isLoading && (!stuntingData || stuntingData.length === 0) && (
        <div className="mt-4 text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">
            Tidak ada data posyandu dengan koordinat untuk bulan{' '}
            <span className="font-medium">{formatBulanLabel(bulan)}</span>.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Tambahkan koordinat posyandu melalui pengaturan untuk menampilkan marker di peta.
          </p>
        </div>
      )}
    </div>
  )
}
