import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

// Auth pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))

// Lazy-load placeholder dashboard pages
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
        {/* Root redirects to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected dashboard routes */}
        <Route
          path="/citizen/dashboard"
          element={
            <ProtectedRoute>
              <CitizenDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/dashboard"
          element={
            <ProtectedRoute>
              <KaderDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/puskesmas/dashboard"
          element={
            <ProtectedRoute>
              <PuskesmasDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
