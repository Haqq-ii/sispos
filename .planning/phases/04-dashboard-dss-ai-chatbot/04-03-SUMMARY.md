---
phase: 04-dashboard-dss-ai-chatbot
plan: "03"
subsystem: ai-chatbot-gizi
tags: [ai-chatbot, redis-rate-limit, gpt4o, guardrail, riwayat-chat, vitest, citizen-ui]
dependency_graph:
  requires:
    - 04-02 (users backend + app.ts setup — aiRouter sudah terdaftar di app.ts sejak 03-06)
  provides:
    - POST /api/ai/chat/gizi (citizen only, 20 msg/day rate limit, GPT-4o guardrail)
    - checkAndIncrementRateLimit (Redis INCR+EXPIREAT, WIB timezone)
    - ChatGiziPage at /citizen/chat-gizi
    - CitizenDashboardPage nav cards Layanan Digital
  affects:
    - backend/src/modules/ai/ai.routes.ts (POST /chat/gizi route added)
    - frontend/src/pages/citizen/CitizenDashboardPage.tsx (Layanan Digital section)
    - frontend/src/router/index.tsx (ChatGiziPage lazy import + route)
tech_stack:
  added: []
  patterns:
    - Redis INCR+EXPIREAT atomic rate limiting (WIB timezone, key = chatbot:gizi:citizen:{wargaId}:{date})
    - GPT-4o lazy import dengan graceful degradation saat OPENAI_API_KEY absent
    - System prompt hardcoded server-side (tidak dari client) — T-04-03-03
    - wargaId dari JWT req.user!.userId — tidak pernah dari body — T-04-03-01
    - RiwayatChat history (last 10, reversed) sebagai context GPT-4o
    - Persist hanya 'user' dan 'assistant' turns (Pitfall 6 — tidak simpan tool_call)
    - useMutation untuk POST /ai/chat/gizi dengan 429 toast handling
    - Auto-scroll via useRef + useEffect pada messages array
key_files:
  created:
    - backend/src/modules/ai/ai-gizi.service.ts
    - backend/tests/ai-gizi.test.ts
    - frontend/src/pages/citizen/ChatGiziPage.tsx
  modified:
    - backend/src/modules/ai/ai.routes.ts (tambah POST /chat/gizi + chatGiziHandler)
    - frontend/src/pages/citizen/CitizenDashboardPage.tsx (tambah Layanan Digital section)
    - frontend/src/router/index.tsx (ChatGiziPage lazy import + route /citizen/chat-gizi)
decisions:
  - "WIB timezone rate limit key: new Date(Date.now() + 7*60*60*1000) bukan new Date() (Pitfall 5)"
  - "EXPIREAT ke 17:00 UTC = 00:00 WIB hari berikutnya — bukan midnight UTC"
  - "Test mock paths menggunakan ../src/ (bukan ../../src/) — sama dengan pola fix di 04-02"
  - "Type annotation eksplisit untuk parameter h di history.map() — strict mode TS"
  - "ChatGiziPage: textarea auto-resize via onInput handler (tidak butuh library baru)"
  - "CitizenDashboardPage: Layanan Digital section hanya tampil saat !isLoading (tidak flash)"
metrics:
  duration: "~20 min"
  completed: "2026-07-03"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 04 Plan 03: AI Chatbot Gizi Summary

**One-liner:** GPT-4o chatbot gizi citizen dengan Redis INCR rate limit 20/hari (WIB timezone), GIZI_SYSTEM_PROMPT hardcoded server-side untuk 4-topik guardrail, RiwayatChat persistence, ChatGiziPage mobile-first UI, dan CitizenDashboardPage Layanan Digital navigation cards; 4 unit tests lulus.

## What Was Built

### Task 1 — AI Chatbot Gizi Backend Service + Route + Tests

**ai-gizi.service.ts:**
- `DAILY_LIMIT = 20` — batas harian per citizen
- `GIZI_SYSTEM_PROMPT` — string hardcoded server-side; mencakup 4 topik: gizi balita, tumbuh kembang anak, imunisasi, posyandu; guardrail tolak topik lain dengan pesan sopan Bahasa Indonesia
- `checkAndIncrementRateLimit(wargaId)` — Redis INCR atomic; key menggunakan WIB date (`Date.now() + 7h`); EXPIREAT ke 17:00 UTC (= 00:00 WIB) jika count === 1; throw `RATE_LIMIT_EXCEEDED` jika count > 20
- `chatGizi(wargaId, message)` — rate limit check SEBELUM OpenAI call; load 10 message history dari RiwayatChat (oldest first); graceful degradation return stub jika tidak ada OPENAI_API_KEY; lazy import OpenAI; build messages dengan system prompt + history + user message; call GPT-4o (temperature 0.6, max_tokens 300); persist kedua turns user+assistant ke RiwayatChat.createMany

