import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, Eye, EyeOff, Loader2 } from 'lucide-react'

import { registerSchema, type RegisterFormValues } from '@/lib/validations/register.schema'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import apiClient from '@/lib/axios'

interface RegisterResponse {
  success: boolean
  data: {
    nomorPonselMasked: string
  }
  message: string
}

interface ApiError {
  response?: {
    status: number
    data?: {
      error?: string
      message?: string
    }
  }
}

/** Hitung skor kekuatan password 0-3 untuk bar 3-level */
function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++ // extra: special char
  // Normalkan ke 3 level
  if (score <= 1) return 1
  if (score === 2) return 2
  return 3
}

const strengthLabel: Record<1 | 2 | 3, string> = {
  1: 'Lemah',
  2: 'Sedang',
  3: 'Kuat',
}

const strengthColor: Record<1 | 2 | 3, string> = {
  1: 'bg-red-500',
  2: 'bg-amber-500',
  3: 'bg-green-500',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showKonfirmasi, setShowKonfirmasi] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      nikIbu: '',
      namaLengkap: '',
      nomorPonsel: '',
      password: '',
      konfirmasi: '',
    },
  })

  const nikValue = form.watch('nikIbu')
  const passwordValue = form.watch('password')
  const passwordStrength = getPasswordStrength(passwordValue)

  const registerMutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      apiClient.post<RegisterResponse>('/auth/register', {
        nikIbu: values.nikIbu,
        namaLengkap: values.namaLengkap,
        nomorPonsel: values.nomorPonsel,
        password: values.password,
      }),
    onSuccess: (response, variables) => {
      const maskedPhone = response.data.data?.nomorPonselMasked ?? variables.nomorPonsel
      sessionStorage.setItem('reg_ponsel', variables.nomorPonsel)
      sessionStorage.setItem('reg_ponsel_masked', maskedPhone)
      navigate('/register/verifikasi')
    },
    onError: (err: ApiError) => {
      const errCode = err.response?.data?.error

      if (errCode === 'NIK_SUDAH_TERDAFTAR') {
        form.setError('nikIbu', { message: 'NIK sudah terdaftar. Silakan login.' })
        return
      }
      if (errCode === 'HP_SUDAH_TERDAFTAR') {
        form.setError('nomorPonsel', { message: 'Nomor HP sudah terdaftar.' })
        return
      }
      setServerError('Terjadi kesalahan. Silakan coba beberapa saat lagi.')
    },
  })

  const handleSubmit = (values: RegisterFormValues) => {
    setServerError(null)
    registerMutation.mutate(values)
  }

  const isLoading = registerMutation.isPending

  return (
    <div className="min-h-screen flex items-start justify-center bg-white px-4 py-8">
      <div className="w-full max-w-[400px] space-y-6">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 -ml-1"
          aria-label="Kembali ke halaman login"
        >
          <ChevronLeft size={20} />
          <span>Kembali</span>
        </button>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold leading-tight">Buat Akun Baru</h1>
          <p className="text-sm text-gray-500">Daftarkan diri sebagai Warga Posyandu</p>
        </div>

        {/* Form card */}
        <div className="bg-green-50 rounded-lg shadow-sm p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* NIK Ibu */}
              <FormField
                control={form.control}
                name="nikIbu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIK Ibu (16 Digit)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type="text"
                          inputMode="numeric"
                          maxLength={16}
                          placeholder="3471000000000000"
                          autoComplete="off"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {nikValue.length}/16
                        </span>
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500">NIK tertera di KTP</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nama Lengkap */}
              <FormField
                control={form.control}
                name="namaLengkap"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Siti Rahayu"
                        autoComplete="name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nomor HP */}
              <FormField
                control={form.control}
                name="nomorPonsel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor HP (WhatsApp aktif)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="081234567890"
                        autoComplete="tel"
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500">OTP akan dikirim ke nomor ini via WhatsApp</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Kata Sandi */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kata Sandi</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 8 karakter"
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                          aria-pressed={showPassword}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    {/* Password strength bar */}
                    {passwordValue.length > 0 && (
                      <div className="space-y-1 mt-1">
                        <div className="flex gap-1">
                          {([1, 2, 3] as const).map((level) => (
                            <div
                              key={level}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                passwordStrength >= level && passwordStrength > 0
                                  ? strengthColor[passwordStrength as 1 | 2 | 3]
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        {passwordStrength > 0 && (
                          <p className="text-xs text-gray-500">
                            Kekuatan: {strengthLabel[passwordStrength as 1 | 2 | 3]}
                          </p>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Konfirmasi Kata Sandi */}
              <FormField
                control={form.control}
                name="konfirmasi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ulangi Kata Sandi</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showKonfirmasi ? 'text' : 'password'}
                          placeholder="Ulangi kata sandi"
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKonfirmasi((prev) => !prev)}
                          aria-label={showKonfirmasi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                          aria-pressed={showKonfirmasi}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                          tabIndex={-1}
                        >
                          {showKonfirmasi ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Server error */}
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {/* CTA */}
              <Button
                type="submit"
                className="w-full min-h-[44px]"
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={18} />
                    Mengirim OTP...
                  </>
                ) : (
                  'Daftar & Kirim OTP'
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Link ke login */}
        <p className="text-center text-sm text-gray-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-primary underline font-bold">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  )
}
