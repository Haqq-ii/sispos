export default function CitizenDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-lg shadow p-6 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">&#128118;</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Dashboard Warga</h1>
        <p className="text-gray-500 text-sm">Selamat datang di SISPOS.</p>
        <p className="text-gray-400 text-xs mt-2">Halaman ini akan diisi pada Phase 2+</p>
        <div className="mt-4 px-3 py-1 bg-green-50 text-green-700 rounded text-xs inline-block">
          citizen
        </div>
      </div>
    </div>
  )
}
