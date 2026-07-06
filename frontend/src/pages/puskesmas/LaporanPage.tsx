import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileSpreadsheet, FileText, Download, AlertCircle,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react'
import apiClient from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PreviewRow {
  namaBalita: string
  nikBalita: string | null
  namaOrangTua: string
  tanggalLahir: string
  jenisKelamin: string
  usiaBulan: number
  beratBadan: number | null
  tinggiBadan: number | null
  zScoreBbU: number | null
  zScoreTbU: number | null
  zScoreBbTb: number | null
  statusGizi: string
  namaPosyandu: string
  tanggalPemeriksaan: string
}

interface PreviewStats {
  totalPemeriksaan: number
  buruk: number; kurang: number; normal: number
  lebih: number; obesitas: number
  pendek: number; sangatPendek: number
  posyanduList: { id: string; nama: string }[]
}

interface PreviewResponse {
  success: boolean
  data: PreviewRow[]
  stats: PreviewStats
  meta: { total: number; page: number; limit: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBulanDefault(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

function formatBulanLabel(bulan: string): string {
  const [year, month] = bulan.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  normal:       { label: 'Normal',        cls: 'bg-[#dcfce7] text-[#166534]' },
  kurang:       { label: 'Kurang',        cls: 'bg-[#fef9c3] text-[#854d0e]' },
  buruk:        { label: 'Buruk',         cls: 'bg-[#fee2e2] text-[#991b1b]' },
  pendek:       { label: 'Pendek',        cls: 'bg-[#ffedd5] text-[#7c2d12]' },
  sangat_pendek:{ label: 'Sgt Pendek',   cls: 'bg-[#fee2e2] text-[#991b1b]' },
  lebih:        { label: 'Lebih',         cls: 'bg-[#f3e8ff] text-[#6b21a8]' },
  obesitas:     { label: 'Obesitas',      cls: 'bg-[#f3e8ff] text-[#6b21a8]' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status || '—', cls: 'bg-[#f3f4f6] text-[#6a7282]' }
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  )
}

const LIMIT = 20

// ── LaporanPage ───────────────────────────────────────────────────────────────

export default function LaporanPage() {
  const [bulan, setBulan] = useState<string>(getBulanDefault)
  const [posyanduId, setPosyanduId] = useState<string>('')
  const [page, setPage] = useState(1)

  const { data: preview, isLoading, isError } = useQuery<PreviewResponse>({
    queryKey: ['preview-bulanan', bulan, posyanduId, page],
    queryFn: () =>
      apiClient
        .get('/reports/preview-bulanan', {
          params: { bulan, ...(posyanduId ? { posyanduId } : {}), page, limit: LIMIT },
        })
        .then((r) => r.data as PreviewResponse),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

  const stats = preview?.stats
  const rows = preview?.data ?? []
  const meta = preview?.meta
  const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1
  const bermasalah = (stats?.buruk ?? 0) + (stats?.kurang ?? 0)

  const handleBulanChange = (val: string) => { setBulan(val); setPage(1) }
  const handlePosyanduChange = (val: string) => { setPosyanduId(val); setPage(1) }

  const handleDownload = (format: 'xlsx' | 'pdf') => {
    const params = new URLSearchParams({ bulan, format })
    if (posyanduId) params.set('posyanduId', posyanduId)
    window.open('/api/reports/laporan-bulanan?' + params.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-full bg-[#f9fafb] pb-8">
      {/* ── Green Header ──────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-5 py-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Puskesmas</p>
            <h1 className="text-white font-bold text-xl leading-tight">Laporan e-PPGBM</h1>
            <p className="text-[#b9f8cf] text-xs mt-1">{formatBulanLabel(bulan)}</p>
          </div>
          <input
            type="month"
            value={bulan}
            onChange={(e) => handleBulanChange(e.target.value)}
            aria-label="Pilih bulan laporan"
            className="px-3 py-2 text-xs border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.15)] text-white rounded-[14px] focus:outline-none focus:bg-[rgba(255,255,255,0.25)]"
          />
        </div>

        {/* Posyandu filter */}
        {(stats?.posyanduList?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <Filter size={12} className="text-[#7bf1a8] shrink-0" />
            <select
              value={posyanduId}
              onChange={(e) => handlePosyanduChange(e.target.value)}
              aria-label="Filter posyandu"
              className="flex-1 px-2.5 py-1.5 text-xs bg-[rgba(255,255,255,0.15)] border border-[rgba(255,255,255,0.3)] text-white rounded-[10px] focus:outline-none focus:bg-[rgba(255,255,255,0.25)]"
            >
              <option value="" className="text-[#364153]">Semua Posyandu</option>
              {stats!.posyanduList.map((p) => (
                <option key={p.id} value={p.id} className="text-[#364153]">{p.nama}</option>
              ))}
            </select>
          </div>
        )}

        {/* 4-stat grid */}
        {isLoading && !preview ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3 h-16 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-white font-bold text-xl leading-none">
                {(stats?.totalPemeriksaan ?? 0).toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Pemeriksaan</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-white font-bold text-xl leading-none">
                {(stats?.normal ?? 0).toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Anak Sehat</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-[#fb2c36] font-bold text-xl leading-none">
                {bermasalah.toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Perlu Perhatian</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-[#fbbf24] font-bold text-xl leading-none">
                {((stats?.pendek ?? 0) + (stats?.sangatPendek ?? 0)).toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Stunting</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="px-4 mt-4 space-y-3">
        {/* Download Card */}
        <div className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm p-5">
          <p className="text-[#6a7282] text-xs font-bold tracking-wider mb-3">FORMAT EKSPOR</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border border-[#f3f4f6] rounded-[14px]">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={16} className="text-[#008236]" />
                <div>
                  <p className="text-[#364153] text-sm font-medium">Laporan e-PPGBM (.xlsx)</p>
                  <p className="text-[#99a1af] text-xs">Data individual balita + rekap status gizi</p>
                </div>
              </div>
              <button
                onClick={() => handleDownload('xlsx')}
                className="flex items-center gap-1.5 text-[#008236] text-xs font-medium hover:text-[#00a63e]"
              >
                <Download size={14} />
                Unduh
              </button>
            </div>
            <div className="flex items-center justify-between p-3 border border-[#f3f4f6] rounded-[14px]">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-[#008236]" />
                <div>
                  <p className="text-[#364153] text-sm font-medium">Laporan Ringkas (.pdf)</p>
                  <p className="text-[#99a1af] text-xs">Ringkasan per posyandu</p>
                </div>
              </div>
              <button
                onClick={() => handleDownload('pdf')}
                className="flex items-center gap-1.5 text-[#008236] text-xs font-medium hover:text-[#00a63e]"
              >
                <Download size={14} />
                Unduh
              </button>
            </div>
          </div>
        </div>

        {/* Preview Table Card */}
        <div className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f3f4f6] flex items-center justify-between">
            <p className="text-[#364153] text-sm font-semibold">
              Preview Data e-PPGBM
            </p>
            {meta && meta.total > 0 && (
              <span className="text-[#99a1af] text-xs">
                {meta.total.toLocaleString('id-ID')} data
              </span>
            )}
          </div>

          {isError ? (
            <div className="px-4 py-8 text-center">
              <AlertCircle size={20} className="text-[#f87171] mx-auto mb-2" />
              <p className="text-[#6a7282] text-sm">Gagal memuat data. Coba lagi.</p>
            </div>
          ) : isLoading && !preview ? (
            <div className="px-4 py-8 text-center">
              <div className="w-6 h-6 border-2 border-[#008236] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[#99a1af] text-xs mt-2">Memuat data...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[#364153] text-sm font-medium">Tidak ada data</p>
              <p className="text-[#99a1af] text-xs mt-1">
                Belum ada pemeriksaan tercatat untuk {formatBulanLabel(bulan)}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                      <th className="px-3 py-2 text-left text-[#6a7282] font-semibold whitespace-nowrap">Nama Anak</th>
                      <th className="px-2 py-2 text-center text-[#6a7282] font-semibold whitespace-nowrap">JK</th>
                      <th className="px-2 py-2 text-center text-[#6a7282] font-semibold whitespace-nowrap">Umur</th>
                      <th className="px-2 py-2 text-center text-[#6a7282] font-semibold whitespace-nowrap">BB (kg)</th>
                      <th className="px-2 py-2 text-center text-[#6a7282] font-semibold whitespace-nowrap">TB (cm)</th>
                      <th className="px-2 py-2 text-center text-[#6a7282] font-semibold whitespace-nowrap">Status Gizi</th>
                      <th className="px-3 py-2 text-left text-[#6a7282] font-semibold whitespace-nowrap">Posyandu</th>
                      <th className="px-3 py-2 text-center text-[#6a7282] font-semibold whitespace-nowrap">Tgl Periksa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {rows.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
                        <td className="px-3 py-2">
                          <p className="text-[#364153] font-medium leading-tight">{row.namaBalita}</p>
                          <p className="text-[#99a1af] text-[10px] leading-tight">{row.namaOrangTua}</p>
                        </td>
                        <td className="px-2 py-2 text-center text-[#6a7282]">{row.jenisKelamin}</td>
                        <td className="px-2 py-2 text-center text-[#6a7282] whitespace-nowrap">{row.usiaBulan} bln</td>
                        <td className="px-2 py-2 text-center text-[#364153]">
                          {row.beratBadan !== null ? row.beratBadan : '—'}
                        </td>
                        <td className="px-2 py-2 text-center text-[#364153]">
                          {row.tinggiBadan !== null ? row.tinggiBadan : '—'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusBadge status={row.statusGizi} />
                        </td>
                        <td className="px-3 py-2 text-[#6a7282] whitespace-nowrap">
                          {row.namaPosyandu.replace('Posyandu ', '')}
                        </td>
                        <td className="px-3 py-2 text-center text-[#99a1af] whitespace-nowrap">
                          {row.tanggalPemeriksaan}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-[#f3f4f6] flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1 text-xs text-[#6a7282] disabled:opacity-40 hover:text-[#008236]"
                  >
                    <ChevronLeft size={14} /> Sebelumnya
                  </button>
                  <span className="text-xs text-[#6a7282]">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1 text-xs text-[#6a7282] disabled:opacity-40 hover:text-[#008236]"
                  >
                    Selanjutnya <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* e-PPGBM Notice */}
        <div className="bg-[#fffbeb] border border-[#fef3c6] rounded-2xl p-4" role="note">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} className="text-[#973c00]" />
            <p className="text-[#973c00] text-xs font-semibold">Catatan Format e-PPGBM</p>
          </div>
          <p className="text-[#bb4d00] text-xs mt-1">
            Format kolom e-PPGBM mengacu pada standar Kemenkes (akademik)
          </p>
        </div>
      </div>
    </div>
  )
}
