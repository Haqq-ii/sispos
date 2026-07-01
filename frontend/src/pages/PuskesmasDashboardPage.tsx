import { Link } from 'react-router-dom'

export default function PuskesmasDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-lg shadow p-6 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">&#128202;</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Dashboard Puskesmas</h1>
        <p className="text-gray-500 text-sm">Monitoring dan manajemen Posyandu.</p>
        <p className="text-gray-400 text-xs mt-2">Halaman ini akan diisi pada Phase 4</p>
        <div className="mt-4 px-3 py-1 bg-green-50 text-green-700 rounded text-xs inline-block">
          puskesmas
        </div>
        {/* Temporary navigation link — akan diganti sidebar Phase 4 (D-07) */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <Link
            to="/puskesmas/jadwal"
            className="inline-flex items-center justify-center w-full min-h-[44px] px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-green-50 transition-colors"
          >
            Manajemen Jadwal
          </Link>
        </div>
      </div>
    </div>
  )
}
