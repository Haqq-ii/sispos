import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'

interface KaderLockScreenProps {
  terkunciSampai: Date | string
  onUnlock: () => void
}

export function KaderLockScreen({ terkunciSampai, onUnlock }: KaderLockScreenProps): JSX.Element {
  const targetTime = new Date(terkunciSampai).getTime()

  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, targetTime - Date.now()))

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, targetTime - Date.now())
      setRemainingMs(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        onUnlock()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [targetTime, onUnlock])

  const minutes = Math.floor(remainingMs / 60000)
  const seconds = Math.floor((remainingMs % 60000) / 1000)
  const mm = minutes.toString().padStart(2, '0')
  const ss = seconds.toString().padStart(2, '0')

  return (
    <div
      role="alert"
      className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center px-4"
    >
      <div className="max-w-[360px] w-full text-center space-y-4">
        {/* Lock icon */}
        <div className="flex justify-center">
          <div className="bg-red-50 rounded-full p-4">
            <LockKeyhole size={64} className="text-destructive" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-destructive">Akun Terkunci</h1>

        {/* Body */}
        <p className="text-sm text-gray-600">
          Terlalu banyak percobaan PIN salah. Akun Anda terkunci sementara untuk melindungi
          keamanan.
        </p>

        {/* Countdown */}
        <div className="space-y-1">
          <p className="text-2xl font-bold text-foreground">
            {mm}:{ss}
          </p>
          <p className="text-xs text-gray-400">Coba lagi setelah waktu habis</p>
        </div>

        {/* Contact */}
        <p className="text-xs text-gray-400 mt-4">
          Hubungi Ketua Kader atau Puskesmas untuk membuka kunci lebih awal.
        </p>
      </div>
    </div>
  )
}
