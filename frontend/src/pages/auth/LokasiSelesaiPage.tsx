import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface LokasiState {
  provinsi?: string
  kabupaten?: string
  kecamatan?: string
  kelurahan?: string
}

const REDIRECT_SECONDS = 5

export default function LokasiSelesaiPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const lokasi = (location.state as LokasiState | null) ?? {}
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS)

  // Auto-redirect ke /citizen/dashboard setelah 5 detik
  useEffect(() => {
    if (countdown <= 0) {
      navigate('/citizen/dashboard', { replace: true })
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown, navigate])

  const handleStart = () => {
    navigate('/citizen/dashboard', { replace: true })
  }

  const lokasiText = [lokasi.kelurahan, lokasi.kecamatan, lokasi.kabupaten, lokasi.provinsi]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white px-4">
      <div className="w-full max-w-[360px] space-y-8 text-center">
        {/* Ikon sukses */}
        <div className="flex justify-center">
          <CheckCircle size={64} strokeWidth={1.5} className="text-primary" />
        </div>

        {/* Judul + body */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold leading-tight">Lokasi Tersimpan!</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Selamat datang di SISPOS. Akun Anda sudah aktif.
          </p>
        </div>

        {/* Ringkasan lokasi */}
        {lokasiText ? (
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm font-bold text-foreground">{lokasiText}</p>
          </div>
        ) : null}

        {/* CTA */}
        <Button
          type="button"
          className="w-full min-h-[44px]"
          onClick={handleStart}
        >
          Mulai Gunakan SISPOS
        </Button>

        {/* Auto-redirect caption */}
        <p className="text-xs text-gray-400">
          Diarahkan otomatis dalam {countdown} detik...
        </p>
      </div>
    </div>
  )
}
