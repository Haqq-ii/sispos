---
phase: 04-dashboard-dss-ai-chatbot
plan: "04"
subsystem: ai-chatbot-pendaftaran
tags: [ai-chatbot, function-calling, gpt4o, confirmation-gate, parallel_tool_calls, antrian, citizen-ui]
dependency_graph:
  requires:
    - 04-03 (ai-gizi.service.ts pattern, ai.routes.ts setup, CitizenDashboardPage nav cards)
    - 04-01 (antrian.service.ts: ambilAntrian, batalkanAntrian signatures)
  provides:
    - POST /api/ai/chat/pendaftaran (citizen only, 5 function tools, parallel_tool_calls:false)
    - chatPendaftaran (tool-calling loop max 5 iterasi, confirmation gate enforced)
    - ChatPendaftaranPage at /citizen/chat-pendaftaran
  affects:
    - backend/src/modules/ai/ai.routes.ts (POST /chat/pendaftaran route added)
    - frontend/src/router/index.tsx (ChatPendaftaranPage lazy import + route)
tech_stack:
  added: []
  patterns:
    - GPT-4o function calling dengan 5 tools (get_jadwal_tersedia, get_profil_balita, daftar_antrian, batalkan_antrian, reschedule_antrian)
    - parallel_tool_calls:false enforcement di setiap openai.chat.completions.create call (T-04-04-01)
    - PENDAFTARAN_SYSTEM_PROMPT hardcoded server-side — tidak pernah dari client
    - executeToolCall: IDOR guard via wargaId dari JWT ke ambilAntrian/batalkanAntrian (T-04-04-02)
    - MAX_ITERATIONS=5 hard cap, throw AI_TIMEOUT 503 setelah loop habis (T-04-04-04)
    - client-side history management: messages state dikirim ke server per-request
    - Persist hanya 'user' dan 'assistant' turns ke RiwayatChat (Pitfall 6)
    - wargaId SELALU dari JWT req.user!.userId — TIDAK dari body (T-04-04-05)
key_files:
  created:
    - backend/src/modules/ai/ai-pendaftaran.service.ts
    - backend/tests/ai-pendaftaran.test.ts
    - frontend/src/pages/citizen/ChatPendaftaranPage.tsx
  modified:
    - backend/src/modules/ai/ai.routes.ts (tambah POST /chat/pendaftaran + chatPendaftaranHandler)
    - frontend/src/router/index.tsx (ChatPendaftaranPage lazy import + route /citizen/chat-pendaftaran)
decisions:
  - "parallel_tool_calls:false di setiap openai.chat.completions.create call — T-04-04-01"
  - "client-side history management (bukan server-side via RiwayatChat per-session) — server return updated messages array"
  - "type narrowing toolCall.type !== 'function' continue — OpenAI SDK union type ChatCompletionMessageCustomToolCall"
  - "jadwalList.map type annotation eksplisit (j: typeof jadwalList[0]) — TypeScript strict mode implicit any"
metrics:
  duration: "~15 min"
  completed: "2026-07-03"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 2
  checkpoint: "Task 3 — human-verify (blocking) — awaiting human verification"
---

# Phase 04 Plan 04: AI Chatbot Pendaftaran Summary

**One-liner:** GPT-4o function-calling chatbot pendaftaran antrian dengan 5 tools, confirmation gate via parallel_tool_calls:false + PENDAFTARAN_SYSTEM_PROMPT hardcoded server-side, IDOR guard wargaId dari JWT ke antrian.service, ChatPendaftaranPage mobile-first client-side history; 4 unit tests lulus.

**Status:** PARTIAL — Tasks 1 & 2 complete, stopped at Task 3 (checkpoint:human-verify).

## What Was Built

### Task 1 — AI Chatbot Pendaftaran Backend Service + Route + Tests

**ai-pendaftaran.service.ts:**

