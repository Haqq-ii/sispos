import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/axios'

/**
 * Hook untuk Puskesmas ManajemenJadwalPage.
 * Mengambil semua jadwal yang dimiliki puskesmas (pagination dari backend).
 */
export function useJadwalList() {
  return useQuery({
    queryKey: ['jadwal', 'list'],
    queryFn: () =>
      apiClient
        .get('/jadwal')
        .then((r) => r.data.data as JadwalListItem[]),
    staleTime: 30_000,
  })
}

/**
 * Hook untuk Citizen PilihTanggalPage.
 * Mengambil jadwal tersedia di bulan tertentu untuk posyandu utama citizen.
 * Hanya aktif (enabled) ketika bulan dipilih.
 *
 * @param bulan - Format 'YYYY-MM', atau null jika belum dipilih
 */
export function useJadwalTersedia(bulan: string | null) {
  return useQuery({
    queryKey: ['jadwal', 'tersedia', bulan],
    queryFn: () =>
      apiClient
        .get('/jadwal/tersedia', { params: { bulan } })
        .then((r) => r.data.data as JadwalTersediaItem[]),
    enabled: !!bulan,
    staleTime: 60_000,
  })
}

// ── Type definitions ──────────────────────────────────────────────────────────

export interface JadwalListItem {
  id: string
  posyanduId: string
  tanggalPelaksanaan: string
  estimasiDurasiMenit: number
  statusJadwal: string
  posyandu: {
    namaPosyandu: string
  }
  slotSesi?: Array<{
    id: string
    nomorSesi?: number
    labelSesi?: string
    kuota: number
    terisi: number
  }>
  _count?: {
    slotSesi: number
  }
}

export interface JadwalTersediaItem {
  id: string
  tanggalPelaksanaan: string
  estimasiDurasiMenit: number
  statusJadwal: string
  slotSesi: SlotSesiItem[]
}

export interface SlotSesiItem {
  id: string
  labelSesi: string
  jamMulai: string
  jamSelesai: string
  kuota: number
  terisi: number
}
