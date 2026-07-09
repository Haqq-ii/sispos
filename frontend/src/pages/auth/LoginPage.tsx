import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ShieldCheck, MapPin } from 'lucide-react'

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

  // Demo login helper — calls same mutation as LoginForm
  const handleDemoLogin = (demoIdentifier: string, password: string) => {
    setErrorMsg(null)
    setIdentifier(demoIdentifier)
    loginMutation.mutate({ identifier: demoIdentifier, password })
  }

  const detectedRole = detectRole(identifier)
  const showRegisterLink = !identifier || detectedRole === 'citizen'

  return (
    <>
      {/* Kader Lock Screen overlay */}
      {terkunciSampai && (
        <KaderLockScreen terkunciSampai={terkunciSampai} onUnlock={handleUnlock} />
      )}

      {/* Root container — mint green background */}
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0fdf4] px-4 py-8">
        <div className="w-full max-w-[400px] space-y-4">
          <Link
            to="/"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-1 text-sm font-semibold text-[#008236] transition-colors hover:text-[#006b2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008236] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f0fdf4]"
          >
            <ArrowLeft size={18} />
            Kembali
          </Link>

          {/* ── Logo + wordmark ─────────────────────────────────────────────── */}
          <div className="flex flex-col items-center">
            {/* Green rounded-square icon block */}
            <div className="w-16 h-16 bg-[#008236] rounded-2xl flex items-center justify-center mb-3">
              <ShieldCheck size={36} className="text-white" />
            </div>
            <h1 className="text-[#008236] font-bold text-2xl">SISPOS</h1>
            <p className="text-[#99a1af] text-sm mt-0.5">Sistem Informasi Posyandu</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <MapPin size={12} className="text-[#008236]" />
              <span className="text-[#008236] text-xs">Posyandu Digital Indonesia</span>
            </div>
          </div>

          {/* ── Login card ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#f3f4f6] shadow-md px-6 py-6 space-y-4">
            {/* Heading */}
            <div>
              <h2 className="text-[#1e2939] font-bold text-lg mb-1">Masuk ke Akun</h2>
              {/* Role detection chip — ditampilkan jika identifier terisi */}
              {identifier && (
                <span className="bg-[#dcfce7] text-[#008236] text-xs rounded-[10px] px-2 py-0.5 mb-3 inline-block">
                  {detectedRole === 'citizen' && 'Warga (NIK)'}
                  {detectedRole === 'kader' && 'Kader / Ketua Kader (No HP)'}
                  {detectedRole === 'puskesmas' && 'Puskesmas (Email)'}
                </span>
              )}
            </div>

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

          {/* ── Demo Akun Cepat ─────────────────────────────────────────────── */}
          <div>
            <p className="text-[#99a1af] text-xs font-semibold tracking-wider text-center mb-2">
              Demo Akun Cepat
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('3471012345670001', 'Demo1234!')}
                disabled={loginMutation.isPending}
                className="bg-white border border-[#f3f4f6] rounded-[14px] py-2.5 px-4 w-full text-sm font-semibold text-[#364153] shadow-sm hover:bg-[#f0fdf4] transition-colors disabled:opacity-60"
              >
                Demo Warga
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('081234560001', '123456')}
                disabled={loginMutation.isPending}
                className="bg-white border border-[#f3f4f6] rounded-[14px] py-2.5 px-4 w-full text-sm font-semibold text-[#364153] shadow-sm hover:bg-[#f0fdf4] transition-colors disabled:opacity-60"
              >
                Demo Kader
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('demo@puskesmas-mergangsan.go.id', 'Demo1234!')}
                disabled={loginMutation.isPending}
                className="bg-white border border-[#f3f4f6] rounded-[14px] py-2.5 px-4 w-full text-sm font-semibold text-[#364153] shadow-sm hover:bg-[#f0fdf4] transition-colors disabled:opacity-60"
              >
                Demo Puskesmas
              </button>
            </div>
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

          {/* ── Legal footer ────────────────────────────────────────────────── */}
          <p className="text-center text-[#99a1af] text-[10px] mt-4 leading-relaxed">
            SISPOS v1.0 · Dilindungi UU PDP No. 27/2022 · TLS 1.3 + AES-256
          </p>

        </div>
      </div>
    </>
  )
}
