import { Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useProvinsi, useKabupaten, useKecamatan, useKelurahan } from '@/hooks/useWilayah'

export interface WilayahValue {
  provinsi: string
  kabupaten: string
  kecamatan: string
  kelurahan: string
}

interface WilayahSelectProps {
  value: Partial<WilayahValue>
  onChange: (v: Partial<WilayahValue>) => void
  disabled?: boolean
  required?: boolean
}

/**
 * Cascade 4-level dropdown wilayah: Provinsi → Kabupaten → Kecamatan → Kelurahan.
 * Setiap level fetch data dari /api/wilayah/* via TanStack Query.
 * Downstream selections di-reset saat parent berubah.
 */
export function WilayahSelect({ value, onChange, disabled, required }: WilayahSelectProps) {
  const provinsiQuery = useProvinsi()
  const kabupatenQuery = useKabupaten(value.provinsi ?? null)
  const kecamatanQuery = useKecamatan(value.kabupaten ?? null, value.provinsi ?? null)
  const kelurahanQuery = useKelurahan(
    value.kecamatan ?? null,
    value.kabupaten ?? null,
    value.provinsi ?? null
  )

  const handleProvinsiChange = (val: string) => {
    onChange({ provinsi: val, kabupaten: '', kecamatan: '', kelurahan: '' })
  }

  const handleKabupatenChange = (val: string) => {
    onChange({ ...value, kabupaten: val, kecamatan: '', kelurahan: '' })
  }

  const handleKecamatanChange = (val: string) => {
    onChange({ ...value, kecamatan: val, kelurahan: '' })
  }

  const handleKelurahanChange = (val: string) => {
    onChange({ ...value, kelurahan: val })
  }

  return (
    <div className="space-y-4">
      {/* Provinsi */}
      <div className="space-y-1">
        <Label className="text-sm font-bold">
          Provinsi{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Select
          value={value.provinsi ?? ''}
          onValueChange={handleProvinsiChange}
          disabled={disabled || provinsiQuery.isLoading}
        >
          <SelectTrigger className="min-h-[44px] w-full" aria-busy={provinsiQuery.isLoading}>
            {provinsiQuery.isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" />
                Memuat...
              </span>
            ) : (
              <SelectValue placeholder="Pilih Provinsi" />
            )}
          </SelectTrigger>
          <SelectContent>
            {provinsiQuery.data?.map((prov) => (
              <SelectItem key={prov} value={prov}>
                {prov}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {provinsiQuery.isError && (
          <p className="text-xs text-destructive">
            Gagal memuat data wilayah.{' '}
            <button
              type="button"
              className="underline text-primary"
              onClick={() => void provinsiQuery.refetch()}
            >
              Coba lagi.
            </button>
          </p>
        )}
      </div>

      {/* Kabupaten */}
      <div className="space-y-1">
        <Label className="text-sm font-bold">
          Kabupaten / Kota{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Select
          value={value.kabupaten ?? ''}
          onValueChange={handleKabupatenChange}
          disabled={disabled || !value.provinsi || kabupatenQuery.isLoading}
        >
          <SelectTrigger
            className="min-h-[44px] w-full"
            aria-busy={kabupatenQuery.isLoading}
            aria-disabled={!value.provinsi}
          >
            {kabupatenQuery.isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" />
                Memuat...
              </span>
            ) : (
              <SelectValue placeholder="Pilih Kabupaten" />
            )}
          </SelectTrigger>
          <SelectContent>
            {kabupatenQuery.data?.map((kab) => (
              <SelectItem key={kab} value={kab}>
                {kab}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {kabupatenQuery.isError && (
          <p className="text-xs text-destructive">
            Gagal memuat data wilayah.{' '}
            <button
              type="button"
              className="underline text-primary"
              onClick={() => void kabupatenQuery.refetch()}
            >
              Coba lagi.
            </button>
          </p>
        )}
      </div>

      {/* Kecamatan */}
      <div className="space-y-1">
        <Label className="text-sm font-bold">
          Kecamatan{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Select
          value={value.kecamatan ?? ''}
          onValueChange={handleKecamatanChange}
          disabled={disabled || !value.kabupaten || kecamatanQuery.isLoading}
        >
          <SelectTrigger
            className="min-h-[44px] w-full"
            aria-busy={kecamatanQuery.isLoading}
            aria-disabled={!value.kabupaten}
          >
            {kecamatanQuery.isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" />
                Memuat...
              </span>
            ) : (
              <SelectValue placeholder="Pilih Kecamatan" />
            )}
          </SelectTrigger>
          <SelectContent>
            {kecamatanQuery.data?.map((kec) => (
              <SelectItem key={kec} value={kec}>
                {kec}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {kecamatanQuery.isError && (
          <p className="text-xs text-destructive">
            Gagal memuat data wilayah.{' '}
            <button
              type="button"
              className="underline text-primary"
              onClick={() => void kecamatanQuery.refetch()}
            >
              Coba lagi.
            </button>
          </p>
        )}
      </div>

      {/* Kelurahan */}
      <div className="space-y-1">
        <Label className="text-sm font-bold">
          Kelurahan / Desa{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Select
          value={value.kelurahan ?? ''}
          onValueChange={handleKelurahanChange}
          disabled={disabled || !value.kecamatan || kelurahanQuery.isLoading}
        >
          <SelectTrigger
            className="min-h-[44px] w-full"
            aria-busy={kelurahanQuery.isLoading}
            aria-disabled={!value.kecamatan}
          >
            {kelurahanQuery.isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" />
                Memuat...
              </span>
            ) : (
              <SelectValue placeholder="Pilih Kelurahan" />
            )}
          </SelectTrigger>
          <SelectContent>
            {kelurahanQuery.data?.map((kel) => (
              <SelectItem key={kel} value={kel}>
                {kel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {kelurahanQuery.isError && (
          <p className="text-xs text-destructive">
            Gagal memuat data wilayah.{' '}
            <button
              type="button"
              className="underline text-primary"
              onClick={() => void kelurahanQuery.refetch()}
            >
              Coba lagi.
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
