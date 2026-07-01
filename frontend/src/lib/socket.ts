/**
 * Socket.IO client singleton — QUEUE-04
 *
 * ATURAN PENTING (autoConnect: false):
 * Socket TIDAK boleh auto-connect saat modul diload.
 * Koneksi hanya dimulai saat TiketAntrianPage mount via socket.connect()
 * di dalam hook useAntrianSocket. Ini mencegah room join gagal karena
 * antrianId belum tersedia sebelum user berada di halaman tiket.
 *
 * Penggunaan:
 *   import { socket } from '@/lib/socket'
 *   socket.connect()                          // saat mount
 *   socket.emit('queue:join', { slotId, antrianId })
 *   socket.disconnect()                       // saat unmount
 */
import { io } from 'socket.io-client'

export const socket = io({
  path: '/socket.io',
  withCredentials: true,
  autoConnect: false,
})
