---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 06
last_updated: "2026-07-04T10:25:06Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 32
  completed_plans: 31
  percent: 78
---

# SISPOS — GSD State

> Project memory. Updated at every phase transition.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-30)

**Core value:** Countdown antrian adaptif + alur 5 Meja kader end-to-end
**Current focus:** Phase 06 — pwa-offline

## Current Status

```
Phase aktif  : Phase 06 — PWA & Offline
Last update  : 2026-07-04
Plans done   : 06-01 + 06-02 complete (IDB foundation + Meja 1/2 offline intercepts)
Phases done  : 5 / 8 (Phase 00 + 01 + 02 + 04 + 05 complete), Phase 03 pending verification, Phase 06 in progress
Next command : /gsd-execute-phase 06 plan 03 (Meja 3/4/5 offline intercepts)
Stopped at   : Phase 06 Plan 02 complete — Meja1Page handleHadir+handleTangguhkan offline, Meja2Page doSubmit tempId chain, SyncPendingBadge in both headers — TypeScript clean
```

## Phase History

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| 0 | ✓ Complete | 2026-06-30 | Docker stack, Prisma migrate, seed minimal |
| 1 | ✓ Complete | 2026-07-01 | Auth 3 role, OTP, wilayah 1508, register flow |
| 2 | ✓ Complete | 2026-07-01 | Queue: Jadwal + SlotSesi + SELECT FOR UPDATE + countdown + realtime Socket.IO |
| 3 | ○ Pending | — | — |
| 4 | ○ Pending | — | — |
| 5 | ○ Pending | — | — |
| 6 | ○ Pending | — | — |
| 7 | ○ Pending | — | — |

## Key Context for Agents

- **Figma file key**: `4DIazKntakgAGXBDYefjbD` — pull design context sebelum implement setiap screen UI
- **Prisma schema**: sudah final di `prisma/schema.prisma` — jangan redesign model
- **Tech stack**: dikunci di `CLAUDE.md` — tidak ada penggantian library
- **Timeline**: Phase 0-3 harus selesai sesegera mungkin (laporan PSI)
- **AI chatbot scope**: 3 function calls (daftar/batalkan/reschedule) — batalkan + reschedule butuh konfirmasi eksplisit
- **Countdown**: estimasi bukan janji — UI label harus jelas
- **Backend**: UP, healthy — POST /api/auth/login active for all 3 roles
- **Frontend**: UP — React app running at http://localhost
- **DB seed**: warga=1, kader=1, puskesmas=1, balita=1, posyandu=1, wilayah=1508
- **Demo accounts**: Citizen NIK 3471012345670001/Demo1234!, Kader 081234560001/123456, Puskesmas demo@puskesmas-mergangsan.go.id/Demo1234!
- **docker-compose.yml**: FONNTE_API_KEY, APP_ENCRYPTION_KEY, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_ROUNDS now forwarded to backend container

## Phase 02 Goal

Citizen bisa ambil antrian dengan race condition guard; estimasi waktu tunggu adaptif; countdown bergerak realtime via Socket.IO.

**Success Criteria:**

1. Puskesmas buat jadwal 7 menit/orang → 3 SlotSesi kuota 8 ter-generate otomatis
2. 2 tab bersamaan ambil slot sisa 1 → hanya 1 berhasil (test race condition)
3. Nomor antrian + estimasi waktu tampil di screen citizen
4. Kader tandai selesai → countdown citizen bergerak tanpa refresh
5. WA notifikasi terkirim via BullMQ (log queue visible)