**ai.routes.ts (extended):**
- Import `chatGizi` dari `./ai-gizi.service`
- `ChatGiziSchema` — Zod `z.object({ message: z.string().min(1).max(500) })`
- `chatGiziHandler` — parse schema (400 VALIDASI_GAGAL jika gagal); `wargaId = req.user!.userId` (T-04-03-01); call chatGizi; respond 200 `{ success, data: { reply } }`; catch: 429 RATE_LIMIT_EXCEEDED atau 500 generic
- `aiRouter.post('/chat/gizi', authMiddleware, requireRole('citizen'), chatGiziHandler)`

**ai-gizi.test.ts (backend/tests/):**
- 4 tests, semua lulus
- `checkAndIncrementRateLimit`: tidak throw saat count=1 (expireat dipanggil); throw RATE_LIMIT_EXCEEDED saat count=21
- `chatGizi`: GIZI_SYSTEM_PROMPT mengandung 4 topik; returns stub saat OPENAI_API_KEY tidak di-set

### Task 2 — ChatGiziPage + CitizenDashboardPage + Router

**ChatGiziPage.tsx:**
- State: `messages: ChatMessage[]`, `input: string`, `messagesEndRef` untuk auto-scroll
- `chatMutation` via useMutation → `POST /ai/chat/gizi` → `r.data.data.reply`; onSuccess: append user+assistant ke messages, clear input; onError: toast 429 ("Batas 20 pesan hari ini") atau 500 generic
- Auto-scroll: `useEffect([messages])` → `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })`
- `handleSend()` — guard `input.trim()` dan `!isPending`
- `handleKeyDown()` — Enter kirim, Shift+Enter newline (tidak kirim)
- Layout: fixed header (ArrowLeft → /citizen/dashboard, judul, subtitle topik); scrollable message area; loading indicator animated dots; fixed input area (textarea auto-resize + SendHorizonal button)
- User messages: right-aligned bg-green-600 text-white; assistant: left-aligned bg-white border

**CitizenDashboardPage.tsx:**
- Import Link, MessageCircle, CalendarCheck
- Tambah seksi "LAYANAN DIGITAL" setelah antrian section (tampil saat `!isLoading`)
- Card 1: Link ke /citizen/chat-gizi → icon MessageCircle hijau, "Tanya Asisten Gizi"
- Card 2: Link ke /citizen/chat-pendaftaran → icon CalendarCheck biru, "Daftar Antrian via Chat"
- Styling: bg-white border rounded-xl p-4 shadow-sm hover:shadow-md

**router/index.tsx:**
- Lazy import `ChatGiziPage = lazy(() => import('@/pages/citizen/ChatGiziPage'))`
- Route `/citizen/chat-gizi` dengan `ProtectedRoute allowedRoles={['citizen']}`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript implicit any pada parameter `h` di history.map()**
- **Found during:** Task 1 — `npx tsc --noEmit` di backend
- **Issue:** TypeScript strict mode menyebabkan `error TS7006: Parameter 'h' implicitly has an 'any' type` di `history.map((h) => ...)` meskipun Prisma dapat menginfer type
- **Fix:** Tambah type annotation eksplisit: `(h: { role: string; pesan: string })`
- **Files modified:** `backend/src/modules/ai/ai-gizi.service.ts`
- **Commit:** `60375e6`

## Known Stubs

- `/citizen/chat-pendaftaran` di CitizenDashboardPage → card navigasi sudah ada tetapi route belum dibuat (plan 04-04 atau berikutnya). Citizen akan mendapatkan 404 jika mengklik card ini — ini disengaja, card ditampilkan untuk konsistensi UX dan akan diimplementasi di plan berikutnya.

## Threat Flags

Tidak ada threat surface baru di luar yang sudah ada di `<threat_model>`:
- T-04-03-01: IDOR wargaId — MITIGATED (wargaId dari req.user!.userId JWT, bukan dari body)
- T-04-03-02: DoS billing OpenAI — MITIGATED (rate limit check SEBELUM OpenAI call, 20/hari atomic Redis INCR)
- T-04-03-03: Prompt injection — MITIGATED (GIZI_SYSTEM_PROMPT hardcoded server-side; user input sebagai 'user' role data)
- T-04-03-04: Info disclosure history — MITIGATED (RiwayatChat query WHERE wargaId = JWT userId)
- T-04-03-05: Role field tampering — MITIGATED (hanya 'user' dan 'assistant' disimpan; tool_call transient)

## Self-Check: PASSED

Files yang dibuat semua ada:
- backend/src/modules/ai/ai-gizi.service.ts ✓
- backend/tests/ai-gizi.test.ts ✓
- frontend/src/pages/citizen/ChatGiziPage.tsx ✓

Files yang dimodifikasi:
- backend/src/modules/ai/ai.routes.ts ✓
- frontend/src/pages/citizen/CitizenDashboardPage.tsx ✓
- frontend/src/router/index.tsx ✓

Commits:
- 60375e6: feat(04-03): AI chatbot gizi backend service + route + tests ✓
- 207ecea: feat(04-03): ChatGiziPage + CitizenDashboardPage nav cards + router ✓

Tests: 4/4 lulus (npx vitest run tests/ai-gizi.test.ts)
TypeScript backend (file baru): 0 errors
TypeScript frontend: 0 errors
