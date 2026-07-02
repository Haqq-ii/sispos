/**
 * RekapHarianPage — Rekap Harian: Download rekap .xlsx dan .pdf
 *
 * Features:
 *   1. Ambil slotId dari router state (dikirim oleh Meja5Page) atau dari store
 *   2. Download Excel: window.open('/api/reports/rekap-harian?slotId=...&format=xlsx')
 *   3. Download PDF:   window.open('/api/reports/rekap-harian?slotId=...&format=pdf')
 *   4. Tombol "Kembali ke Dashboard" → navigate('/kader/dashboard') + setLocked(false)
 *
 * Note: window.open untuk download karena JWT ada di httpOnly cookie
 *       (dikirim otomatis untuk same-origin requests oleh browser).
 *
 * State source: router state dari Meja5Page { slotId }
 * Fallback: useKaderMejaStore.activeSlotId (jika navigate langsung ke halaman ini)
 */
import { useLocation, useNavigate } from 'react-router-dom'
import { FileSpreadsheet, FileText, Home, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useKaderMejaStore } from '@/stores/useKaderMejaStore'

// ── Main Component ─────────────────────────────────────────────────────────

export default function RekapHarianPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activeSlotId, setLocked } = useKaderMejaStore()

  // slotId dari router state (Meja5Page) atau dari Zustand store (fallback)
  const state = location.state as { slotId?: string } | null
  const slotId = state?.slotId ?? activeSlotId

  // Build download URL (relative — same-origin, cookie sent automatically)
  function buildUrl(format: 'xlsx' | 'pdf'): string {
    return `/api/reports/rekap-harian?slotId=${encodeURIComponent(slotId ?? '')}&format=${format}`
  }

  function handleDownloadXlsx() {
    if (!slotId) return
    window.open(buildUrl('xlsx'), '_blank', 'noopener,noreferrer')
  }

  function handleDownloadPdf() {
    if (!slotId) return
    window.open(buildUrl('pdf'), '_blank', 'noopener,noreferrer')
  }

  function handleBackToDashboard() {
    setLocked(false)
    navigate('/kader/dashboard', { replace: true })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">

        {/* Title */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Rekap Harian</h1>
          <p className="text-sm text-gray-500 mt-1">
            Unduh rekap pelayanan posyandu hari ini
          </p>
        </div>

        {/* No slotId warning */}
        {!slotId && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  Pilih sesi aktif di dashboard untuk mengunduh rekap. Tidak ada sesi aktif yang terdeteksi.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Download card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Unduh Rekap Harian
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* Excel download */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 justify-start gap-3"
              onClick={handleDownloadXlsx}
              disabled={!slotId}
            >
              <FileSpreadsheet className="h-5 w-5 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Download Excel (.xlsx)</p>
                <p className="text-xs text-gray-400">
                  Tabel dengan Z-Score dan status gizi seluruh balita
                </p>
              </div>
            </Button>

            {/* PDF download */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-red-300 text-red-700 hover:bg-red-50 justify-start gap-3"
              onClick={handleDownloadPdf}
              disabled={!slotId}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-sm">Download PDF (.pdf)</p>
                <p className="text-xs text-gray-400">
                  Laporan cetak dengan header dan tabel data
                </p>
              </div>
            </Button>

            {slotId && (
              <p className="text-xs text-gray-400 text-center">
                File akan dibuka di tab baru. Login otomatis via cookie sesi.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Back to Dashboard */}
        <Button
          type="button"
          className="w-full bg-gray-800 hover:bg-gray-900 text-white"
          onClick={handleBackToDashboard}
        >
          <Home className="h-4 w-4 mr-2" />
          Kembali ke Dashboard
        </Button>

      </div>
    </div>
  )
}
