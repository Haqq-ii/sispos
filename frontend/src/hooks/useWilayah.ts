import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/axios'

interface WilayahResponse {
  success: boolean
  data: string[]
}

/**
 * Hook untuk mengambil daftar provinsi dari /api/wilayah/provinsi.
 * Cache staleTime 1 jam — data wilayah jarang berubah.
 */
export function useProvinsi() {
  return useQuery({
    queryKey: ['wilayah', 'provinsi'],
    queryFn: () =>
      apiClient
        .get<WilayahResponse>('/wilayah/provinsi')
        .then((r) => r.data.data),
    staleTime: 60 * 60 * 1000,
  })
}

/**
 * Hook untuk mengambil daftar kabupaten berdasarkan provinsi.
 * Hanya aktif (enabled) ketika provinsi dipilih.
 */
export function useKabupaten(provinsi: string | null) {
  return useQuery({
    queryKey: ['wilayah', 'kabupaten', provinsi],
    queryFn: () =>
      apiClient
        .get<WilayahResponse>('/wilayah/kabupaten', { params: { provinsi } })
        .then((r) => r.data.data),
    enabled: !!provinsi,
    staleTime: 60 * 60 * 1000,
  })
}

/**
 * Hook untuk mengambil daftar kecamatan berdasarkan kabupaten dan provinsi.
 * Hanya aktif (enabled) ketika kabupaten dipilih.
 */
export function useKecamatan(kabupaten: string | null, provinsi: string | null) {
  return useQuery({
    queryKey: ['wilayah', 'kecamatan', kabupaten],
    queryFn: () =>
      apiClient
        .get<WilayahResponse>('/wilayah/kecamatan', {
          params: { kabupaten, provinsi },
        })
        .then((r) => r.data.data),
    enabled: !!kabupaten,
    staleTime: 60 * 60 * 1000,
  })
}

/**
 * Hook untuk mengambil daftar kelurahan berdasarkan kecamatan, kabupaten, dan provinsi.
 * Hanya aktif (enabled) ketika kecamatan dipilih.
 */
export function useKelurahan(
  kecamatan: string | null,
  kabupaten: string | null,
  provinsi: string | null
) {
  return useQuery({
    queryKey: ['wilayah', 'kelurahan', kecamatan],
    queryFn: () =>
      apiClient
        .get<WilayahResponse>('/wilayah/kelurahan', {
          params: { kecamatan, kabupaten, provinsi },
        })
        .then((r) => r.data.data),
    enabled: !!kecamatan,
    staleTime: 60 * 60 * 1000,
  })
}
