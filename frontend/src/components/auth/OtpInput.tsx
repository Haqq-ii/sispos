import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  /** Array 6 karakter digit, kosong string jika belum diisi */
  value: string[]
  /** Dipanggil saat digit pada index berubah */
  onChange: (index: number, digit: string) => void
  /** Dipanggil setelah semua 6 digit terisi, dengan delay 300ms */
  onComplete: () => void
  disabled?: boolean
  /** Saat true, box ditampilkan dengan border destructive + shake animation */
  error?: boolean
}

/**
 * Komponen OTP input 6 kotak dengan:
 * - Auto-advance: saat digit diisi, fokus pindah ke kotak berikutnya
 * - Backspace: saat kotak kosong di-backspace, fokus pindah ke kotak sebelumnya
 * - Paste: paste 6 digit sekaligus mengisi semua kotak
 * - Error state: shake animation dengan border destructive
 * - Auto-submit: onComplete dipanggil 300ms setelah kotak terakhir terisi
 */
export function OtpInput({ value, onChange, onComplete, disabled, error }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus kotak pertama saat mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Cleanup timer saat unmount
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) {
        clearTimeout(completeTimerRef.current)
      }
    }
  }, [])

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    // Hanya ambil satu digit numerik terakhir
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    onChange(index, digit)

    // Auto-advance ke kotak berikutnya
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Cek apakah semua terisi setelah update ini
    const updated = [...value]
    updated[index] = digit
    const allFilled = updated.length === 6 && updated.every((d) => d !== '')
    if (allFilled) {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
      completeTimerRef.current = setTimeout(() => {
        onComplete()
      }, 300)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace pada kotak kosong → pindah ke kotak sebelumnya
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    for (let i = 0; i < 6; i++) {
      onChange(i, pasted[i] ?? '')
    }
    // Fokus ke kotak terakhir yang terisi atau kotak ke-6
    const lastFilled = Math.min(pasted.length - 1, 5)
    inputRefs.current[lastFilled]?.focus()

    // Cek apakah semua 6 kotak terisi dari paste
    if (pasted.length >= 6) {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
      completeTimerRef.current = setTimeout(() => {
        onComplete()
      }, 300)
    }
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Kode OTP 6 digit">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] ?? ''}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ke-${index + 1}`}
          className={cn(
            'w-12 h-14 border border-border rounded-md text-center text-xl font-bold',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            value[index] ? 'bg-green-50 text-foreground' : 'bg-white',
            error && 'border-destructive animate-shake',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      ))}
    </div>
  )
}
