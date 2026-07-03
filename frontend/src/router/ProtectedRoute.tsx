import { Navigate } from 'react-router-dom'
import { useAuthStore, type RolePengguna } from '@/stores/useAuthStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: RolePengguna[]
}

function dashboardByRole(role: RolePengguna): string {
  switch (role) {
    case 'citizen': return '/citizen/dashboard'
    case 'kader':
    case 'ketua_kader': return '/kader/dashboard'
    case 'puskesmas': return '/puskesmas/dashboard'
  }
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Defense-in-depth role check — server enforces roles authoritatively via requireRole()
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={dashboardByRole(user.role)} replace />
  }

  return children as JSX.Element
}
