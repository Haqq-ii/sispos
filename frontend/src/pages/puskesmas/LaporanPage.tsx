import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, Download, AlertCircle } from 'lucide-react'
import apiClient from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalPemeriksaan: number
  totalBalita: number
  breakdown: Record<string, number>
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

// ── LaporanPage ───────────────────────────────────────────────────────────────

export default function LaporanPage() {
  const [bulan, setBulan] = useState<string>(getBulanDefault)

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats', bulan],
    queryFn: () =>
      apiClient
        .get('/dashboard/stats', { params: { bulan } })
        .then((r) => r.data.data as DashboardStats),
    staleTime: 5 * 60 * 1000,
  })

  // Synchronous download handler — called directly from onClick (Pitfall 6)
  const handleDownload = (format: 'xlsx' | 'pdf') => {
    window.open(
      '/api/reports/laporan-bulanan?bulan=' + bulan + '&format=' + format,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const bermasalah = (stats?.breakdown?.buruk ?? 0) + (stats?.breakdown?.kurang ?? 0)

  return (
    <div className="min-h-full bg-[#f9fafb] pb-8">
      {/* ── Green Header ──────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-5 py-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Puskesmas</p>
            <h1 className="text-white font-bold text-xl leading-tight">Laporan e-PPGBM</h1>
            <p className="text-[#b9f8cf] text-xs mt-1">
              Ekspor laporan bulanan Kemenkes — {formatBulanLabel(bulan)}
            </p>
          </div>
          <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            aria-label="Pilih bulan laporan"
            className="px-3 py-2 text-xs border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.15)] text-white rounded-[14px] focus:outline-none focus:bg-[rgba(255,255,255,0.25)]"
          />
        </div>

        {/* 2×2 Stat Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3 h-16 animate-pulse"
              />
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
                {(stats?.totalBalita ?? 0).toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Terdaftar</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-[#7bf1a8] font-bold text-xl leading-none">
                {(stats?.breakdown?.normal ?? 0).toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Anak Sehat</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3">
              <p className="text-[#fb2c36] font-bold text-xl leading-none">
                {bermasalah.toLocaleString('id-ID')}
              </p>
              <p className="text-[#dcfce7] text-[10px] leading-tight mt-1">Perlu Perhatian</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="px-4 mt-4 space-y-3">
        {/* Format Laporan Card */}
        <div className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm p-5">
          <p className="text-[#6a7282] text-xs font-bold tracking-wider mb-3">FORMAT LAPORAN</p>
          <div className="space-y-2">
            {/* Excel Row */}
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
                Unduh Excel
              </button>
            </div>

            {/* PDF Row */}
            <div className="flex items-center justify-between p-3 border border-[#f3f4f6] rounded-[14px]">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-[#008236]" />
                <div>
                  <p className="text-[#364153] text-sm font-medium">Laporan Ringkas (.pdf)</p>
                  <p className="text-[#99a1af] text-xs">
                    Ringkasan per posyandu untuk bulan terpilih
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownload('pdf')}
                className="flex items-center gap-1.5 text-[#008236] text-xs font-medium hover:text-[#00a63e]"
              >
                <Download size={14} />
                Unduh PDF
              </button>
            </div>
          </div>
        </div>

        {/* Amber Warning Card */}
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