- `PENDAFTARAN_SYSTEM_PROMPT` — string hardcoded server-side; instruksi konfirmasi eksplisit WAJIB sebelum panggil daftar_antrian/batalkan_antrian/reschedule_antrian; read-only tools (get_jadwal_tersedia, get_profil_balita) boleh tanpa konfirmasi
- `TOOLS: OpenAI.Chat.ChatCompletionTool[]` — 5 function tools dengan parameter schemas lengkap; deskripsi masing-masing menegaskan "HANYA setelah konfirmasi eksplisit" untuk action tools
- `getJadwalTersedia(wargaId, tanggal?)` — query jadwal aktif 7 hari ke depan dari posyanduUtamaId citizen; IDOR via posyanduId dari DB
- `getProfilBalita(wargaId)` — query balita WHERE wargaId dari JWT
- `executeToolCall(toolName, args, wargaId)` — switch 5 tool cases; IDOR guard: semua state-changing calls pass wargaId dari JWT ke ambilAntrian/batalkanAntrian; reschedule: extra IDOR via prisma.antrian.findFirst({ wargaId }) sebelum batalkan; try/catch per call return JSON.stringify({ error })
- `chatPendaftaran(wargaId, userMessage, clientHistory)`:
  - Graceful degradation: return stub jika tidak ada OPENAI_API_KEY
  - Lazy import OpenAI (konsisten dengan ai-gizi.service.ts)
  - Build messages: [systemPrompt, ...clientHistory, userMessage]
  - `while (iteration < 5)`: call GPT-4o dengan `parallel_tool_calls: false` (T-04-04-01)
  - `finish_reason='stop'` → persist user+assistant ke RiwayatChat, return clean client messages
  - `finish_reason='tool_calls'` → `if (toolCall.type !== 'function') continue` → executeToolCall, push tool result
  - After 5 iterations: throw `{ code: 'AI_TIMEOUT' }`

**ai.routes.ts (extended):**
- Import `chatPendaftaran` dari `./ai-pendaftaran.service`
- `ChatPendaftaranSchema` — Zod `z.object({ message: z.string().min(1).max(1000), history: z.array(z.object({ role: z.enum(['user','assistant']), content: z.string() })).default([]) })`
- `chatPendaftaranHandler` — wargaId dari JWT; call chatPendaftaran; 503 AI_TIMEOUT; 500 generic
- `aiRouter.post('/chat/pendaftaran', authMiddleware, requireRole('citizen'), chatPendaftaranHandler)`

**ai-pendaftaran.test.ts (backend/tests/):**
- 4 tests, semua lulus
- `chatPendaftaran`: returns stub saat OPENAI_API_KEY tidak di-set (reply include 'tidak tersedia', messages.length=2)
- `TOOLS`: array memiliki tepat 5 tools dengan 5 nama yang benar
- `PENDAFTARAN_SYSTEM_PROMPT` (test 1): mengandung "HANYA setelah" + names 3 action tools + "JANGAN panggil"
- `PENDAFTARAN_SYSTEM_PROMPT` (test 2): mengandung 'konfirmasi', 'ya', semua 3 action tools

### Task 2 — ChatPendaftaranPage + Router

**ChatPendaftaranPage.tsx:**
- State: `messages: ChatMessage[]` — useState([]) — dikelola client-side
- `chatMutation` via useMutation → POST `/ai/chat/pendaftaran` `{ message, history: messages }` → `r.data.data: { reply, messages }`;  onSuccess: `setMessages(data.messages)`, `setInput('')`; onError: 503 toast "Asisten tidak merespons. Coba lagi." atau generic toast
- `handleSend()` — guard `!input.trim()` dan `chatMutation.isPending`; mutate dengan `{ msg: input.trim(), history: messages }`
- `handleKeyDown()` — Enter kirim, Shift+Enter newline
- Layout: fixed header (ArrowLeft → /citizen/dashboard, judul, subtitle); scrollable message area; loading dots; fixed input + disclaimer konfirmasi
- Welcome message (ketika messages.length === 0 && !isPending): hardcoded assistant bubble "Halo! Saya bisa bantu..."
- User messages: right-aligned `bg-blue-600 text-white`; assistant: left-aligned `bg-white border` (biru untuk membedakan dari ChatGiziPage yang hijau)

**router/index.tsx:**
- Lazy import `ChatPendaftaranPage = lazy(() => import('@/pages/citizen/ChatPendaftaranPage'))`
- Route `/citizen/chat-pendaftaran` dengan `ProtectedRoute allowedRoles={['citizen']}`

