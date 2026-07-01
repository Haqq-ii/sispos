---
phase: 02-queue-system
plan: "03"
subsystem: antrian-backend
tags: [prisma, select-for-update, socket.io, bullmq, rbac, race-condition, zod]
dependency_graph:
  requires:
    - 02-01 (requireRole middleware, StatusAntrian.dibatalkan enum)
    - 02-02 (SlotSesi + Jadwal tersedia, posyanduUtamaId helper)
  provides:
    - AmbilAntrianSchema Zod (slotId + balitaId UUID)
    - ambilAntrian: prisma.$transaction + SELECT FOR UPDATE race condition guard
    - batalkanAntrian: ownership via findFirst(wargaId) → 404 not 403
    - getAntrianSaya: today's active antrian for citizen
    - getAntrianById: ownership enforced → 404 not 403
    - broadcastQueueUpdate: emits queue:update OUTSIDE transaction with !io guard
    - AntrianJobData interface + ANTRIAN_WA_JOB_NAME = 'antrian_whatsapp'
    - enqueueAntrianWaJob: BullMQ with attempts:3 + exponential backoff 1s
    - notification.worker.ts: antrian_whatsapp handler + Fonnte send
    - POST /api/antrian/ambil (citizen-only, SELECT FOR UPDATE)
    - PATCH /api/antrian/:id/batalkan (citizen-only, ownership)
    - GET /api/antrian/saya (citizen-only, today's active)
    - GET /api/antrian/:id (citizen-only, ownership)
  affects:
    - 02-04: citizen frontend calls POST /api/antrian/ambil + GET /api/antrian/:id
    - 02-07: TiketAntrianPage uses queue:update socket event from broadcastQueueUpdate
tech_stack:
  added: []
  patterns:
    - prisma.$transaction + $queryRaw SELECT FOR UPDATE (race condition guard)
    - $queryRaw snake_case return typing (terisi, kuota, jadwal_id, durasi_rata_aktual)
    - broadcastQueueUpdate called OUTSIDE prisma.$transaction (T-02-14 pattern)
    - findFirst(id, wargaId) ownership check → 404 not 403 (T-02-10, T-02-11)
    - enqueueAntrianWaJob via BullMQ — never direct Fonnte in request cycle
    - nomorUrut zero-padded 2 digits in WA message (String(n).padStart(2, '0'))
key_files:
  created:
    - backend/src/shared/schemas/antrian.schema.ts
    - backend/src/modules/antrian/antrian.service.ts
    - backend/src/modules/antrian/antrian.controller.ts
    - backend/src/modules/antrian/antrian.routes.ts
    - backend/src/modules/notification/antrian.job.ts
  modified:
    - backend/src/modules/notification/notification.queue.ts (enqueueAntrianWaJob added)
    - backend/src/modules/notification/notification.worker.ts (antrian_whatsapp handler added)
    - backend/src/app.ts (antrianRouter mounted at /api/antrian)
decisions:
  - "GET /saya registered BEFORE /:id in antrianRouter — prevents Express route conflict where 'saya' matches /:id pattern"
  - "enqueueAntrianWaJob called OUTSIDE prisma.$transaction — WA notification not sent if transaction rolls back (T-02-14)"
  - "findFirst(id, wargaId) for both batalkan and GET detail — returns 404 for wrong owner, preventing ID enumeration (T-02-10, T-02-11)"
  - "Prisma P2002 caught in ambilAntrianHandler — double-tap race where two creates pass SELECT FOR UPDATE but hit unique constraint maps to 409 SUDAH_DAFTAR"
  - "void enqueueAntrianWaJob(...) — fire-and-forget; antrian creation succeeds even if BullMQ enqueue fails (graceful degradation)"
  - "AmbilAntrianResult interface exported from service — includes all fields needed by both controller (201 response) and Task 2 BullMQ enqueue"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-07-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 3
---

# Phase 02 Plan 03: Antrian Backend — SELECT FOR UPDATE + BullMQ Summary

**One-liner:** Antrian module with prisma.$transaction + SELECT FOR UPDATE race condition guard, ownership-enforced cancel and GET detail (404 not 403), Socket.IO broadcast OUTSIDE transaction, and BullMQ antrian_whatsapp job with 3x exponential backoff.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Antrian module — SELECT FOR UPDATE + cancel + broadcast + app.ts | 328a7ba | antrian.schema.ts, antrian.service.ts, antrian.controller.ts, antrian.routes.ts, app.ts |
| 2 | BullMQ notification extension — antrian.job + queue + worker | c5a4958 | antrian.job.ts, notification.queue.ts, notification.worker.ts, antrian.service.ts |

## What Was Built

### Task 1 — Antrian Module + app.ts

**`backend/src/shared/schemas/antrian.schema.ts`**
- `AmbilAntrianSchema`: Zod object with `slotId` (UUID) + `balitaId` (UUID)
- `AmbilAntrianInput` type inferred
- T-02-09 mitigation: UUID validation prevents injection; nomorUrut not accepted from client

**`backend/src/modules/antrian/antrian.service.ts`** — 5 exported functions:

1. `ambilAntrian(slotId, balitaId, wargaId)`:
   - `prisma.$transaction(async tx => { ... })` with `tx.$queryRaw SELECT ... FOR UPDATE`
   - `$queryRaw` return typed as `Array<{ id, kuota, terisi, jadwal_id, durasi_rata_aktual }>` (snake_case, not camelCase)
   - Checks: slot exists → terisi < kuota → no duplicate (slotId_balitaId unique) → increment terisi → create Antrian
   - `nomorUrut = slot.terisi + 1` (old value before increment)
   - Returns `AmbilAntrianResult` with all fields needed for controller response and BullMQ job
   - `broadcastQueueUpdate(slotId)` called outside transaction (T-02-14)
   - `enqueueAntrianWaJob(...)` called outside transaction (Task 2 integration)

2. `batalkanAntrian(antrianId, wargaId)`:
   - `findFirst({ where: { id: antrianId, wargaId } })` — ownership + existence in one query
   - Returns 404 ANTRIAN_TIDAK_DITEMUKAN for wrong owner (prevents ID enumeration, T-02-10)
   - Guards: statusAntrian === 'menunggu' only (else 409 TIDAK_BISA_BATALKAN)
   - Atomic update: statusAntrian → 'dibatalkan' + slotSesi.terisi decrement in `prisma.$transaction([...])` (sequential array form)
   - `broadcastQueueUpdate(slotId)` outside transaction

3. `getAntrianSaya(wargaId)`:
   - Returns today's active antrian (status in: menunggu, dipanggil)
   - `startOfToday` uses `setUTCHours(0,0,0,0)` — consistent with UTC date comparison
   - Includes slotSesi → jadwal → posyandu, balita.namaBalita

4. `getAntrianById(antrianId, wargaId)`:
   - `findFirst({ where: { id, wargaId } })` — T-02-11: returns 404 not 403 for unauthorized
   - Includes full relations for tiket display
   - Adds `estimasiMenit = nomorUrut × estimasiDurasiMenit` (D-03 formula)

5. `broadcastQueueUpdate(slotId)`:
   - **First line**: `if (!io) { logger.warn(...); return }` — prevents crash if initSocket() not called
   - Fetches active antrianList + durasiRataAktual
   - Emits `{ nomorAktif: 0, durasiRataAktual, antrianList }` to room `sesi:{slotId}` (CLAUDE.md spec)
   - Phase 2: `nomorAktif` always 0 (Meja 1 hadir deferred to Phase 3)

**`backend/src/modules/antrian/antrian.controller.ts`**:
- `ERROR_MAP`: SLOT_PENUH→409, SUDAH_DAFTAR→409, TIDAK_BISA_BATALKAN→409, SLOT_TIDAK_DITEMUKAN→404, ANTRIAN_TIDAK_DITEMUKAN→404
- `ambilAntrianHandler`: Zod validation → service → 201 with nomorUrut zero-padded in message
- Catches `Prisma.PrismaClientKnownRequestError` P2002 → 409 SUDAH_DAFTAR (double-tap race safety net)
- `batalkanAntrianHandler`, `getAntrianSayaHandler`, `getAntrianByIdHandler` follow same pattern

**`backend/src/modules/antrian/antrian.routes.ts`**:
- All routes: `authMiddleware + requireRole('citizen')` — T-02-13: puskesmas/kader get 403
- `GET /saya` BEFORE `GET /:id` — prevents Express matching 'saya' as `:id` param
- `POST /ambil`, `PATCH /:id/batalkan`, `GET /saya`, `GET /:id`

**`backend/src/app.ts`**:
- Added `import { antrianRouter } from './modules/antrian/antrian.routes'`
- Added `app.use('/api/antrian', antrianRouter)` after jadwalRouter mount

### Task 2 — BullMQ Notification Extension

**`backend/src/modules/notification/antrian.job.ts`** (new):
- `AntrianJobData` interface: `{ nomorPonsel, nomorUrut, estimasiMenit, namaPosyandu, tanggalPelaksanaan, labelSesi }`
- `ANTRIAN_WA_JOB_NAME = 'antrian_whatsapp' as const`
- Mirrors `otp.job.ts` pattern exactly

**`backend/src/modules/notification/notification.queue.ts`** (extended):
- Added import `AntrianJobData`, `ANTRIAN_WA_JOB_NAME` from `./antrian.job`
- Added `enqueueAntrianWaJob(data: AntrianJobData)`:
  - `notificationQueue.add(ANTRIAN_WA_JOB_NAME, data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } })`
  - CLAUDE.md §WhatsApp: 3x retry exponential backoff (1s, 5s, 30s)
- All existing code (parseBullMQConnection, notificationQueue, enqueueOtpJob) unchanged

**`backend/src/modules/notification/notification.worker.ts`** (extended):
- Added imports for `AntrianJobData`, `ANTRIAN_WA_JOB_NAME`
- Added `else if (job.name === ANTRIAN_WA_JOB_NAME)` branch in worker callback
- Message format: nomorUrut zero-padded 2 digits, posyandu name, tanggal, labelSesi, "±N menit"
- Fonnte fetch pattern identical to OTP handler (same URL, headers, error handling)
- `failed` handler updated to include `jobName` for better debugging

**`antrian.service.ts`** integration (Task 2 Step D):
- Added `import { enqueueAntrianWaJob } from '../notification/notification.queue'`
- After `broadcastQueueUpdate(txResult.slotId)`: calls `void enqueueAntrianWaJob({ ... })`
- Data sources: `nomorPonsel` from DB (T-02-12), `tanggalPelaksanaan` formatted DD/MM/YYYY in WIB via `toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })`

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (backend container) | No errors |
| GET /api/antrian/saya (no auth) | 401 UNAUTHENTICATED |
| GET /api/antrian/saya (registered) | 401 — server picks up route (pre-restart returned 404) |
| `ANTRIAN_WA_JOB_NAME` in antrian.job.ts | 'antrian_whatsapp' |
| `enqueueAntrianWaJob` in notification.queue.ts | PASS (3 references to constant/function) |
| `ambilAntrian` includes `broadcastQueueUpdate` OUTSIDE transaction | PASS |
| `enqueueAntrianWaJob` called OUTSIDE transaction | PASS |
| `if (!io)` guard in broadcastQueueUpdate | PASS |
| `findFirst(id, wargaId)` in batalkanAntrian | PASS |
| `findFirst(id, wargaId)` in getAntrianById | PASS |
| GET /saya before /:id in router | PASS |
| P2002 catch in controller | PASS |

## Deviations from Plan

None — plan executed exactly as written. All required fields returned from transaction to enable both controller response and BullMQ enqueue data in Task 2. The split between Task 1 (no BullMQ) and Task 2 (add BullMQ) was handled cleanly by designing the `AmbilAntrianResult` interface upfront to include all WA notification fields.

## Known Stubs

None. This plan produced backend modules only. No UI data flow, no placeholder text.

## Threat Flags

No new threat surface beyond what was planned in the STRIDE threat register. All 7 threats (T-02-09 through T-02-15) mitigated as specified.

## Self-Check: PASSED
- [x] backend/src/shared/schemas/antrian.schema.ts exists, exports AmbilAntrianSchema + AmbilAntrianInput
- [x] backend/src/modules/antrian/antrian.service.ts uses prisma.$transaction + $queryRaw FOR UPDATE
- [x] antrian.service.ts broadcastQueueUpdate called OUTSIDE transaction
- [x] antrian.service.ts enqueueAntrianWaJob called OUTSIDE transaction
- [x] antrian.service.ts imports `io` from config/socket with `if (!io)` guard
- [x] backend/src/modules/antrian/antrian.routes.ts has GET /saya BEFORE GET /:id
- [x] backend/src/modules/antrian/antrian.routes.ts uses requireRole('citizen') on all routes
- [x] backend/src/modules/notification/antrian.job.ts exports AntrianJobData + ANTRIAN_WA_JOB_NAME
- [x] backend/src/modules/notification/notification.queue.ts exports enqueueAntrianWaJob
- [x] backend/src/modules/notification/notification.worker.ts handles ANTRIAN_WA_JOB_NAME
- [x] backend/src/app.ts mounts antrianRouter at /api/antrian
- [x] GET /api/antrian/saya returns 401 (not 404) after backend restart
- [x] Task 1 commit 328a7ba exists
- [x] Task 2 commit c5a4958 exists
- [x] TypeScript: no errors (npx tsc --noEmit clean)
