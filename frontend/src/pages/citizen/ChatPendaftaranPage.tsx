/**
 * ChatPendaftaranPage — Halaman chatbot pendaftaran antrian citizen
 *
 * Fitur:
 * - Daftar, batalkan, atau reschedule antrian via natural language conversation
 * - POST /api/ai/chat/pendaftaran dengan full history per request
 * - AI menampilkan ringkasan dan meminta konfirmasi sebelum aksi (server-side enforcement)
 * - 503 toast saat AI timeout (MAX_ITERATIONS exceeded)
 * - Auto-scroll ke pesan terbaru
 * - Enter kirim, Shift+Enter newline
 *
 * Perbedaan utama dari ChatGiziPage:
 * - History dikelola client-side (messages state) dan dikirim ke server setiap request
 *   → Server tidak menyimpan history per session; DB hanya untuk audit (user+assistant turns)
 * - API endpoint: /ai/chat/pendaftaran (bukan /ai/chat/gizi)
 * - Response: { reply, messages } — server mengembalikan updated messages array
 *
 * Security:
 * - wargaId ditentukan server-side dari JWT (tidak dikirim dari client)
 * - Hanya citizen yang bisa akses (ProtectedRoute di router)
 * - clientHistory dikirim ke server sebagai conversation context; server TIDAK percaya
 *   clientHistory untuk wargaId (T-04-04-03)
 */
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, SendHorizonal } from 'lucide-react'
import type { AxiosError } from 'axios'

import { useToast } from '@/hooks/use-toast'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPendaftaranResponse {
  reply: string
  messages: ChatMessage[]
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ChatPendaftaranPage() {
  const { toast } = useToast()
  // History dikelola client-side dan dikirim ke server setiap request
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mutation: kirim pesan + history ke /api/ai/chat/pendaftaran
  const chatMutation = useMutation({
    mutationFn: ({
      msg,
      history,
    }: {
      msg: string
      history: ChatMessage[]
    }) =>
      apiClient
        .post('/ai/chat/pendaftaran', { message: msg, history })
        .then((r) => r.data.data as ChatPendaftaranResponse),
    onSuccess: (data) => {
      // Server mengembalikan updated messages array (clean — tanpa system/tool messages)
      setMessages(data.messages)
      setInput('')
    },
    onError: (error) => {
      const axiosErr = error as AxiosError<{ error: string }>
      if (axiosErr.response?.status === 503) {
        toast({
          description: 'Asisten tidak merespons. Coba lagi.',
          variant: 'destructive',
        })
      } else {
        toast({
          description: 'Gagal mengirim pesan.',
          variant: 'destructive',
        })
      }
    },
  })

  // Kirim pesan dengan history current
  function handleSend(): void {
    if (!input.trim() || chatMutation.isPending) return
    chatMutation.mutate({ msg: input.trim(), history: messages })
  }

  // Enter kirim, Shift+Enter newline
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-[430px] mx-auto">
      {/* Fixed header */}
      <div className="bg-white border-b px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/citizen/dashboard"
            className="text-gray-600 hover:text-gray-900 p-1 -ml-1 rounded"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              Asisten Pendaftaran SISPOS
            </h1>
            <p className="text-xs text-gray-500 leading-tight">
              Saya bisa bantu daftar, batalkan, atau reschedule antrian Anda
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Welcome message — tampil saat belum ada messages */}
        {messages.length === 0 && !chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-gray-800 rounded-xl px-3 py-2 max-w-[80%] text-sm leading-relaxed shadow-sm">
              Halo! Saya bisa bantu Anda mendaftar, membatalkan, atau menjadwal ulang antrian
              posyandu. Apa yang ingin Anda lakukan?
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-xl px-3 py-2 max-w-[80%] text-sm leading-relaxed'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-xl px-3 py-2 max-w-[80%] text-sm leading-relaxed shadow-sm'
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator saat menunggu respons AI */}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <div className="flex items-center gap-1">
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed input area at bottom */}
      <div className="bg-white border-t px-4 pt-3 pb-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tulis pesan Anda..."
            disabled={chatMutation.isPending}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 min-h-[40px] max-h-[120px]"
            style={{ overflow: 'hidden' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            aria-label="Kirim pesan"
          >
            <SendHorizonal size={18} />
          </button>
        </div>

        {/* Disclaimer konfirmasi */}
        <p className="text-xs italic text-gray-400 mt-2 text-center leading-snug">
          Asisten akan menampilkan ringkasan dan meminta konfirmasi sebelum mendaftarkan atau
          membatalkan antrian Anda.
        </p>
      </div>
    </div>
  )
}
