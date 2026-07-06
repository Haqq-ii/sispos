/**
 * ChatGiziPage — Halaman chatbot gizi citizen
 *
 * Fitur:
 * - Tanya jawab gizi balita via POST /api/ai/chat/gizi
 * - Rate limit 20 pesan/hari — UI menampilkan pesan jika 429
 * - Auto-scroll ke pesan terbaru
 * - Enter kirim, Shift+Enter newline
 * - Topik dibatasi: gizi balita, tumbuh kembang, imunisasi, posyandu
 * - Quick questions saat welcome state
 *
 * Security:
 * - wargaId ditentukan server-side dari JWT (tidak dikirim dari client)
 * - Hanya citizen yang bisa akses (ProtectedRoute di router)
 *
 * Layout: dirender di dalam CitizenLayout — mengisi sisa ruang dengan flex-1 min-h-0
 */
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, SendHorizonal, Bot, Sparkles, ChevronRight } from 'lucide-react'
import type { AxiosError } from 'axios'

import { useToast } from '@/hooks/use-toast'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Quick question list ────────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  'Apa itu stunting dan bagaimana mencegahnya?',
  'Makanan apa yang baik untuk bayi 6 bulan?',
  'Kenapa timbangan anak tidak naik bulan ini?',
  'Kapan jadwal imunisasi berikutnya?',
  'Apa gejala kekurangan gizi pada balita?',
]

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
        .post('/ai/chat/gizi', { message: msg }, { timeout: 60_000 })
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

  const canSend = input.trim().length > 0 && !chatMutation.isPending

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    // flex-1 min-h-0: fills available height provided by CitizenLayout's content area
    <div className="flex flex-col flex-1 min-h-0 bg-[#f9fafb]">
      {/* ── Green header ─────────────────────────────────────────────────── */}
      <div className="bg-[#008236] px-4 pt-10 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/citizen/dashboard"
            className="bg-[rgba(0,166,62,0.5)] rounded-[14px] p-2 md:hidden"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft size={20} className="text-white" />
          </Link>
          <div className="bg-[rgba(255,255,255,0.15)] rounded-[14px] w-10 h-10 flex items-center justify-center flex-shrink-0">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">AI Asisten Gizi</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#7bf1a8]" />
              <p className="text-[#b9f8cf] text-xs">Online · Selalu siap membantu</p>
            </div>
          </div>
          <div className="ml-auto">
            <Sparkles size={20} className="text-white/60" />
          </div>
        </div>
      </div>

      {/* ── Warning banner ────────────────────────────────────────────────── */}
      <div className="bg-[#fffbeb] border-b border-[#fef3c6] px-4 py-2 flex-shrink-0">
        <p className="text-[#bb4d00] text-xs text-center">
          AI ini bersifat edukatif. Untuk kondisi darurat, segera hubungi tenaga kesehatan.
        </p>
      </div>

      {/* ── Scrollable message area ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Welcome state with quick questions */}
          {messages.length === 0 && !chatMutation.isPending && (
            <div className="space-y-4">
              {/* AI greeting bubble */}
              <div className="flex gap-2.5">
                <div className="bg-[#008236] rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div>
                  <div className="bg-white border border-[#f3f4f6] shadow-sm rounded-tl-md rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3">
                    <p className="text-[#364153] text-sm leading-relaxed">
                      Halo! Saya AI Asisten Gizi SISPOS 🌱 Saya siap membantu Anda dengan
                      pertanyaan seputar tumbuh kembang, gizi, dan kesehatan balita. Apa yang
                      ingin Anda tanyakan?
                    </p>
                  </div>
                  <p className="text-[#99a1af] text-xs px-1 mt-1">Sekarang</p>
                </div>
              </div>

              {/* Quick questions */}
              <div>
                <p className="text-[#6a7282] text-xs font-medium mb-2">Pertanyaan umum:</p>
                <div className="space-y-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="w-full bg-white border border-[#e5e7eb] rounded-[14px] px-3 py-2.5 flex items-center justify-between text-left hover:border-[#008236] transition-colors"
                    >
                      <span className="text-[#364153] text-sm font-medium">{q}</span>
                      <ChevronRight size={14} className="text-[#99a1af] flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Bot avatar for assistant */}
              {msg.role === 'assistant' && (
                <div className="bg-[#008236] rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div
                className={
                  msg.role === 'user'
                    ? 'bg-[#008236] text-white rounded-tl-2xl rounded-tr-md rounded-br-2xl rounded-bl-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed'
                    : 'bg-white border border-[#f3f4f6] text-[#364153] rounded-tl-md rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed shadow-sm'
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator saat menunggu respons AI */}
          {chatMutation.isPending && (
            <div className="flex gap-2.5 justify-start">
              <div className="bg-[#008236] rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-white border border-[#f3f4f6] rounded-tl-md rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 bg-[#008236] rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-[#008236] rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-[#008236] rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area at bottom ──────────────────────────────────────────── */}
      <div className="bg-white border-t border-[#f3f4f6] px-4 pt-2 pb-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <div className="flex-1 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] px-4 py-2.5 flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanyakan seputar gizi dan tumbuh kembang..."
              disabled={chatMutation.isPending}
              className="flex-1 bg-transparent resize-none text-sm focus:outline-none min-h-[22px] max-h-[88px] text-[#364153] placeholder:text-[rgba(10,10,10,0.5)] disabled:opacity-50"
              style={{ overflow: 'hidden' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 88) + 'px'
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-colors ${
              canSend ? 'bg-[#008236]' : 'bg-[#e5e7eb]'
            }`}
            aria-label="Kirim pesan"
          >
            <SendHorizonal size={16} className={canSend ? 'text-white' : 'text-[#99a1af]'} />
          </button>
        </div>
      </div>
    </div>
  )
}
