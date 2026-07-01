/**
 * BatalkanAntrianDialog — dialog konfirmasi pembatalan antrian (D-06).
 *
 * ATURAN:
 * - Trigger button ini hanya DIRENDER oleh TiketAntrianPage ketika
 *   statusAntrian === 'menunggu'. Hidden saat dipanggil/selesai/dibatalkan.
 * - Confirm button menggunakan variant="destructive" (02-UI-SPEC.md Destructive Actions)
 * - Toast "Antrian berhasil dibatalkan." setelah sukses
 * - Buttons disabled saat mutation pending; Loader2 pada confirm button
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useBatalkanAntrian } from '@/hooks/useSesiAvailability'
import { useToast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BatalkanAntrianDialogProps {
  antrianId: string
  /** Dipanggil setelah pembatalan berhasil — biasanya invalidate query */
  onBatalkanSuccess: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BatalkanAntrianDialog({
  antrianId,
  onBatalkanSuccess,
}: BatalkanAntrianDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const mutation = useBatalkanAntrian()

  const handleBatalkan = () => {
    mutation.mutate(antrianId, {
      onSuccess: () => {
        setOpen(false)
        onBatalkanSuccess()
        toast({ description: 'Antrian berhasil dibatalkan.' })
      },
    })
  }

  return (
    <>
      {/* Trigger button — TiketAntrianPage mengontrol kapan ini dirender */}
      <Button
        type="button"
        variant="outline"
        className="w-full min-h-[44px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        Batalkan Antrian
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Antrian?</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600">
            Nomor antrian Anda akan dilepas dan tidak bisa dikembalikan.
          </p>

          <DialogFooter className="flex flex-row gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Tidak, Kembali
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={mutation.isPending}
              onClick={handleBatalkan}
            >
              {mutation.isPending && (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              )}
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
