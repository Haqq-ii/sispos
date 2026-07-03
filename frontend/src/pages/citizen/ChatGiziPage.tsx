/**
 * ChatGiziPage — Halaman chatbot gizi citizen
 *
 * Fitur:
 * - Tanya jawab gizi balita via POST /api/ai/chat/gizi
 * - Rate limit 20 pesan/hari — UI menampilkan pesan jika 429
 * - Auto-scroll ke pesan terbaru
 * - Enter kirim, Shift+Enter newline
 * - Topik dibatasi: gizi balita, tumbuh kembang, imunisasi, posyandu
 *
 * Security:
 * - wargaId ditentukan server-side dari JWT (tidak dikirim dari client)
 * - Hanya citizen yang bisa akses (ProtectedRoute di router)
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

// ── Component ──────────────────────────────────────────────────────────────────

export default function ChatGiziPage() {
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mutation untuk kirim pesan ke /api/ai/chat/gizi
  const chatMutation = useMutation({
    mutationFn: (msg: string) =>
      apiClient
        .post('/ai/chat/gizi', { message: msg })
        .then((r) => r.data.data.reply as string),
    onSuccess: (reply, msg) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: msg },
        { role: 'assistant', content: reply },
      ])
      setInput('')
    },
    onError: (error) => {
      // Type cast pattern sesuai Axios interceptor di project (bukan axios.isAxiosError)
      const axiosErr = error as AxiosError<{ error: string }>
      if (axiosErr.response?.status === 429) {
        toast({
          description: 'Batas 20 pesan hari ini tercapai. Coba lagi besok.',
          variant: 'destructive',
        })
      } else {
        toast({
          description: 'Gagal mengirim pesan. Coba lagi.',
          variant: 'destructive',
        })
      }
    },
  })

  // Kirim pesan
  function handleSend(): void {
    if (!input.trim() || chatMutation.isPending) return
    chatMutation.mutate(input.trim())
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
              Asisten Gizi SISPOS
            </h1>
            <p className="text-xs text-gray-500 leading-tight">
              Topik: gizi balita, tumbuh kembang, imunisasi, posyandu
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Empty state */}
        {messages.length === 0 && !chatMutation.isPending && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🌿</div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Halo! Tanyakan pertanyaan seputar gizi balita Anda.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Saya bisa membantu tentang gizi, tumbuh kembang, imunisasi, dan posyandu.
            </p>
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
                  ? 'bg-green-600 text-white rounded-xl px-3 py-2 max-w-[80%] text-sm leading-relaxed'
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
      <div className="bg-white border-t px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tulis pertanyaan Anda..."
            disabled={chatMutation.isPending}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 min-h-[40px] max-h-[120px]"
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
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
            aria-label="Kirim pesan"
          >
            <SendHorizonal size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
