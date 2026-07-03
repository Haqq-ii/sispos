/**
 * ai-pendaftaran.test.ts — Unit tests untuk AI Chatbot Pendaftaran service
 *
 * Tests:
 * 1. chatPendaftaran: returns stub saat OPENAI_API_KEY tidak di-set
 * 2. TOOLS: array memiliki tepat 5 tools dengan nama yang benar
 * 3. TOOLS / system prompt: PENDAFTARAN_SYSTEM_PROMPT mencakup konfirmasi gate requirement
 * 4. PENDAFTARAN_SYSTEM_PROMPT: mengandung syarat konfirmasi eksplisit + nama-nama tools aksi
 *
 * Critical security property (T-04-04-01):
 *   parallel_tool_calls:false diterapkan di dalam chatPendaftaran function body.
 *   Test ini memvalidasi system prompt yang berisi instruksi konfirmasi wajib sebagai
 *   lapisan kedua dari enforcement (protocol layer: parallel_tool_calls:false adalah lapisan pertama).
 *
 * Path mocks: '../src/' (satu level naik ke backend/, lalu masuk src/)
 * Pola sama dengan ai-gizi.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../src/config/db', () => ({
  prisma: {
    warga: { findUnique: vi.fn() },
    balita: { findMany: vi.fn() },
    jadwal: { findMany: vi.fn() },
    antrian: { findFirst: vi.fn() },
    riwayatChat: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  },
}))

vi.mock('../src/config/env', () => ({
  env: { NODE_ENV: 'test' },
}))

vi.mock('../src/modules/antrian/antrian.service', () => ({
  ambilAntrian: vi.fn(),
  batalkanAntrian: vi.fn(),
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import {
  chatPendaftaran,
  TOOLS,
  PENDAFTARAN_SYSTEM_PROMPT,
} from '../src/modules/ai/ai-pendaftaran.service'

// ── Tests: chatPendaftaran ────────────────────────────────────────────────────

describe('chatPendaftaran', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns stub message when OPENAI_API_KEY is not set', async () => {
    // Temporarily remove API key
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    try {
      const result = await chatPendaftaran('w-1', 'test pesan', [])
      // Should return graceful degradation stub
      expect(result.reply).toContain('tidak tersedia')
      // messages array harus menyertakan pesan user + stub reply
      expect(result.messages).toHaveLength(2)
      expect(result.messages[0]).toMatchObject({ role: 'user', content: 'test pesan' })
      expect(result.messages[1]).toMatchObject({ role: 'assistant' })
    } finally {
      // Restore env
      if (originalKey !== undefined) {
        process.env.OPENAI_API_KEY = originalKey
      }
    }
  })

  it('TOOLS array has exactly 5 tools with correct names', () => {
    expect(TOOLS).toHaveLength(5)

    const toolNames = TOOLS.map((t) => t.function.name)
    expect(toolNames).toContain('get_jadwal_tersedia')
    expect(toolNames).toContain('get_profil_balita')
    expect(toolNames).toContain('daftar_antrian')
    expect(toolNames).toContain('batalkan_antrian')
    expect(toolNames).toContain('reschedule_antrian')
  })

  it('PENDAFTARAN_SYSTEM_PROMPT enforces confirmation gate (parallel_tool_calls:false layer 2)', () => {
    // parallel_tool_calls:false adalah lapisan 1 (protocol enforcement).
    // System prompt adalah lapisan 2 (instruction enforcement).
    // Validasi bahwa system prompt memerintahkan AI untuk meminta konfirmasi sebelum aksi.
    expect(PENDAFTARAN_SYSTEM_PROMPT).toMatch(/HANYA setelah/i)
    expect(PENDAFTARAN_SYSTEM_PROMPT).toContain('daftar_antrian')
    expect(PENDAFTARAN_SYSTEM_PROMPT).toContain('batalkan_antrian')
    expect(PENDAFTARAN_SYSTEM_PROMPT).toContain('reschedule_antrian')
  })
})

// ── Tests: PENDAFTARAN_SYSTEM_PROMPT ─────────────────────────────────────────

describe('PENDAFTARAN_SYSTEM_PROMPT', () => {
  it('contains explicit confirmation requirement with confirmation keywords', () => {
    // Harus menyebut kata konfirmasi
    expect(PENDAFTARAN_SYSTEM_PROMPT).toMatch(/konfirmasi/i)
    // Harus menyebut kata 'ya' atau 'setuju' sebagai contoh kata konfirmasi
    expect(PENDAFTARAN_SYSTEM_PROMPT).toMatch(/ya|setuju/)
    // Harus menyebut semua 3 tools yang memerlukan konfirmasi
    expect(PENDAFTARAN_SYSTEM_PROMPT).toContain('daftar_antrian')
    expect(PENDAFTARAN_SYSTEM_PROMPT).toContain('batalkan_antrian')
    expect(PENDAFTARAN_SYSTEM_PROMPT).toContain('reschedule_antrian')
    // Harus memberikan instruksi yang jelas tentang kapan TIDAK boleh panggil tool
    expect(PENDAFTARAN_SYSTEM_PROMPT).toMatch(/JANGAN panggil/i)
  })
})
