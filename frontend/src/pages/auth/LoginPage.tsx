import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { LoginForm } from '@/components/auth/LoginForm'
import { KaderLockScreen } from '@/components/auth/KaderLockScreen'
import { detectRole } from '@/components/auth/RoleBadge'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'
import type { LoginFormValues } from '@/lib/validations/login.schema'
import type { AuthUser } from '@/stores/useAuthStore'

interface LoginResponse {
  success: boolean
  data: {
    user: AuthUser
  }
  message: string
}

interface ApiError {
  response?: {
    status: number
    data?: {
      error?: string
      message?: string
      terkunciSampai?: string
      data?: {
        gagalLogin?: number
        terkunciSampai?: string
      }
    }
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [terkunciSampai, setTerkunciSampai] = useState<Date | null>(null)
  const [gagalLogin, setGagalLogin] = useState<number>(0)
  const [identifier, setIdentifier] = useState<string>('')

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) =>
      apiClient.post<LoginResponse>('/auth/login', {
        identifier: values.identifier,
        password: values.password,
      }),
    onSuccess: (response) => {
      const { user } = response.data.data
      setUser(user)
      setErrorMsg(null)

      // Redirect sesuai role
      switch (user.role) {
        case 'citizen':
          navigate('/citizen/dashboard')
          break
        case 'kader':
        case 'ketua_kader':
          navigate('/kader/dashboard')
          break
        case 'puskesmas':
          navigate('/puskesmas/dashboard')
          break
        default:
          navigate('/login')
      }
    },
    onError: (err: ApiError) => {
      const status = err.response?.status
      const errCode = err.response?.data?.error
      const errData = err.response?.data?.data

      if (status === 403 && errCode === 'AKUN_TERKUNCI') {
        // Tampilkan KaderLockScreen
        const terkunci =
          errData?.terkunciSampai ?? err.response?.data?.terkunciSampai
        if (terkunci) {
          setTerkunciSampai(new Date(terkunci))
        }
        return
      }

      if (status === 403 && errCode === 'AKUN_BELUM_DIVERIFIKASI') {
        setErrorMsg('Akun belum diverifikasi. Cek WhatsApp Anda untuk kode OTP.')
        return
      }

      if (status === 401 && errCode === 'KREDENSIAL_SALAH') {
        const gagal = errData?.gagalLogin
        if (gagal !== undefined) {
          setGagalLogin(gagal)
        }
        setErrorMsg('NIK, No HP, atau kata sandi salah. Silakan coba lagi.')
        return
      }

      // Fallback generic error
      setErrorMsg('Terjadi kesalahan. Silakan coba beberapa saat lagi.')
    },
  })

  const handleSubmit = (values: LoginFormValues) => {
    setErrorMsg(null)
    setIdentifier(values.identifier)
    loginMutation.mutate(values)
  }

  const handleUnlock = () => {
    setTerkunciSampai(null)
    setGagalLogin(0)
  }

  const detectedRole = detectRole(identifier)
  const showRegisterLink = !identifier || detectedRole === 'citizen'

  return (
    <>
      {/* Kader Lock Screen overlay */}
      {terkunciSampai && (
        <KaderLockScreen terkunciSampai={terkunciSampai} onUnlock={handleUnlock} />
      )}

      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb] px-4">
        <div className="w-full max-w-[400px] space-y-6">
          {/* Logo + wordmark */}
          <div className="flex flex-col items-center space-y-2">
            <div className="bg-[#f0fdf4] rounded-full p-3">
              <ShieldCheck size={48} className="text-[#008236]" />
            </div>
            <h1 className="text-2xl font-bold text-[#008236]">SISPOS</h1>
            <p className="text-sm text-[#99a1af]">Digitalisasi Posyandu Indonesia</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-[#f3f4f6] shadow-sm p-6 space-y-4">
            <LoginForm
              onSubmit={handleSubmit}
              isLoading={loginMutation.isPending}
              error={errorMsg}
              gagalLogin={gagalLogin}
            />

            {/* Error alert */}
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Register link — hanya untuk citizen */}
          {showRegisterLink && (
            <p className="text-center text-sm text-gray-500">
              Belum punya akun?{' '}
              <Link to="/register" className="text-[#008236] underline font-bold">
                Daftar sekarang
              </Link>
            </p>
          )}
        </div>
      </div>
    </>
  )
}
