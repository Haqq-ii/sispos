/**
 * TukarMejaModal — Fullscreen PIN verification overlay untuk tukar meja.
 *
 * Figma: nodeId 2001:6485 (Verifikasi Tukar Meja mobile)
 *
 * PENTING: Ini adalah fixed inset-0 fullscreen overlay, BUKAN shadcn Dialog.
 * - Tidak ada backdrop click dismiss
 * - Tidak ada Escape handler
 * - Maksimum 3 percobaan PIN salah → locked
 * - Setelah 3x gagal: tampilkan pesan "Hubungi Puskesmas untuk Master Overrule"
 * - Sukses: navigate ke /kader/pelayanan dengan slotId di router state
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import apiClient from '@/lib/axios'
import { useToast } from '@/hooks/use-toast'

export interface TukarMejaModalProps {
  open: boolean
  onClose: () => void
  slotId: string
}

export function TukarMejaModal({ open, onClose, slotId }: TukarMejaModalProps) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isLocked = attempts >= 3

  if (!open) return null

  async function handleSubmit() {
    if (pin.length !== 6) return
    setIsSubmitting(true)
    try {
      const res = await apiClient.post('/kader/verify-ketua-pin', { pin })
      if (res.data.data?.verified) {
        setPin('')
        navigate('/kader/pelayanan', { state: { slotId } })
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      if (e.response?.data?.error === 'KETUA_PIN_SALAH') {
        setAttempts((p) => p + 1)
        setPin('')
      } else {
        toast({ description: 'Terjadi kesalahan, coba lagi', variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-12 pb-6">
        <p className="text-white font-bold text-xl">Verifikasi Ketua Kader</p>
        <p className="text-[#7bf1a8] text-xs mt-1">
          Masukkan PIN 6 digit Ketua Kader untuk melanjutkan
        </p>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-6 flex flex-col gap-6">

        {/* Attempt counter — ditampilkan setelah percobaan gagal pertama */}
        {attempts > 0 && !isLocked && (
          <p className="text-[#e7000b] text-sm text-center font-medium">
            Percobaan ke-{attempts}/3 — PIN salah
          </p>
        )}

        {/* Lockout state */}
        {isLocked && (
          <div className="bg-[#fef2f2] border border-[#ffc9c9] rounded-2xl p-4 text-center">
            <p className="text-[#e7000b] text-sm font-semibold">Akses dikunci.</p>
            <p className="text-[#99a1af] text-xs mt-1">
              Hubungi Puskesmas untuk Master Overrule.
            </p>
          </div>
        )}

        {/* PIN input — hanya tampil jika belum terkunci */}
        {!isLocked && (
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={isSubmitting}
            className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#008236]"
            placeholder="••••••"
          />
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-8 space-y-2">

        {/* Submit button — hanya tampil jika belum terkunci */}
        {!isLocked && (
          <button
            disabled={isSubmitting || pin.length < 6}
            onClick={handleSubmit}
            className="w-full bg-[#008236] text-white font-bold py-3.5 rounded-[14px] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Verifikasi PIN
          </button>
        )}

        {/* Batal — selalu tampil */}
        <button
          onClick={onClose}
          className="w-full bg-[#f9fafb] border border-[#e5e7eb] text-[#364153] font-semibold py-3.5 rounded-[14px]"
        >
          Batal
        </button>
      </div>
    </div>
  )
}
