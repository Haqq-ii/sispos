# Phase 2: Queue System - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 02 delivers the end-to-end antrian (queue) system:
- Puskesmas membuat jadwal pelayanan → SlotSesi auto-generated (3 sesi, kuota = floor(60 / estimasiDurasiMenit))
- Citizen ambil antrian dengan race-condition guard (SELECT FOR UPDATE)
- Tiket antrian dengan nomor urut + countdown adaptif realtime via Socket.IO
- Batalkan antrian dari tiket screen
- Notifikasi WhatsApp via BullMQ

Phase ini TIDAK meliputi: Meja 5 "Selesai" trigger (Phase 3), durasiRataAktual update (Phase 3), Puskesmas dashboard utama (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Posyandu Scope in Antrian Flow
- **D-01:** Pilih-tanggal menampilkan jadwal berdasarkan `Warga.posyanduId` saja — citizen tidak bisa switch posyandu di flow antrian.
- **D-02:** Jika `Warga.posyanduId` null (onboarding dilewati), redirect ke halaman pilih posyandu (onboarding lokasi ulang). Bukan fallback "tampilkan semua posyandu".

### Phase 2 ↔ Phase 3 Countdown Boundary
- **D-03:** Countdown di Phase 2 menggunakan `estimasiDurasiMenit` dari Jadwal saja. `durasiRataAktual` belum diupdate di Phase 2 (Meja 5 belum ada). Formula: `(nomorUrut - nomorAktif) × estimasiDurasiMenit`. `nomorAktif` = 0 sampai Phase 3 ship.
- **D-04:** TIDAK perlu stub endpoint `POST /api/antrian/:id/selesai` di Phase 2. Phase 3 akan buat endpoint ini dari scratch bersama Meja 5.
- **D-05:** Socket.IO broadcast `queue:update` ke room `sesi:{slotId}` terjadi saat: (1) antrian baru dibuat, (2) antrian dibatalkan. Keduanya trigger realtime update di tiket screen citizen lain di sesi yang sama.

### Cancel Antrian
- **D-06:** "Batalkan Antrian" masuk Phase 2 scope. Backend: `PATCH /api/antrian/:id/batalkan` → update `statusAntrian = 'dibatalkan'` → broadcast `queue:update`. UI: dialog konfirmasi di tiket screen (sesuai UI-SPEC). Tombol hanya tampil saat `statusAntrian === 'menunggu'`.

### Puskesmas Jadwal UI Placement
- **D-07:** Manajemen Jadwal adalah standalone page di `/puskesmas/jadwal` — bukan tab di dashboard. Dashboard Puskesmas didesain di Phase 4; sidebar/navbar Puskesmas akan menambah link ke `/puskesmas/jadwal`.
- **D-08:** Dropdown posyandu di form Buat Jadwal hanya menampilkan posyandu yang di-assign ke akun Puskesmas tersebut (via `Puskesmas.posyandu` relation di schema). Bukan semua posyandu di sistem.

### Claude's Discretion
- Error handling detail (retry behavior, timeout) di Socket.IO — Claude pilih sesuai best practice.
- Pagination/sorting di tabel jadwal Puskesmas — Claude decide.
- Moving average formula nanti di Phase 3 — Phase 2 cukup `estimasiDurasiMenit`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Data Model
- `prisma/schema.prisma` — Model Jadwal, SlotSesi, Antrian, StatusAntrian enum, StatusJadwal enum. WAJIB dibaca sebelum implement backend queue.

### Requirements
- `.planning/REQUIREMENTS.md` §Queue System — QUEUE-01..06 (semua harus di-cover Phase 2)

### Tech Stack Rules
- `CLAUDE.md` §Antrian (KRITIS) — SELECT FOR UPDATE, formula estimasi, moving average rules
- `CLAUDE.md` §WhatsApp — SELALU enqueue BullMQ, jangan kirim langsung ke Fonnte
- `CLAUDE.md` §Socket.IO Events — format event `queue:join`, `queue:update`, `queue:almost`

### UI Design Contract
- `.planning/phases/02-queue-system/02-UI-SPEC.md` — Locked design contract untuk semua 7 screen Phase 2. WAJIB dibaca sebelum implement frontend.

### Existing Patterns (Phase 01)
- `backend/src/modules/auth/` — Pattern module Express: routes, controller, service, middleware
- `backend/src/modules/notification/` — BullMQ job pattern untuk WA
- `frontend/src/hooks/` — Pattern TanStack Query hooks
- `frontend/src/stores/` — Pattern Zustand store
- `frontend/src/lib/validations/` — Zod schema pattern

### Roadmap
- `.planning/ROADMAP.md` §Phase 2 — Wave 2.1, 2.2, 2.3, Figma frames, success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/modules/auth/auth.middleware.ts` — `authMiddleware` + role guard patterns (reuse for queue routes)
- `backend/src/modules/notification/` — BullMQ notification job (reuse untuk WA notif antrian)
- `backend/src/config/socket.ts` — Socket.IO server instance (import untuk emit dari queue service)
- `frontend/src/components/ui/` — shadcn components dari Phase 01 (button, input, card, badge, skeleton sudah ada; Phase 2 perlu tambah: calendar, dialog, progress, toast, table, radio-group)
- `frontend/src/router/index.tsx` — ProtectedRoute + role guard pattern (reuse untuk route citizen + puskesmas)

### Established Patterns
- Backend module: `{name}.routes.ts` → `{name}.controller.ts` → `{name}.service.ts`
- Shared Zod schemas di `backend/src/shared/schemas/` — frontend dan backend pakai schema yang sama
- API response format: `{ success: true, data: {...} }` / `{ success: false, error: "KODE", message: "..." }`
- Semua endpoint dilindungi `authMiddleware` kecuali `/api/auth/*`

### Integration Points
- `backend/src/modules/posyandu/` — GET /api/posyandu (untuk dropdown jadwal Puskesmas + info posyandu citizen)
- `backend/src/modules/child/` — GET /api/balita (untuk daftar balita citizen di konfirmasi antrian)
- `backend/src/config/redis.ts` — Redis client (untuk SELECT FOR UPDATE via Prisma transaction, bukan Redis lock)
- Socket.IO room pattern: `sesi:{slotId}` — join saat mount TiketAntrianPage, leave saat unmount

</code_context>

<specifics>
## Specific Ideas

- Countdown prefix WAJIB "±" — tidak boleh angka absolut tanpa tanda estimasi
- `nomorUrut` zero-padded 2 digit di tiket (07, tidak 7)
- Broadcast `queue:update` payload: `{ nomorAktif, durasiRataAktual, antrianList }` — sesuai CLAUDE.md
- Phase 2 `nomorAktif` selalu 0 (Meja 1 hadir belum di-implement), jadi countdown = `nomorUrut × estimasiDurasiMenit`
- Puskesmas Jadwal route: `/puskesmas/jadwal` — tambahkan link sementara di `PuskesmasDashboardPage.tsx` sebagai placeholder navigation

</specifics>

<deferred>
## Deferred Ideas

- `durasiRataAktual` moving average update → Phase 3 (Meja 5 "Selesai")
- `queue:almost` Socket.IO event (notifikasi "hampir dipanggil") → Phase 3 (kader yang trigger)
- Puskesmas dashboard utama (DSS map, statistik) → Phase 4
- Sidebar/navbar Puskesmas permanen → Phase 4 (saat dashboard penuh didesain)
- Detail jadwal `/puskesmas/jadwal/:jadwalId` → Phase 3 (saat kader perlu lihat antrian per sesi)

</deferred>

---

*Phase: 02-queue-system*
*Context gathered: 2026-07-01*
