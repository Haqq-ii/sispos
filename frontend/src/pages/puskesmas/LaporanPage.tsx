import { FileText, Download } from 'lucide-react'

export default function LaporanPage() {
  return (
    <div className="min-h-full bg-[#f9fafb] pb-8">
      <div className="bg-[#008236] px-5 py-6">
        <p className="text-[#7bf1a8] text-xs">Puskesmas</p>
        <h1 className="text-white font-bold text-xl mt-1">Laporan e-PPGBM</h1>
        <p className="text-[#b9f8cf] text-xs mt-1">Ekspor laporan bulanan Kemenkes</p>
      </div>
      <div className="px-4 mt-4 space-y-3">
        <div className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm p-5">
          <p className="text-[#6a7282] text-xs font-semibold tracking-wider mb-3">FORMAT LAPORAN</p>
          <div className="space-y-2">
            {['Rekap Bulanan (Excel)', 'Laporan Gizi Balita (PDF)', 'Data Imunisasi (Excel)'].map((item) => (
              <div key={item} className="flex items-center justify-between p-3 border border-[#f3f4f6] rounded-[14px]">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-[#008236]" />
                  <span className="text-[#364153] text-sm">{item}</span>
                </div>
                <button className="flex items-center gap-1.5 text-[#008236] text-xs font-medium hover:text-[#00a63e]">
                  <Download size={14} />
                  Unduh
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#fffbeb] border border-[#fef3c6] rounded-2xl p-4">
          <p className="text-[#973c00] text-xs font-semibold">⚠ Fitur ekspor akan tersedia setelah konfigurasi selesai</p>
          <p className="text-[#bb4d00] text-xs mt-1">Hubungi administrator untuk mengaktifkan ekspor e-PPGBM.</p>
        </div>
      </div>
    </div>
  )
}
