import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { LockKeyhole, Loader2 } from 'lucide-react'

import { OtpInput } from '@/components/auth/OtpInput'
import { Button } from '@/components/ui/button'
import { useOtpCountdown } from '@/hooks/useOtpCountdown'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'
import type { AuthUser } from '@/stores/useAuthStore'

interface VerifyOtpResponse {
  success: boolean
  data: { user: AuthUser }
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

const MAX_RESEND = 3

export default function VerifikasiOtpPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendCount, setResendCount] = useState(0)
  const [isResending, setIsResending] = useState(false)

  const { seconds, isExpired, reset: resetCountdown } = useOtpCountdown(60)

  // Baca nomor HP dari sessionStorage
  const nomorPonsel = sessionStorage.getItem('reg_ponsel') ?? ''
  const maskedPhone = sessionStorage.getItem('reg_ponsel_masked') ?? nomorPonsel

  // Redirect ke /register jika sessionStorage kosong (tidak lewat RegisterPage)
  useEffect(() => {
    if (!nomorPonsel) {
      navigate('/register', { replace: true })
    }
  }, [nomorPonsel, navigate])

  const verifyMutation = useMutation({
    mutationFn: (kodeOtp: string) =>
      apiClient.post<VerifyOtpResponse>('/auth/otp/verify', {
        nomorPonsel,
        kodeOtp,
      }),
    onSuccess: (response) => {
      setUser(response.data.data.user)
      sessionStorage.removeItem('reg_ponsel')
      sessionStorage.removeItem('reg_ponsel_masked')
      navigate('/register/lokasi')
    },
    onError: (err: ApiError) => {
      const errCode = err.response?.data?.error
      if (errCode === 'OTP_KADALUARSA' || errCode === 'OTP_EXPIRED') {
        setOtpError('Kode OTP telah kedaluwarsa. Minta kode baru.')
      } else {
        setOtpError('Kode salah.')
      }
      // Reset digit boxes saat error
      setDigits(['', '', '', '', '', ''])
    },
  })

  const handleOtpChange = (index: number, digit: string) => {
    setOtpError(null)
    setDigits((prev) => {
      const updated = [...prev]
      updated[index] = digit
      return updated
    })
  }

  const handleOtpComplete = () => {
    const code = digits.join('')
    if (code.length === 6 && !verifyMutation.isPending) {
      verifyMutation.mutate(code)
    }
  }

  const handleManualVerify = () => {
    const code = digits.join('')
    if (code.length === 6) {
      verifyMutation.mutate(code)
    }
  }

  const handleResend = async () => {
    if (resendCount >= MAX_RESEND || isResending) return
    setIsResending(true)
    setOtpError(null)
    try {
      await apiClient.post('/auth/otp/send', { nomorPonsel })
      resetCountdown()
      setResendCount((prev) => prev + 1)
      setDigits(['', '', '', '', '', ''])
    } catch {
      setOtpError('Gagal mengirim ulang OTP. Coba lagi.')
    } finally {
      setIsResending(false)
    }
  }

  const allFilled = digits.every((d) => d !== '')
  const isLoading = verifyMutation.isPending

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-[360px] space-y-8">
        {/* Ikon */}
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-green-100 rounded-full p-4">
            <LockKeyhole size={64} className="text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold leading-tight">Verifikasi OTP</h1>
            <p className="text-sm text-gray-500">
              Kode 6 digit dikirim ke WhatsApp{' '}
              <span className="font-bold text-foreground">{maskedPhone}</span>
            </p>
          </div>
        </div>

        {/* OTP Input */}
        <div className="flex justify-center">
          <OtpInput
            value={digits}
            onChange={handleOtpChange}
            onComplete={handleOtpComplete}
            disabled={isLoading}
            error={!!otpError}
          />
        </div>

        {/* Error message */}
        <div aria-live="polite" className="min-h-[20px] text-center">
          {otpError && (
            <p className="text-sm font-bold text-destructive">{otpError}</p>
          )}
        </div>

        {/* CTA */}
        <Button
          type="button"
          className="w-full min-h-[44px]"
          disabled={!allFilled || isLoading}
          aria-busy={isLoading}
          onClick={handleManualVerify}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Memverifikasi...
            </>
          ) : (
            'Verifikasi Kode OTP'
          )}
        </Button>

        {/* Countdown / Resend */}
        <div className="text-center">
          {!isExpired ? (
            <p className="text-sm text-gray-500">
              Kirim ulang dalam <span className="font-bold">{seconds}</span> detik
            </p>
          ) : resendCount >= MAX_RESEND ? (
            <p className="text-sm text-gray-500">
              Batas pengiriman tercapai. Hubungi admin.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={isResending}
              className="text-sm text-primary underline disabled:opacity-50"
            >
              {isResending ? (
                <span className="flex items-center gap-1 justify-center">
                  <Loader2 className="animate-spin" size={14} />
                  Mengirim...
                </span>
              ) : (
                'Tidak menerima kode? Kirim ulang'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
