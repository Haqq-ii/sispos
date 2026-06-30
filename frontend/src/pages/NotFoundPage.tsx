import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-gray-300 mb-2">404</h1>
      <p className="text-gray-500 mb-4">Halaman tidak ditemukan</p>
      <Link to="/" className="text-green-600 hover:underline text-sm">
        Kembali ke Beranda
      </Link>
    </div>
  )
}
