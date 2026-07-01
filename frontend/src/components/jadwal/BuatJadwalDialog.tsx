import { Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useJadwalList } from '@/hooks/useJadwalList'
import apiClient from '@/lib/axios'
import {
  CreateJadwalFESchema,
  type CreateJadwalFEInput,
} from '@/lib/validations/jadwal.schema'

// ── Type guard for Axios-like errors ─────────────────────────────────────────
function isAxiosLikeError(
  error: unknown,
): error is { response: { data: { error: string; message: string } } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response: unknown }).response === 'object' &&
    (error as { response: unknown }).response !== null &&
    'data' in ((error as { response: Record<string, unknown> }).response)
  )
}

// ── Format Date → YYYY-MM-DD (local time, avoids UTC midnight offset) ─────────
function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Format Date → DD/MM/YYYY (display) ───────────────────────────────────────
function formatDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface BuatJadwalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  posyanduList: Array<{ id: string; namaPosyandu: string }>
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BuatJadwalDialog({
  open,
  onOpenChange,
  posyanduList,
}: BuatJadwalDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Jadwal list for disabled-date detection (exclude dates with existing jadwal for the same posyandu)
  const { data: jadwalList } = useJadwalList()

  const form = useForm<CreateJadwalFEInput>({
    resolver: zodResolver(CreateJadwalFESchema),
    defaultValues: {
      estimasiDurasiMenit: 7,
    },
  })

  const selectedPosyanduId = form.watch('posyanduId')
  const estimasiDurasiMenit = form.watch('estimasiDurasiMenit')
  const selectedDate = form.watch('tanggalPelaksanaan') as Date | undefined

  // Preview kuota = floor(60 / estimasi); show only when estimasi is valid
  const showPreview =
    typeof estimasiDurasiMenit === 'number' && estimasiDurasiMenit >= 5
  const kuota = showPreview ? Math.floor(60 / estimasiDurasiMenit) : 0

  // ── Disabled date logic ────────────────────────────────────────────────────
  const isDateDisabled = (date: Date): boolean => {
    // Disable today and past — tomorrow is earliest
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date <= today) return true

    // Disable dates that already have a jadwal for the selected posyandu
    if (selectedPosyanduId && jadwalList) {
      const dateStr = formatDateYYYYMMDD(date)
      return jadwalList.some(
        (j) =>
          j.posyanduId === selectedPosyanduId &&
          j.tanggalPelaksanaan.startsWith(dateStr),
      )
    }
    return false
  }

  // ── Mutation: POST /api/jadwal ─────────────────────────────────────────────
  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateJadwalFEInput) =>
      apiClient
        .post('/jadwal', {
          posyanduId: data.posyanduId,
          tanggalPelaksanaan: formatDateYYYYMMDD(data.tanggalPelaksanaan),
          estimasiDurasiMenit: data.estimasiDurasiMenit,
        })
        .then((r) => r.data.data),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jadwal', 'list'] })
      onOpenChange(false)
      form.reset()
      toast({ description: 'Jadwal berhasil dibuat. 3 sesi ter-generate otomatis.' })
    },

    onError: (error) => {
      if (
        isAxiosLikeError(error) &&
        error.response.data.error === 'JADWAL_SUDAH_ADA'
      ) {
        // 409 JADWAL_SUDAH_ADA → field-level error on tanggal picker
        form.setError('tanggalPelaksanaan', {
          message: 'Jadwal untuk posyandu ini pada tanggal tersebut sudah ada.',
        })
      } else {
        form.setError('root', {
          message: 'Terjadi kesalahan. Silakan coba beberapa saat lagi.',
        })
      }
    },
  })

  const onSubmit = (data: CreateJadwalFEInput) => {
    mutate(data)
  }

  // Reset form when dialog closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset()
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Jadwal Baru</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* ── 1. Posyandu Select ─────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="posyanduId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Posyandu</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Posyandu" />
                    </SelectTrigger>
                    <SelectContent>
                      {posyanduList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.namaPosyandu}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── 2. Tanggal Pelaksanaan Calendar ────────────────────────── */}
            <FormField
              control={form.control}
              name="tanggalPelaksanaan"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Tanggal Pelaksanaan</FormLabel>
                  <div className="border rounded-md inline-block">
                    <Calendar
                      mode="single"
                      selected={field.value as Date | undefined}
                      onSelect={(date: Date | undefined) => field.onChange(date)}
                      disabled={isDateDisabled}
                    />
                  </div>
                  {selectedDate && (
                    <p className="text-xs text-gray-500">
                      Dipilih: {formatDDMMYYYY(selectedDate)}
                    </p>
                  )}
                  {fieldState.error && (
                    <p className="text-sm font-medium text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* ── 3. Estimasi Durasi per Orang ────────────────────────────── */}
            <FormField
              control={form.control}
              name="estimasiDurasiMenit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimasi Durasi per Orang (menit)</FormLabel>
                  <Input
                    type="number"
                    min={5}
                    max={30}
                    step={1}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      field.onChange(isNaN(val) ? undefined : val)
                    }}
                    onBlur={field.onBlur}
                  />
                  <FormDescription>
                    Sistem akan membuat 3 sesi otomatis dengan kuota floor(60 ÷ estimasi) per sesi
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── 4. Slot Preview ────────────────────────────────────────── */}
            {showPreview && (
              <div className="bg-green-50 p-3 rounded-md space-y-1">
                <p className="text-xs text-gray-600 font-medium">
                  Preview sesi ({estimasiDurasiMenit} menit &rarr; kuota {kuota}/sesi):
                </p>
                <p className="text-xs text-gray-600">Sesi 1 &middot; 08:00 &ndash; 09:00 &middot; {kuota} kuota</p>
                <p className="text-xs text-gray-600">Sesi 2 &middot; 09:00 &ndash; 10:00 &middot; {kuota} kuota</p>
                <p className="text-xs text-gray-600">Sesi 3 &middot; 10:00 &ndash; 11:00 &middot; {kuota} kuota</p>
              </div>
            )}

            {/* ── Root error ─────────────────────────────────────────────── */}
            {form.formState.errors.root && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                Tutup
              </Button>
              <Button type="submit" disabled={isPending} className="min-h-[44px]">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Membuat jadwal...
                  </>
                ) : (
                  'Buat Jadwal'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
