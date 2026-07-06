import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import apiClient from '@/lib/axios'

// ── Schema ─────────────────────────────────────────────────────────────────────

const schema = z.object({
  namaBalita: z.string().min(2, 'Nama minimal 2 karakter').max(200),
  tanggalLahir: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid'),
  jenisKelamin: z.enum(['laki_laki', 'perempuan']),
  nikBalita: z
    .string()
    .regex(/^\d{16}$/, 'NIK harus 16 angka')
    .optional()
    .or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

// ── Props ──────────────────────────────────────────────────────────────────────

interface TambahBalitaModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (balitaId: string) => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TambahBalitaModal({ open, onClose, onSuccess }: TambahBalitaModalProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { namaBalita: '', tanggalLahir: '', jenisKelamin: undefined, nikBalita: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiClient
        .post('/balita', {
          namaBalita: data.namaBalita,
          tanggalLahir: data.tanggalLahir,
          jenisKelamin: data.jenisKelamin,
          nikBalita: data.nikBalita || undefined,
        })
        .then((r) => r.data.data as { id: string }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['balita', 'saya'] })
      reset()
      onSuccess?.(data.id)
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; message?: string } } }
      if (e.response?.data?.error === 'NIK_SUDAH_TERDAFTAR') {
        setError('nikBalita', { message: 'NIK sudah terdaftar di sistem' })
      }
    },
  })

  const handleClose = () => {
    if (mutation.isPending) return
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-800">Tambah Profil Anak</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4 mt-2"
        >
          {/* Nama */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nama Lengkap Anak <span className="text-red-500">*</span>
            </label>
            <input
              {...register('namaBalita')}
              placeholder="Contoh: Ahmad Fauzi"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            {errors.namaBalita && (
              <p className="text-red-500 text-xs mt-1">{errors.namaBalita.message}</p>
            )}
          </div>

          {/* Tanggal Lahir */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Tanggal Lahir <span className="text-red-500">*</span>
            </label>
            <input
              {...register('tanggalLahir')}
              type="date"
              max={new Date().toISOString().split('T')[0]}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            {errors.tanggalLahir && (
              <p className="text-red-500 text-xs mt-1">{errors.tanggalLahir.message}</p>
            )}
          </div>

          {/* Jenis Kelamin */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Jenis Kelamin <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {(['laki_laki', 'perempuan'] as const).map((val) => (
                <label
                  key={val}
                  className="flex-1 flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer has-[:checked]:border-green-500 has-[:checked]:bg-green-50"
                >
                  <input
                    {...register('jenisKelamin')}
                    type="radio"
                    value={val}
                    className="accent-green-600"
                  />
                  <span className="text-sm text-gray-700">
                    {val === 'laki_laki' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                </label>
              ))}
            </div>
            {errors.jenisKelamin && (
              <p className="text-red-500 text-xs mt-1">{errors.jenisKelamin.message}</p>
            )}
          </div>

          {/* NIK (opsional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              NIK Anak <span className="text-gray-400 font-normal">(opsional, 16 digit)</span>
            </label>
            <input
              {...register('nikBalita')}
              placeholder="3471xxxxxxxxxxxxxxx"
              maxLength={16}
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            {errors.nikBalita && (
              <p className="text-red-500 text-xs mt-1">{errors.nikBalita.message}</p>
            )}
          </div>

          {/* Error global */}
          {mutation.isError && !errors.nikBalita && (
            <p className="text-red-500 text-xs">Gagal menyimpan. Coba lagi.</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-xl bg-green-700 hover:bg-green-800 text-white"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
