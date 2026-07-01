/**
 * useKaderSocket.ts — Socket.IO room join/leave + queue:update handler for kader.
 *
 * Analog of useAntrianSocket — same three mandatory rules:
 * 1. socket.connect() saat mount; socket.disconnect() saat UNMOUNT ONLY
 * 2. TIDAK disconnect saat browser tab disembunyikan
 * 3. Guard: if (!slotId) return — effect is no-op until data ready
 *
 * Kader joins the same room (sesi:{slotId}) as citizen.
 * On queue:update: invalidate ['antrian', 'kader', slotId] so all meja pages
 * refetch the antrian list without manual polling.
 */
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '@/lib/socket'
import type { QueueUpdate } from '@/hooks/useAntrianSocket'

type SocketStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * useKaderSocket — bergabung ke room Socket.IO sesi:{slotId} saat mount.
 *
 * @param slotId - ID slot sesi; bisa null saat slotId belum diketahui
 * @returns socketStatus — 'connecting' | 'connected' | 'disconnected'
 */
export function useKaderSocket(slotId: string | null) {
  const queryClient = useQueryClient()
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting')

  useEffect(() => {
    // Guard: jangan connect jika slotId belum tersedia
    if (!slotId) return

    socket.connect()
    // Kader join room yang sama dengan citizen — socket server broadcast ke room ini
    socket.emit('queue:join', { slotId })

    socket.on('connect', () => {
      setSocketStatus('connected')
    })

    socket.on('disconnect', () => {
      setSocketStatus('disconnected')
    })

    socket.on('queue:update', (_data: QueueUpdate) => {
      // Invalidate antrian list so meja pages automatically refetch
      void queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', slotId] })
    })

    socket.on('connect_error', (_err: Error) => {
      setSocketStatus('disconnected')
    })

    // Cleanup saat component unmount — BUKAN saat tab hide
    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('queue:update')
      socket.off('connect_error')
      socket.disconnect()
    }
  }, [slotId, queryClient])

  return { socketStatus }
}
