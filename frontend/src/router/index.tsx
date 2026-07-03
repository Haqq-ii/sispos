import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '@/stores/useAuthStore'
import PuskesmasLayout from '@/layouts/PuskesmasLayout'
import CitizenLayout from '@/layouts/CitizenLayout'
import KaderLayout from '@/layouts/KaderLayout'

// ── Auth pages ────────────────────────────────────────────────────────────────

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const VerifikasiOtpPage = lazy(() => import('@/pages/auth/VerifikasiOtpPage'))
const OnboardingLokasiPage = lazy(() => import('@/pages/auth/OnboardingLokasiPage'))
const LokasiSelesaiPage = lazy(() => import('@/pages/auth/LokasiSelesaiPage'))

// ── Citizen pages ─────────────────────────────────────────────────────────────

const CitizenDashboardPage = lazy(() => import('@/pages/citizen/CitizenDashboardPage'))
const ChatGiziPage = lazy(() => import('@/pages/citizen/ChatGiziPage'))
const ChatPendaftaranPage = lazy(() => import('@/pages/citizen/ChatPendaftaranPage'))

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
  () => import('@/pages/puskesmas/PuskesmasDashboardPage')
)
const PetaStuntingPage = lazy(
  () => import('@/pages/puskesmas/PetaStuntingPage')
)
const ManajemenJadwalPage = lazy(
  () => import('@/pages/puskesmas/jadwal/ManajemenJadwalPage')
)
const ManajemenPenggunaPage = lazy(
  () => import('@/pages/puskesmas/ManajemenPenggunaPage')
)
const AuditLogPage = lazy(
  () => import('@/pages/puskesmas/AuditLogPage')
)

// Placeholder untuk halaman yang belum dibuat
const HalamanDevelopment = () => (
  <div className="p-6 text-gray-500">Halaman sedang dikembangkan.</div>
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

        {/* ── Citizen protected routes — nested under CitizenLayout ──────── */}

        <Route
          path="/citizen"
          element={
            <ProtectedRoute allowedRoles={['citizen']}>
              <CitizenLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<CitizenDashboardPage />} />
          {/* Antrian redirect: /citizen/antrian → pilih-tanggal */}
          <Route path="antrian" element={<Navigate to="pilih-tanggal" replace />} />
          <Route path="antrian/pilih-tanggal" element={<PilihTanggalPage />} />
          <Route path="antrian/pilih-sesi" element={<PilihSesiPage />} />
          <Route path="antrian/konfirmasi" element={<KonfirmasiAntrianPage />} />
          <Route path="antrian/tiket/:antrianId" element={<TiketAntrianPage />} />
          <Route path="chat-gizi" element={<ChatGiziPage />} />
          <Route path="chat-pendaftaran" element={<ChatPendaftaranPage />} />
        </Route>

        {/* ── Kader protected routes — split between KaderLayout and standalone ── */}

        {/* Main kader pages with sidebar/bottom-nav layout */}
        <Route
          path="/kader"
          element={
            <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
              <KaderLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<KaderDashboardPage />} />
          <Route path="pelayanan" element={<PelayananHariHPage />} />
          <Route path="rekap" element={<RekapHarianPage />} />
        </Route>

        {/* Kader operational pages — standalone (no layout wrapper) */}
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

        {/* ── Puskesmas protected routes — nested under PuskesmasLayout ── */}

        <Route
          path="/puskesmas"
          element={
            <ProtectedRoute allowedRoles={['puskesmas']}>
              <PuskesmasLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<PuskesmasDashboardPage />} />
          <Route path="peta" element={<PetaStuntingPage />} />
          <Route path="jadwal" element={<ManajemenJadwalPage />} />
          <Route path="pengguna" element={<ManajemenPenggunaPage />} />
          <Route path="laporan" element={<HalamanDevelopment />} />
          <Route path="audit-log" element={<AuditLogPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