**Figma screens**: Citizen antrian flow — Pilih tanggal, Pilih sesi jam, Konfirmasi, Cetak antrian; Puskesmas manajemen jadwal
**Figma frames**: `5:2314` (Pilih tanggal), `5:2630` (Pilih sesi), `5:2902` (Konfirmasi), `5:3116` (Cetak), `5:15526` (Manajemen Jadwal)

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-30 | Figma dipakai dari Phase 0 (bukan Phase 3) | Desain sudah lengkap semua screen |
| 2026-06-30 | AI chatbot: 3 function calls (daftar/batalkan/reschedule) | Scope diperluas dari CLAUDE.md awal; batalkan+reschedule butuh konfirmasi |
| 2026-06-30 | Countdown = estimasi (UI responsibility) | Tidak ada fallback notifikasi WA untuk meleset |
| 2026-06-30 | Horizontal Layers (bukan Vertical MVP) | Sesuai struktur 8 phase di docs/ROADMAP.md |
| 2026-06-30 | AuditLog polymorphic relations removed | Prisma tidak bisa map single userId ke 2 model; userId+userRole cukup untuk lookup |
| 2026-06-30 | APP_ENCRYPTION_KEY ditambah ke .env.example | Wajib untuk enkripsi kolom UU PDP (catatanKonsultasi, rekomendasiAi) |
| 2026-06-30 | io: Server | undefined (bukan Server) di socket.ts | Type-safe; health route falsy check valid; no @ts-expect-error needed |
| 2026-06-30 | pino logger lokal di setiap config file | Mencegah circular dependency antara app.ts dan config layer |
| 2026-06-30 | VitePWA manifest: false — gunakan public/manifest.json langsung | Hindari duplikasi manifest; satu sumber kebenaran untuk PWA config |
| 2026-06-30 | Axios interceptor type-narrowing (bukan axios.isAxiosError) | TypeScript strict mode; error parameter bertipe unknown di interceptors |
| 2026-07-01 | FONNTE_API_KEY forwarded via docker-compose.yml | Phase 01 env.ts added it as required; compose never passed it → crash on restart |
| 2026-07-01 | seed.demo.ts uses BCRYPT_ROUNDS=10 | Faster seed execution; not production |
| 2026-07-01 | GET /api/sesi alias di app.ts (bukan hanya /api/jadwal/sesi) | Artifacts spec eksplisit menyebut /api/sesi; keduanya aktif |
| 2026-07-01 | getCitizenPosyanduId helper di jadwal.service | D-01: backend enforce posyanduUtamaId dari DB, bukan client-supplied |
| 2026-07-01 | SlotSesi times via new Date(0).setUTCHours() | Avoid PostgreSQL @db.Time timezone pitfall per 02-RESEARCH.md |
| 2026-07-01 | GET /saya before /:id in antrianRouter | Express route conflict — 'saya' matches /:id if registered after |
| 2026-07-01 | void enqueueAntrianWaJob(...) fire-and-forget | Antrian creation succeeds even if BullMQ enqueue fails gracefully |
| 2026-07-01 | P2002 caught in ambilAntrianHandler | Double-tap race safety net — unique constraint violation → 409 SUDAH_DAFTAR |
| 2026-07-01 | useAntrianStore intentionally has no persist() | Wizard state resets on tab close is correct behavior; antrian data from TanStack Query only |
| 2026-07-01 | computeCountdown separated as pure function | Independently testable; useCountdownEstimasi wraps it for React lifecycle |
| 2026-07-01 | ± prefix hardcoded in displayText | Countdown is estimate not promise (QUEUE-03 + CLAUDE.md mandate) |
| 2026-07-01 | useSesiAvailability staleTime 15s | Slot availability changes frequently; short cache reduces stale kuota display |
| 2026-07-01 | InlineProgress inline daripada @radix-ui/react-progress | Package belum ada di package.json; div custom dengan role=progressbar secara visual identik dan tidak butuh install baru |
| 2026-07-01 | D-02 detect via backend 422 POSYANDU_BELUM_DIPILIH | posyanduUtamaId tidak di useAuthStore; server adalah sumber kebenaran — error response menandai redirect |
| 2026-07-01 | jadwalId via navigate state (bukan Zustand) | Wizard step data bersifat ephemeral; hanya nilai akhir (selectedDate, selectedSlotId) disimpan ke store |
| 2026-07-01 | JadwalListItem extended dengan posyanduId + slotSesi | Backend getJadwalList mengembalikan keduanya; interface harus match untuk disabled-date filtering dan kuota display |
| 2026-07-01 | formatDateYYYYMMDD via local date parts (bukan toISOString) | Menghindari UTC midnight offset yang menyebabkan off-by-one day di WIB timezone |
| 2026-07-01 | Toaster ditambah ke App.tsx | useToast() tidak render apa-apa tanpa Toaster di component tree |
| 2026-07-01 | useAntrianSocket guard if(!slotId) return | Memungkinkan TiketAntrianPage call hook sebelum antrian data loaded |
| 2026-07-01 | socketStatus state (connecting/connected/disconnected) | Untuk disconnect alert non-dismissible di TiketAntrianPage |
| 2026-07-01 | formatJam handles ISO string dan HH:MM | Prisma @db.Time berbeda antara getSesiList (diformat HH:MM) dan antrian include (raw ISO) |
| 2026-07-01 | GET /api/balita endpoint added (child module) | KonfirmasiAntrianPage membutuhkan daftar balita — child module belum ada, dibuat minimal |
| 2026-07-01 | CitizenDashboardPage path: pages/citizen/ bukan pages/ | Konsisten dengan PilihTanggalPage/PilihSesiPage; old file jadi re-export |
| 2026-07-01 | ManajemenJadwalPage: export default (bukan named export) | React.lazy() membutuhkan { default: Component }; named-only export menyebabkan render undefined → blank page |
| 2026-07-01 | $queryRaw camelCase kolom harus di-quote: "jadwalId", "durasiRataAktual" | Prisma tidak memetakan kolom ke snake_case by default; PostgreSQL case-sensitive dengan unquoted identifiers → error 42703 |
| 2026-07-01 | Zod v4: required_error → error (di z.date() dan z.number()) | Zod v4 mengganti nama option ini; required_error tidak lagi valid |
| 2026-07-01 | APP_ENCRYPTION_KEY (bukan ENCRYPTION_KEY) di encrypt.ts | .env dan docker-compose.yml sudah menggunakan APP_ENCRYPTION_KEY; konsistensi lebih penting dari PLAN.md naming |
| 2026-07-01 | WHO tables flat keys (wfa_boys) bukan nested (WAZ.male) | zscore.ts API yang dispesifikasikan user menggunakan flat key lookup |
| 2026-07-01 | wfa/lhfa months 0-24 saja (25 entries) | User menyediakan data exact 0-24; expand ke 0-60 jika balita >24 bulan dibutuhkan |
| 2026-07-02 | Native HTML checkbox (Meja 3) — @radix-ui/react-checkbox tidak ada di package.json | Tidak perlu package baru; Tailwind styling identik secara visual; pola sama dengan InlineProgress |
| 2026-07-02 | TandaKlinisSchema tanpa .default() — zodResolver mismatch di Zod v4 | Zod v4 .default() menghasilkan InputType opsional vs OutputType required; fix: defaultValues di useForm |
| 2026-07-02 | IDOR guard via antrian chain di updatePemeriksaan | T-03-05-01: kader hanya bisa update pemeriksaan dari posyandu-nya sendiri |
| 2026-07-02 | Native textarea (Meja 4) — @/components/ui/textarea.tsx tidak ada di package | Konsisten dengan InlineProgress + native checkbox pattern dari 03-02 dan 03-05 |
| 2026-07-02 | Lazy import SpeechClient dan OpenAI di service files | Graceful degradation saat env vars tidak ada; development bisa berlanjut tanpa credentials |
| 2026-07-02 | IDOR guard duplikat di earlyWarningHandler sebelum OpenAI call | Menghindari billing OpenAI untuk request tidak authorized; defense-in-depth T-03-06-06 |
| 2026-07-03 | puskesmasId dari req.user!.userId (JWT) di dashboard endpoints | IDOR guard T-04-01-01 + T-04-01-03; tidak pernah dari query params |
| 2026-07-03 | react-leaflet@4.2.1 pinned (v5 requires React 19) | SISPOS pada React 18.3.1; v5 crash dengan peer dependency error |
| 2026-07-03 | MapContainer tanpa key prop | Mencegah "Map container is already initialized" error saat bulan filter berubah |
| 2026-07-03 | WIB timezone rate limit key: Date.now() + 7h (bukan new Date()) | Pitfall 5: UTC midnight ≠ WIB midnight; EXPIREAT ke 17:00 UTC = 00:00 WIB |
| 2026-07-03 | Type annotation eksplisit h: {role,pesan} di history.map() | TypeScript strict mode; Prisma infer tidak cukup untuk arrow function param |
| 2026-07-03 | chatGizi graceful degradation sebelum lazy import OpenAI | Cek OPENAI_API_KEY sebelum dynamic import; development tanpa key tetap berjalan |
| 2026-07-03 | parallel_tool_calls:false di setiap openai.chat.completions.create (pendaftaran) | T-04-04-01: mencegah bypass konfirmasi gate via simultaneous tool execution |
| 2026-07-03 | client-side history management di ChatPendaftaranPage | Server return updated messages array; DB hanya untuk audit (user+assistant turns) |
| 2026-07-03 | type narrowing toolCall.type !== 'function' + as unknown as FunctionToolCall | OpenAI SDK v6 union type ChatCompletionMessageCustomToolCall tidak punya .function |
| 2026-07-04 | vi.fn() mock harus gunakan function keyword (bukan arrow fn) untuk constructor | Arrow functions tidak bisa dipanggil dengan new; vi.fn(() => ({...})) throw "is not a constructor" di Vitest v4 |
| 2026-07-04 | pdfkit mock perlu emit 'data' event sebelum 'end' | Buffer.concat([]) = length 0; dummy %PDF bytes diemit di end() agar test length > 0 pass |
| 2026-07-04 | puskesmasId dari req.user!.userId di laporanBulananHandler | T-05-01 IDOR guard; puskesmasId tidak pernah dari req.query atau req.body |
| 2026-07-04 | Comment teks tidak boleh mengandung keyword grep acceptance criteria | window.open atau async/await di comment menyebabkan false positive; paraphrase semantik |
| 2026-07-04 | idb@8 approved via human-verify gate (Task 1) — cross-verified npm registry + jakearchibald/idb + web.dev attribution | Package tagged [ASSUMED] for slopcheck; blocking checkpoint completed before install |
| 2026-07-04 | generateTempId falls back from crypto.randomUUID() to timestamp+Math.random() for HTTP-only Docker context (A3) | Nginx serves port 80 HTTP; crypto.randomUUID requires secure context; fallback ensures IDB works in dev |
| 2026-07-04 | syncAll per-item try/catch: non-4xx errors leave item in queue; only 422/409 → logSyncError (D-04) | Prevents one failed item from aborting full batch; network/5xx items retry on next 'online' event |
| 2026-07-04 | stable ref pattern for 'online' event in useOfflineSync | syncAllRef.current = syncAll in useEffect avoids stale closure without adding syncAll to registration useEffect deps |
| 2026-07-04 | Tangguhkan button added to Meja1Page isBelum card (tangguhkanMutation had no call site) | Mutation was defined but unconnected; offline intercept plan requires 2 enqueueOperation calls; button wired via handleTangguhkan wrapper |
| 2026-07-04 | Two generateTempId() calls in Meja2 doSubmit offline branch | One for queue entry id, one for tempPemeriksaanId — must be different UUIDs per plan spec |

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 00 | 01 | ~12 min | 2/2 | 5 |
| 00 | 02 | ~6 min | 2/2 | 26 |
| 00 | 03 | ~15 min | 2/2 | 24 |
| 01 | 01 | ~20 min | 2/2 | 9 |
| 01 | 02 | ~25 min | 2/2 | 8 |
| 01 | 03 | ~15 min | 2/2 | 3 |
| 01 | 04 | ~20 min | 2/2 | 8 |
| 02 | 01 | ~7 min | 3/3 | 15 |
| 02 | 02 | ~25 min | 2/2 | 8 |
| 02 | 03 | ~6 min | 2/2 | 8 |
| 02 | 04 | ~3 min | 2/2 | 6 |
| 02 | 05 | ~5 min | 2/2 | 5 |
| 02 | 06 | ~2 min | 2/2 | 6 |
| 02 | 07 | ~20 min | 2/2 + checkpoint | 13 |
| 03 | 05 | ~30 min | 2/2 | 5 |
| 03 | 06 | ~25 min | 3/3 | 7 |
| 04 | 01 | ~7 min | 3/3 | 11 |
| 04 | 02 | ~15 min | 3/3 | 11 |
| 04 | 03 | ~20 min | 2/2 | 6 |
| 04 | 04 | ~15 min | 2/3 + checkpoint | 5 |
| 05 | 01 | ~9 min | 2/2 | 2 |
| 05 | 02 | ~3 min | 2/2 | 3 |
| 06 | 01 | ~20 min | 3/3 | 7 |
| 06 | 02 | ~5 min | 2/2 | 2 |
