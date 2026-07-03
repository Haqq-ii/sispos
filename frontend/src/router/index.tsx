import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '@/stores/useAuthStore'

// ── Auth pages ────────────────────────────────────────────────────────────────

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const VerifikasiOtpPage = lazy(() => import('@/pages/auth/VerifikasiOtpPage'))
const OnboardingLokasiPage = lazy(() => import('@/pages/auth/OnboardingLokasiPage'))
const LokasiSelesaiPage = lazy(() => import('@/pages/auth/LokasiSelesaiPage'))

// ── Citizen dashboard (path baru — frontend/src/pages/citizen/CitizenDashboardPage.tsx) ──

const CitizenDashboardPage = lazy(() => import('@/pages/citizen/CitizenDashboardPage'))

// ── Citizen antrian flow (Wave 4a + 4b) ──────────────────────────────────────

const PilihTanggalPage = lazy(
  () => import('@/pages/citizen/antrian/PilihTanggalPage')
)
const PilihSesiPage = lazy(
  () => import('@/pages/citizen/antrian/PilihSesiPage')
)
const KonfirmasiAntrianPage = lazy(
  () => import('@/pages/citizen/antrian/KonfirmasiAntrianPage')
)
const TiketAntrianPage = lazy(
  () => import('@/pages/citizen/antrian/TiketAntrianPage')
)

// ── Kader pages ───────────────────────────────────────────────────────────────

const KaderDashboardPage = lazy(() => import('@/pages/kader/KaderDashboardPage'))
const PelayananHariHPage = lazy(() => import('@/pages/kader/PelayananHariHPage'))
const LockScreenPage = lazy(() => import('@/pages/kader/LockScreenPage'))
const Meja1Page = lazy(() => import('@/pages/kader/meja/Meja1Page'))
const Meja2Page = lazy(() => import('@/pages/kader/meja/Meja2Page'))
const Meja3Page = lazy(() => import('@/pages/kader/meja/Meja3Page'))
const Meja4Page = lazy(() => import('@/pages/kader/meja/Meja4Page'))
const Meja5Page = lazy(() => import('@/pages/kader/meja/Meja5Page'))
const RekapHarianPage = lazy(() => import('@/pages/kader/RekapHarianPage'))

// ── Puskesmas pages ───────────────────────────────────────────────────────────

const PuskesmasDashboardPage = lazy(
  () => import('@/pages/PuskesmasDashboardPage')
)
const ManajemenJadwalPage = lazy(
  () => import('@/pages/puskesmas/jadwal/ManajemenJadwalPage')
)

// ── 404 ───────────────────────────────────────────────────────────────────────

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// ── Fallback loading ──────────────────────────────────────────────────────────

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-green-600 text-lg">Memuat...</div>
  </div>
)

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  switch (user.role) {
    case 'citizen': return <Navigate to="/citizen/dashboard" replace />
    case 'kader':
    case 'ketua_kader': return <Navigate to="/kader/dashboard" replace />
    case 'puskesmas': return <Navigate to="/puskesmas/dashboard" replace />
    default: return <Navigate to="/login" replace />
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Root redirects to role-specific dashboard if logged in, else login */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Citizen registration flow — public (no auth required) */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/verifikasi" element={<VerifikasiOtpPage />} />
        <Route path="/register/lokasi" element={<OnboardingLokasiPage />} />
        <Route path="/register/lokasi-selesai" element={<LokasiSelesaiPage />} />

        {/* ── Citizen protected routes ──────────────────────────────── */}

        <Route
          path="/citizen/dashboard"
          element={
            <ProtectedRoute allowedRoles={['citizen']}>
              <CitizenDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Citizen antrian flow — 4 routes (Wave 4a + 4b, Plan 02-05 + 02-07) */}
        <Route
          path="/citizen/antrian/pilih-tanggal"
          element={
            <ProtectedRoute allowedRoles={['citizen']}>
              <PilihTanggalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/antrian/pilih-sesi"
          element={
            <ProtectedRoute allowedRoles={['citizen']}>
              <PilihSesiPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/antrian/konfirmasi"
          element={
            <ProtectedRoute allowedRoles={['citizen']}>
              <KonfirmasiAntrianPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/antrian/tiket/:antrianId"
          element={
            <ProtectedRoute allowedRoles={['citizen']}>
              <TiketAntrianPage />
            </ProtectedRoute>
          }
        />

        {/* ── Kader protected routes ────────────────────────────────── */}

        <Route
          path="/kader/dashboard"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <KaderDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/pelayanan"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <PelayananHariHPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/lock-screen"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <LockScreenPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/meja/1"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <Meja1Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/meja/2"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <Meja2Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/meja/3"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <Meja3Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/meja/4"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <Meja4Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/meja/5"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <Meja5Page />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kader/rekap"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <RekapHarianPage />
            </ProtectedRoute>
          }
        />

        {/* ── Puskesmas protected routes ────────────────────────────── */}

        <Route
          path="/puskesmas/dashboard"
          element={
            <ProtectedRoute allowedRoles={['puskesmas']}>
              <PuskesmasDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/puskesmas/jadwal"
          element={
            <ProtectedRoute allowedRoles={['puskesmas']}>
              <ManajemenJadwalPage />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