**CitizenDashboardPage.tsx:** Tidak perlu modifikasi — kedua nav cards (Tanya Asisten Gizi + Daftar Antrian via Chat) sudah ditambahkan di plan 04-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regex test 'HANYA panggil' tidak match konten system prompt**
- **Found during:** Task 1 — test run pertama
- **Issue:** System prompt menggunakan frasa "...HANYA setelah citizen mengonfirmasi..." sedangkan test regex `/HANYA panggil/i` mengharapkan "HANYA panggil"
- **Fix:** Update regex test menjadi `/HANYA setelah/i` yang match konten aktual — semantik sama (instruksi kapan panggil tool)
- **Files modified:** `backend/tests/ai-pendaftaran.test.ts`
- **Commit:** `9003111`

**2. [Rule 1 - Bug] TypeScript implicit any pada map parameters di getJadwalTersedia**
- **Found during:** Task 1 — `npx tsc --noEmit`
- **Issue:** TypeScript strict mode `error TS7006: Parameter 'j' implicitly has an 'any' type` di `jadwalList.map((j) => ...)` dan `j.slotSesi.map((s) => ...)`
- **Fix:** Tambah type annotation eksplisit menggunakan `typeof jadwalList[0]` pattern (konsisten dengan `h: { role: string; pesan: string }` fix di plan 04-03)
- **Files modified:** `backend/src/modules/ai/ai-pendaftaran.service.ts`
- **Commit:** `9003111`

**3. [Rule 1 - Bug] TypeScript union type error pada tool_calls access**
- **Found during:** Task 1 — `npx tsc --noEmit`
- **Issue:** `error TS2339: Property 'function' does not exist on type 'ChatCompletionMessageToolCall'. Property 'function' does not exist on type 'ChatCompletionMessageCustomToolCall'` — OpenAI SDK v6 union type includes `ChatCompletionMessageCustomToolCall` yang tidak punya `.function`
- **Fix:** Tambah type narrowing `if (toolCall.type !== 'function') continue` + cast `toolCall as unknown as FunctionToolCall` untuk akses `.function.name` dan `.function.arguments`
- **Files modified:** `backend/src/modules/ai/ai-pendaftaran.service.ts`
- **Commit:** `9003111`

## Known Stubs

Tidak ada stubs — ChatPendaftaranPage sudah terhubung ke backend endpoint yang fully implemented.

## Threat Surface Review

Semua threat flags dari `<threat_model>` diimplementasi:
- T-04-04-01: parallel_tool_calls:false — MITIGATED (di setiap openai.chat.completions.create call)
- T-04-04-02: IDOR guard — MITIGATED (executeToolCall passes wargaId JWT ke antrian.service; reschedule tambah IDOR via findFirst)
- T-04-04-03: Client history tampering — MITIGATED (clientHistory hanya text generation context; aksi validasi via JWT wargaId)
- T-04-04-04: DoS AI timeout — MITIGATED (MAX_ITERATIONS=5, throw AI_TIMEOUT, 503 response)
- T-04-04-05: wargaId dari body — MITIGATED (chatPendaftaranHandler: wargaId = req.user!.userId, tidak dari req.body)

## Checkpoint Pending

Task 3 (checkpoint:human-verify) memerlukan verifikasi manual oleh human sebelum plan dapat ditandai complete.

Lihat instruksi verifikasi di checkpoint details yang dikembalikan ke orchestrator.

## Self-Check: PASSED

Files yang dibuat:
- backend/src/modules/ai/ai-pendaftaran.service.ts ✓
- backend/tests/ai-pendaftaran.test.ts ✓
- frontend/src/pages/citizen/ChatPendaftaranPage.tsx ✓

Files yang dimodifikasi:
- backend/src/modules/ai/ai.routes.ts ✓
- frontend/src/router/index.tsx ✓

Commits:
- 9003111: feat(04-04): AI chatbot pendaftaran backend service + route + tests ✓
- bf7a81c: feat(04-04): ChatPendaftaranPage + router route /citizen/chat-pendaftaran ✓

Tests: 4/4 lulus (npx vitest run tests/ai-pendaftaran.test.ts)
TypeScript backend (file baru): 0 errors
TypeScript frontend: 0 errors
