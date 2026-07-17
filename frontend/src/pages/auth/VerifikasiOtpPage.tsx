import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { LockKeyhole, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useOtpCountdown } from '@/hooks/useOtpCountdown'
import { useAuthStore } from '@/stores/useAuthStore'
import apiClient from '@/lib/axios'
import type { AuthUser } from '@/stores/useAuthStore'
import { cn } from '@/lib/utils'

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

  /** Refs array untuk focus management 6 digit OTP */
  const digitRefs = useRef<(HTMLInputElement | null)[]>([])
  const verifiedRef = useRef(false)

  const { seconds, isExpired, reset: resetCountdown } = useOtpCountdown(60)

  // Baca nomor HP dari sessionStorage
  const nomorPonsel = sessionStorage.getItem('reg_ponsel') ?? ''
  const maskedPhone = sessionStorage.getItem('reg_ponsel_masked') ?? nomorPonsel

  // Redirect ke /register jika sessionStorage kosong (tidak lewat RegisterPage)
  useEffect(() => {
    if (!nomorPonsel && !verifiedRef.current) {
      navigate('/register', { replace: true })
    }
  }, [nomorPonsel, navigate])

  // Auto-focus digit pertama saat mount
  useEffect(() => {
    digitRefs.current[0]?.focus()
  }, [])

  const verifyMutation = useMutation({
    mutationFn: (kodeOtp: string) =>
      apiClient.post<VerifyOtpResponse>('/auth/otp/verify', {
        nomorPonsel,
        kodeOtp,
      }),
    onSuccess: (response) => {
      verifiedRef.current = true
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
      digitRefs.current[0]?.focus()
    },
  })

  const handleDigitChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    setOtpError(null)
    // Hanya ambil satu digit numerik terakhir
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const updated = [...prev]
      updated[idx] = digit
      return updated
    })
    // Auto-advance ke input berikutnya
    if (digit && idx < 5) {
      digitRefs.current[idx + 1]?.focus()
    }
    // Auto-submit saat semua digit terisi
    const updated = [...digits]
    updated[idx] = digit
    if (updated.every((d) => d !== '') && !verifyMutation.isPending) {
      setTimeout(() => {
        verifyMutation.mutate(updated.join(''))
      }, 300)
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace pada kotak kosong → pindah ke kotak sebelumnya
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      digitRefs.current[idx - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const updated = Array.from({ length: 6 }, (_, i) => pasted[i] ?? '')
    setDigits(updated)
    const lastFilled = Math.min(pasted.length - 1, 5)
    digitRefs.current[lastFilled]?.focus()
    if (pasted.length >= 6 && !verifyMutation.isPending) {
      setTimeout(() => {
        verifyMutation.mutate(updated.join(''))
      }, 300)
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
      digitRefs.current[0]?.focus()
    } catch {
      setOtpError('Gagal mengirim ulang OTP. Coba lagi.')
    } finally {
      setIsResending(false)
    }
  }

  const allFilled = digits.every((d) => d !== '')
  const isLoading = verifyMutation.isPending

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9fafb] px-4">
      <div className="w-full max-w-[360px] space-y-8">
        {/* Ikon */}
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-green-100 rounded-full p-4">
            <LockKeyhole size={64} className="text-[#008236]" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold leading-tight text-[#1e2939]">Verifikasi OTP</h1>
            <p className="text-sm text-[#99a1af]">
              Kode 6 digit dikirim ke WhatsApp{' '}
              <span className="font-bold text-[#1e2939]">{maskedPhone}</span>
            </p>
          </div>
        </div>

        {/* OTP Input — 6 digit terpisah dengan auto-advance */}
        <div className="flex justify-center gap-2" role="group" aria-label="Kode OTP 6 digit">
          {Array.from({ length: 6 }).map((_, idx) => (
            <input
              key={idx}
              ref={(el) => {
                digitRefs.current[idx] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digits[idx] ?? ''}
              onChange={(e) => handleDigitChange(idx, e)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              aria-label={`Digit ke-${idx + 1}`}
              className={cn(
                'w-10 h-12 text-center text-xl font-bold',
                'border border-[#e5e7eb] rounded-xl',
                'focus:border-[#008236] focus:outline-none focus:ring-2 focus:ring-[#008236]',
                'transition-colors',
                digits[idx] ? 'bg-green-50 text-[#1e2939]' : 'bg-white',
                otpError && 'border-destructive',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            />
          ))}
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
          className="w-full min-h-[44px] bg-[#008236] text-white hover:bg-[#006a2b] rounded-[14px]"
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
            <p className="text-sm text-[#99a1af]">
              Kirim ulang dalam <span className="font-bold text-[#1e2939]">{seconds}</span> detik
            </p>
          ) : resendCount >= MAX_RESEND ? (
            <p className="text-sm text-[#99a1af]">
              Batas pengiriman tercapai. Hubungi admin.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={isResending}
              className="text-sm text-[#008236] underline disabled:opacity-50"
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

