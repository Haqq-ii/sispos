import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { MapPin, Loader2 } from 'lucide-react'

import { WilayahSelect, type WilayahValue } from '@/components/wilayah/WilayahSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import apiClient from '@/lib/axios'

interface SaveLokasiPayload {
  provinsi: string
  kabupaten: string
  kecamatan: string
  kelurahan: string
  rw: string
  rt: string
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

export default function OnboardingLokasiPage() {
  const navigate = useNavigate()

  const [wilayah, setWilayah] = useState<Partial<WilayahValue>>({})
  const [rw, setRw] = useState('')
  const [rt, setRt] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: (payload: SaveLokasiPayload) =>
      apiClient.patch('/auth/lokasi', payload),
    onSuccess: () => {
      navigate('/register/lokasi-selesai', {
        state: {
          provinsi: wilayah.provinsi,
          kabupaten: wilayah.kabupaten,
          kecamatan: wilayah.kecamatan,
          kelurahan: wilayah.kelurahan,
        },
      })
    },
    onError: (_err: ApiError) => {
      setServerError('Gagal menyimpan lokasi. Coba lagi.')
    },
  })

  const handleSubmit = () => {
    if (!wilayah.provinsi || !wilayah.kabupaten || !wilayah.kecamatan || !wilayah.kelurahan) return
    setServerError(null)
    saveMutation.mutate({
      provinsi: wilayah.provinsi,
      kabupaten: wilayah.kabupaten,
      kecamatan: wilayah.kecamatan,
      kelurahan: wilayah.kelurahan,
      rw,
      rt,
    })
  }

  const handleSkip = () => {
    navigate('/citizen/dashboard')
  }

  const allCascadeSelected =
    !!wilayah.provinsi && !!wilayah.kabupaten && !!wilayah.kecamatan && !!wilayah.kelurahan

  const isLoading = saveMutation.isPending

  return (
    <div className="min-h-screen flex items-start justify-center bg-white px-4 py-8">
      <div className="w-full max-w-[400px] space-y-6">
        {/* Ikon + judul */}
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-green-100 rounded-full p-4">
            <MapPin size={48} className="text-primary" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold leading-tight">Atur Lokasi Anda</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Pilih wilayah tempat tinggal Anda agar kami bisa menampilkan Posyandu terdekat
            </p>
            <p className="text-xs text-gray-400">Langkah 3 dari 3</p>
          </div>
        </div>

        {/* Cascade wilayah */}
        <WilayahSelect
          value={wilayah}
          onChange={setWilayah}
          disabled={isLoading}
          required
        />

        {/* RW / RT — tampil setelah kelurahan dipilih */}
        {allCascadeSelected && (
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-sm font-bold">RW</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={3}
                placeholder="001"
                value={rw}
                onChange={(e) => setRw(e.target.value.replace(/\D/g, ''))}
                disabled={isLoading}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-sm font-bold">RT</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={3}
                placeholder="001"
                value={rt}
                onChange={(e) => setRt(e.target.value.replace(/\D/g, ''))}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* CTA Simpan */}
        <Button
          type="button"
          className="w-full min-h-[44px]"
          disabled={!allCascadeSelected || isLoading}
          aria-busy={isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Menyimpan...
            </>
          ) : (
            'Simpan Lokasi'
          )}
        </Button>

        {/* Skip */}
        <Button
          type="button"
          variant="ghost"
          className="w-full text-gray-500"
          onClick={handleSkip}
          disabled={isLoading}
        >
          Lewati untuk sekarang
        </Button>
      </div>
    </div>
  )
}
