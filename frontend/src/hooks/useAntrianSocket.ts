/**
 * useAntrianSocket.ts — Socket.IO room join/leave + queue:update handler
 *
 * ATURAN PENTING (02-UI-SPEC.md Executor Notes #5):
 * - socket.connect() saat mount; socket.disconnect() saat UNMOUNT
 * - TIDAK meninggalkan room saat browser tab disembunyikan (tab hide)
 * - Hanya disconnect pada component unmount (dalam useEffect cleanup)
 *
 * Guard slotId + antrianId: jika kosong, effect adalah no-op (skip connect).
 * Ini memungkinkan TiketAntrianPage memanggil hook sebelum antrian data loaded.
 */
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '@/lib/socket'

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * QueueUpdate — payload event 'queue:update' dari Socket.IO server.
 * Sesuai CLAUDE.md §Socket.IO Events.
 */
export interface QueueUpdate {
  nomorAktif: number
  durasiRataAktual: number | null
  antrianList: Array<{ id: string; nomorUrut: number; statusAntrian: string }>
}

type SocketStatus = 'connecting' | 'connected' | 'disconnected'

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * useAntrianSocket — bergabung ke room Socket.IO sesi:{slotId} saat mount.
 *
 * @param slotId   - ID slot sesi; bisa string kosong saat antrian belum loaded
 * @param antrianId - ID antrian citizen
 * @returns queueState (data update terbaru dari server) + socketStatus
 */
export function useAntrianSocket(slotId: string, antrianId: string) {
  const queryClient = useQueryClient()
  const [queueState, setQueueState] = useState<QueueUpdate | null>(null)
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting')

  useEffect(() => {
    // Guard: jangan connect jika slotId belum tersedia (antrian data sedang loading)
    if (!slotId || !antrianId) return

    socket.connect()
    socket.emit('queue:join', { slotId, antrianId })

    socket.on('connect', () => {
      setSocketStatus('connected')
    })

    socket.on('disconnect', () => {
      setSocketStatus('disconnected')
    })

    socket.on('queue:update', (data: QueueUpdate) => {
      setQueueState(data)
      void queryClient.invalidateQueries({ queryKey: ['antrian', antrianId] })
    })

    socket.on('connect_error', (err: Error) => {
      setSocketStatus('disconnected')
      if (import.meta.env.DEV) {
        console.error('[useAntrianSocket] connect_error:', err.message)
      }
    })

    // Cleanup saat component unmount — BUKAN saat tab hide (02-UI-SPEC.md #5)
    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('queue:update')
      socket.off('connect_error')
      socket.disconnect()
    }
  }, [slotId, antrianId, queryClient])

  return { queueState, socketStatus }
}
