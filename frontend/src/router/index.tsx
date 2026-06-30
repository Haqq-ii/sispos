import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// Lazy-load placeholder pages (akan diganti dengan halaman nyata di Phase 1+)
const CitizenDashboardPage = lazy(() => import('@/pages/CitizenDashboardPage'))
const KaderDashboardPage = lazy(() => import('@/pages/KaderDashboardPage'))
const PuskesmasDashboardPage = lazy(() => import('@/pages/PuskesmasDashboardPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-green-600 text-lg">Memuat...</div>
  </div>
)

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Navigate to="/citizen/dashboard" replace />} />
        <Route path="/citizen/dashboard" element={<CitizenDashboardPage />} />
        <Route path="/kader/dashboard" element={<KaderDashboardPage />} />
        <Route path="/puskesmas/dashboard" element={<PuskesmasDashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
