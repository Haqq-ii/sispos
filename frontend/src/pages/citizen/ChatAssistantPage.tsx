/**
 * ChatAssistantPage — AI Assistant citizen (Figma Make AIAssistantPage).
 *
 * Menggabungkan konsultasi gizi + pendaftaran antrian via natural language.
 * History dikelola client-side (dikirim ke server tiap request).
 * whitespace-pre-wrap pada bubble asisten agar bullet points render benar.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, SendHorizonal, Bot, Sparkles, ChevronRight, User } from 'lucide-react'
import type { AxiosError } from 'axios'

import { useToast } from '@/hooks/use-toast'
import apiClient from '@/lib/axios'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatAssistantResponse {
  reply: string
  messages: ChatMessage[]
}

// ── Quick suggestions ──────────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  'Apa itu stunting dan bagaimana mencegahnya?',
  'Makanan apa yang baik untuk bayi 6 bulan?',
  'Cek jadwal posyandu minggu ini',
  'Mau daftar antrian posyandu besok',
  'Kapan jadwal imunisasi berikutnya?',
]

function formatTime(): string {
  const now = new Date()
  return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ChatAssistantPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: ({ msg, history }: { msg: string; history: ChatMessage[] }) =>
      apiClient
        .post('/ai/chat/assistant', { message: msg, history }, { timeout: 120_000 })
        .then((r) => r.data.data as ChatAssistantResponse),
    onSuccess: (data) => {
      setMessages(data.messages)
      setInput('')
    },
    onError: (error) => {
      const axiosErr = error as AxiosError<{ error: string }>
      if (axiosErr.response?.status === 429) {
        toast({ description: 'Batas 20 pesan hari ini tercapai. Coba lagi besok.', variant: 'destructive' })
      } else if (axiosErr.response?.status === 503) {
        toast({ description: 'Asisten tidak merespons. Coba lagi.', variant: 'destructive' })
      } else {
        toast({ description: 'Gagal mengirim pesan. Coba lagi.', variant: 'destructive' })
      }
    },
  })

  function handleSend(): void {
    if (!input.trim() || chatMutation.isPending) return
    chatMutation.mutate({ msg: input.trim(), history: messages })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = input.trim().length > 0 && !chatMutation.isPending

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-green-700 px-4 pt-10 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/citizen/dashboard')}
            className="bg-green-600/50 rounded-xl p-2 md:hidden"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bot size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">AI Asisten Gizi</p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              <p className="text-green-200 text-xs">Online · Selalu siap membantu</p>
            </div>
          </div>
          <Sparkles size={20} className="text-white/60 flex-shrink-0" />
        </div>
      </div>

      {/* ── Disclaimer bar ─────────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
        <p className="text-amber-700 text-xs text-center">
          AI ini bersifat edukatif. Untuk kondisi darurat, segera hubungi tenaga kesehatan.
        </p>
      </div>

      {/* ── Scrollable message area ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Welcome state + quick suggestions */}
          {messages.length === 0 && !chatMutation.isPending && (
            <div className="space-y-4">
              {/* Welcome bubble */}
              <div className="flex gap-2.5">
                <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div>
                  <div className="bg-white text-gray-700 border border-gray-100 shadow-sm rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3 max-w-xs">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {'Halo! Saya AI Asisten Gizi SISPOS.\n\nSaya bisa membantu:\n• Pertanyaan gizi, tumbuh kembang, imunisasi\n• Daftar, batalkan, atau reschedule antrian posyandu\n\nApa yang ingin Anda tanyakan?'}
                    </p>
                  </div>
                  <p className="text-gray-400 text-xs px-1 mt-1">Sekarang</p>
                </div>
              </div>

              {/* Quick suggestion chips */}
              <div>
                <p className="text-gray-500 text-xs font-medium mb-2">Coba tanyakan:</p>
                <div className="space-y-2">
                  {QUICK_SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q)
                        chatMutation.mutate({ msg: q, history: messages })
                      }}
                      className="w-full text-left px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm flex items-center justify-between gap-2 hover:border-green-300 hover:bg-green-50 transition-colors"
                    >
                      <span className="text-gray-700">{q}</span>
                      <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
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
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  msg.role === 'user' ? 'bg-green-600' : 'bg-green-700'
                }`}
              >
                {msg.role === 'user' ? (
                  <User size={16} className="text-white" />
                ) : (
                  <Bot size={16} className="text-white" />
                )}
              </div>
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white rounded-tr-sm'
                    : 'bg-white text-gray-700 border border-gray-100 shadow-sm rounded-tl-sm whitespace-pre-wrap'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {chatMutation.isPending && (
            <div className="flex gap-2.5 flex-row">
              <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-tl-sm rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-2 h-2 bg-green-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Show time after last message */}
          {messages.length > 0 && !chatMutation.isPending && (
            <p className="text-gray-400 text-xs text-center">{formatTime()}</p>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div className="px-4 pb-20 pt-2 bg-white border-t border-gray-100 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya gizi atau minta daftarkan antrian..."
              disabled={chatMutation.isPending}
              className="flex-1 bg-transparent resize-none text-sm focus:outline-none min-h-[22px] max-h-[88px] text-gray-700 placeholder:text-gray-400 disabled:opacity-50"
              style={{ overflow: 'hidden' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 88) + 'px'
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
              canSend ? 'bg-green-700' : 'bg-gray-200'
            }`}
            aria-label="Kirim pesan"
          >
            <SendHorizonal size={16} className={canSend ? 'text-white' : 'text-gray-400'} />
          </button>
        </div>
      </div>
    </div>
  )
}
