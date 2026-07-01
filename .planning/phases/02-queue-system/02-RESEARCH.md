# Phase 02: Queue System - Research

**Researched:** 2026-07-01
**Domain:** Queue management — Prisma SELECT FOR UPDATE, Socket.IO rooms, BullMQ WA jobs, React TanStack Query + real-time countdown
**Confidence:** HIGH (codebase verified; patterns confirmed from Phase 01 source)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Pilih-tanggal menampilkan jadwal berdasarkan `Warga.posyanduUtamaId` saja — citizen tidak bisa switch posyandu di flow antrian.
- **D-02:** Jika `Warga.posyanduUtamaId` null, redirect ke halaman pilih posyandu (onboarding lokasi ulang). Bukan fallback "tampilkan semua posyandu".
- **D-03:** Countdown Phase 2 = `(nomorUrut - nomorAktif) × estimasiDurasiMenit`. `nomorAktif` = 0 sampai Phase 3 ship. Formula simplifikasi: `nomorUrut × estimasiDurasiMenit`.
- **D-04:** TIDAK perlu stub `POST /api/antrian/:id/selesai` di Phase 2. Phase 3 buat endpoint ini dari scratch bersama Meja 5.
- **D-05:** `queue:update` broadcast terjadi saat: (1) antrian baru dibuat, (2) antrian dibatalkan.
- **D-06:** "Batalkan Antrian" masuk Phase 2. Backend: `PATCH /api/antrian/:id/batalkan` → update `statusAntrian = 'dibatalkan'` → broadcast `queue:update`. Tombol hanya saat `statusAntrian === 'menunggu'`.
- **D-07:** Manajemen Jadwal = standalone page di `/puskesmas/jadwal`, bukan tab di dashboard.
- **D-08:** Dropdown posyandu di form Buat Jadwal hanya menampilkan posyandu yang di-assign ke akun Puskesmas (via `Puskesmas.posyandu` relation).

### Claude's Discretion
- Error handling detail (retry behavior, timeout) di Socket.IO
- Pagination/sorting di tabel jadwal Puskesmas
- Moving average formula nanti di Phase 3 — Phase 2 cukup `estimasiDurasiMenit`

### Deferred Ideas (OUT OF SCOPE)
- `durasiRataAktual` moving average update → Phase 3
- `queue:almost` Socket.IO event → Phase 3
- Puskesmas dashboard utama → Phase 4
- Sidebar/navbar Puskesmas permanen → Phase 4
- Detail jadwal `/puskesmas/jadwal/:jadwalId` → Phase 3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUEUE-01 | Puskesmas bisa membuat jadwal pelayanan; SlotSesi ter-generate otomatis dengan kuota `floor(60 / estimasiDurasiMenit)` | Jadwal service + auto-slot pattern documented in §Architecture Patterns |
| QUEUE-02 | Citizen bisa ambil antrian; `SELECT FOR UPDATE` aktif — 2 tab bersamaan di slot sisa 1 hanya 1 yang berhasil | Prisma transaction + $queryRaw pattern in §Architecture Patterns |
| QUEUE-03 | Nomor urut kalkulasi otomatis; estimasi waktu tunggu formula `nomorUrut × estimasiDurasiMenit`; UI menampilkan "estimasi" | Countdown formula + "±" prefix rule in §Architecture Patterns |
| QUEUE-04 | Status antrian realtime via Socket.IO room `sesi:{slotId}`; countdown bergerak tanpa refresh | Socket.IO room pattern + useAntrianSocket hook in §Architecture Patterns |
| QUEUE-05 | `durasiRataAktual` update sebagai moving average (Phase 3) | DEFERRED — not implemented Phase 2 |
| QUEUE-06 | Notifikasi WhatsApp via BullMQ; retry 3x exponential backoff | BullMQ extension pattern in §Architecture Patterns |
</phase_requirements>

---

## Summary

Phase 02 implements the queue system end-to-end: Puskesmas creates a jadwal (schedule) which auto-generates 3 SlotSesi; citizens take a slot with race-condition protection; a ticket screen shows the queue number with a real-time countdown driven by Socket.IO. Phase 01 established all infrastructure (Express modular monolith, Prisma, Socket.IO server, BullMQ, TanStack Query hooks, Zustand stores, ProtectedRoute). Phase 02 adds three new backend modules (`jadwal`, `antrian`, minimal `posyandu`) and six new frontend page files plus associated hooks and components.

**Two schema migrations are required before any implementation work:** (1) Add `dibatalkan` to `StatusAntrian` enum (needed for D-06 cancel flow); (2) Add `aktif` to `StatusJadwal` enum (needed for UI badge display when jadwal is published). These are enum extensions, not model redesigns — consistent with CLAUDE.md's "don't redesign model" rule.

The biggest integration challenge is the SELECT FOR UPDATE pattern: Prisma ORM does not expose row-level locking via its fluent API; it requires `prisma.$transaction(async tx => { const [row] = await tx.$queryRaw... })`. This pattern is mandated by CLAUDE.md and must be used exactly — no alternatives.

**Primary recommendation:** Wave 2.0 (schema migrations + shadcn add) → Wave 2.1 (backend jadwal + posyandu modules + Puskesmas page, parallelizable with frontend scaffold) → Wave 2.2 (backend antrian module + citizen flow pages) → Wave 2.3 (Socket.IO integration in TiketAntrianPage + CitizenDashboard antrian card). Each backend module follows the established routes → controller → service layering from Phase 01.

---

## Project Constraints (from CLAUDE.md)

Directives that affect Phase 02 implementation:

| Constraint | Rule | Enforcement |
|-----------|------|-------------|
| SELECT FOR UPDATE | `prisma.$transaction + $queryRaw` — never optimistic locking | Backend antrian.service.ts |
| WA notifications | ALWAYS enqueue BullMQ, never call Fonnte directly | antrian.service.ts |
| BullMQ retry | 3x exponential backoff: 1s, 5s, 30s | notification.queue.ts job options |
| Socket.IO broadcast | `queue:update` payload: `{ nomorAktif, durasiRataAktual, antrianList }` | queue.service.ts |
| Socket.IO room | `sesi:{slotId}` — join on TiketAntrianPage mount, leave on unmount | useAntrianSocket.ts |
| Auth guard | Every endpoint protected by `authMiddleware` except `/api/auth/*` | All route files |
| TypeScript strict | No `any` without explicit justification | All files |
| Secrets | No hardcoded secrets — `process.env.VAR` only | All files |
| Countdown label | Always "±XX menit" — never absolute clock time | TiketAntrianPage, KonfirmasiAntrianPage |
| UI language | All UI text in Bahasa Indonesia | All page/component files |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Jadwal creation + slot auto-gen | API (Express service) | DB (Prisma transaction) | Business logic + atomic multi-row insert |
| Race condition guard (slot kuota) | DB (SELECT FOR UPDATE) | API (error mapping → 409) | Lock must be at DB level, not app level |
| Countdown calculation | Frontend (client-side) | API (provides nomorUrut + estimasiDurasiMenit) | Reduce server load; client recomputes on each socket event |
| Real-time broadcast | API (Socket.IO emit) | Frontend (socket.io-client listener) | Server owns truth; client subscribes |
| WA notification delivery | Job Queue (BullMQ worker) | External (Fonnte API) | Async, retry-safe, decoupled from request cycle |
| Queue state display | Frontend (TanStack Query + Zustand) | API (GET /api/antrian/:id) | TanStack Query owns server state; Zustand holds transient nav state only |
| Posyandu scope filtering | API (query WHERE posyanduId = warga.posyanduUtamaId) | DB | Business rule — server enforces it, not client |

---

## Standard Stack

### Core (all already installed — verified from package.json)

| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| Prisma Client | ^5.15.0 | ORM + $queryRaw for SELECT FOR UPDATE | [VERIFIED: backend/package.json] |
| Socket.IO (server) | ^4.7.5 | Real-time broadcast from Express | [VERIFIED: backend/package.json] |
| socket.io-client | ^4.7.5 | Frontend Socket.IO subscription | [VERIFIED: frontend/package.json] |
| BullMQ | ^5.7.0 | WA notification job queue | [VERIFIED: backend/package.json] |
| @tanstack/react-query | ^5.45.0 | Server state management (hooks) | [VERIFIED: frontend/package.json] |
| Zustand | ^4.5.2 | Transient UI navigation state | [VERIFIED: frontend/package.json] |
| React Hook Form | ^7.80.0 | Form management (Buat Jadwal dialog) | [VERIFIED: frontend/package.json] |
| Zod | ^3.23.8 (BE) / ^4.4.3 (FE) | Schema validation | [VERIFIED: both package.json] |
| Axios | ^1.7.2 | HTTP client with JWT interceptor | [VERIFIED: frontend/package.json] |

**Note:** Backend uses Zod ^3, frontend uses Zod ^4. Shared schemas live in `backend/src/shared/schemas/` and are imported by the backend only. Frontend has its own validation schemas in `frontend/src/lib/validations/` using Zod v4. Keep them in sync manually — no shared package between FE and BE.

### shadcn Components to Install (Wave 0)

Already installed (Phase 01): button, input, label, select, card, badge, alert, separator, skeleton, form.

Must add before Phase 2 component work:

```bash
npx shadcn add calendar
npx shadcn add dialog
npx shadcn add progress
npx shadcn add toast
npx shadcn add table
npx shadcn add tooltip
npx shadcn add tabs
npx shadcn add radio-group
```

[VERIFIED: 02-UI-SPEC.md — design system section]

### No New npm Packages Required

Phase 02 requires zero new package installs. All libraries (Socket.IO client, BullMQ, Prisma, TanStack Query, Zustand, Zod, RHF) are already present. Only shadcn CLI commands (which pull from the official shadcn registry, not npm) are needed.

---

## Package Legitimacy Audit

> No new npm packages are introduced in Phase 02. All dependencies come from packages already installed in Phase 01 and verified at that time. shadcn components are pulled from the official shadcn registry (not npm install). No audit required.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
CITIZEN FLOW:
Browser
  → GET /api/jadwal/tersedia?tanggal=&posyanduId=  (jadwal module)
  → GET /api/sesi?jadwalId=                        (jadwal module)
  → POST /api/antrian/ambil                        (antrian module)
       ↓ Prisma $transaction
       ↓ $queryRaw SELECT * FROM slot_sesi WHERE id = ? FOR UPDATE
       ↓ check terisi < kuota
       ↓ UPDATE slot_sesi SET terisi = terisi + 1
       ↓ INSERT INTO antrian (nomorUrut, ...)
       ↓ enqueueAntrianWaJob(nomorPonsel, nomorUrut, estimasi)  → BullMQ → Fonnte
       ↓ io.to(`sesi:${slotId}`).emit('queue:update', {...})    → Socket.IO
  ← 201 { antrianId, nomorUrut, estimasiMenit }
  → Browser opens /citizen/antrian/tiket/:antrianId
  → socket.emit('queue:join', { slotId, antrianId })
  ← socket.on('queue:update', { nomorAktif, durasiRataAktual, antrianList })
  → compute: minutesLeft = nomorUrut × estimasiDurasiMenit  (nomorAktif=0 in Phase 2)

CANCEL FLOW:
  → PATCH /api/antrian/:id/batalkan
       ↓ UPDATE antrian SET statusAntrian = 'dibatalkan'
       ↓ UPDATE slot_sesi SET terisi = terisi - 1
       ↓ io.to(`sesi:${slotId}`).emit('queue:update', {...})
  ← 200

PUSKESMAS FLOW:
Browser
  → GET /api/posyandu (jadwal module — filtered by puskesmasId)
  → POST /api/jadwal  (jadwal module)
       ↓ INSERT INTO jadwal
       ↓ INSERT INTO slot_sesi × 3  (nomorSesi 1,2,3; jam 08-09, 09-10, 10-11)
  ← 201 { jadwalId, slotSesi[] }
  → GET /api/jadwal   (list for puskesmas — paginated)
```

### Recommended Project Structure (Phase 02 additions)

```
backend/src/
├── modules/
│   ├── posyandu/           ← NEW (minimal: GET list for puskesmas)
│   │   ├── posyandu.routes.ts
│   │   ├── posyandu.controller.ts
│   │   └── posyandu.service.ts
│   ├── jadwal/             ← NEW
│   │   ├── jadwal.routes.ts
│   │   ├── jadwal.controller.ts
│   │   └── jadwal.service.ts
│   ├── antrian/            ← NEW
│   │   ├── antrian.routes.ts
│   │   ├── antrian.controller.ts
│   │   └── antrian.service.ts
│   └── notification/
│       ├── notification.queue.ts    ← EXTEND: add enqueueAntrianWaJob
│       ├── notification.worker.ts   ← EXTEND: handle 'antrian_whatsapp' job
│       └── antrian.job.ts           ← NEW: AntrianJobData interface + job name
├── shared/
│   └── schemas/
│       ├── jadwal.schema.ts         ← NEW: CreateJadwalSchema Zod
│       └── antrian.schema.ts        ← NEW: AmbilAntrianSchema Zod
└── app.ts                           ← EXTEND: mount 3 new routers

frontend/src/
├── pages/
│   ├── citizen/
│   │   ├── CitizenDashboardPage.tsx         ← REPLACE placeholder
│   │   └── antrian/
│   │       ├── PilihTanggalPage.tsx          ← NEW
│   │       ├── PilihSesiPage.tsx             ← NEW
│   │       ├── KonfirmasiAntrianPage.tsx     ← NEW
│   │       └── TiketAntrianPage.tsx          ← NEW
│   └── puskesmas/
│       └── jadwal/
│           └── ManajemenJadwalPage.tsx       ← NEW
├── components/
│   ├── antrian/
│   │   ├── AntrianKalender.tsx              ← NEW
│   │   ├── SesiCard.tsx                     ← NEW
│   │   ├── TiketHeader.tsx                  ← NEW
│   │   ├── CountdownEstimasi.tsx            ← NEW
│   │   ├── StatusAntrian.tsx                ← NEW
│   │   └── BatalkanAntrianDialog.tsx        ← NEW
│   └── jadwal/
│       ├── BuatJadwalDialog.tsx             ← NEW
│       ├── JadwalTable.tsx                  ← NEW
│       └── JadwalCard.tsx                   ← NEW
├── hooks/
│   ├── useAntrianSocket.ts                  ← NEW
│   ├── useJadwalList.ts                     ← NEW
│   ├── useSesiAvailability.ts               ← NEW
│   └── useCountdownEstimasi.ts              ← NEW
├── stores/
│   └── useAntrianStore.ts                   ← NEW
└── lib/
    ├── socket.ts                            ← NEW: singleton socket.io-client
    └── validations/
        └── jadwal.schema.ts                 ← NEW: Zod (FE copy, Zod v4)
```

---

### Pattern 1: Prisma SELECT FOR UPDATE (Race Condition Guard)

**What:** Row-level lock on SlotSesi during antrian creation — prevents two concurrent requests from both succeeding when only 1 slot remains.

**When to use:** `POST /api/antrian/ambil` — the ONLY place in Phase 2 that modifies `SlotSesi.terisi`.

**Critical detail:** `$queryRaw` returns an array. Always destructure with `[slot]`. The returned object from raw SQL has snake_case column names (e.g., `terisi`, `kuota`) matching DB column names, NOT camelCase Prisma field names.

```typescript
// Source: CLAUDE.md §Antrian (KRITIS) + Prisma docs $transaction
// backend/src/modules/antrian/antrian.service.ts

import { prisma } from '../../config/db'
import { io } from '../../config/socket'

export async function ambilAntrian(
  slotId: string,
  balitaId: string,
  wargaId: string
): Promise<{ antrianId: string; nomorUrut: number; estimasiMenit: number }> {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the row — no other transaction can read/write this row until we commit
    const slots = await tx.$queryRaw<Array<{
      id: string; kuota: number; terisi: number;
      jadwal_id: string; durasi_rata_aktual: number | null
    }>>`
      SELECT id, kuota, terisi, jadwal_id, durasi_rata_aktual
      FROM slot_sesi
      WHERE id = ${slotId}
      FOR UPDATE
    `

    const slot = slots[0]
    if (!slot) throw Object.assign(new Error('Slot tidak ditemukan'), { code: 'SLOT_TIDAK_DITEMUKAN' })
    if (slot.terisi >= slot.kuota) throw Object.assign(new Error('Slot penuh'), { code: 'SLOT_PENUH' })

    // 2. Check duplicate: same balita in same slot
    const existing = await tx.antrian.findUnique({
      where: { slotId_balitaId: { slotId, balitaId } },
    })
    if (existing) throw Object.assign(new Error('Sudah terdaftar'), { code: 'SUDAH_DAFTAR' })

    // 3. Increment terisi
    await tx.slotSesi.update({
      where: { id: slotId },
      data: { terisi: { increment: 1 } },
    })
    const nomorUrut = slot.terisi + 1

    // 4. Create Antrian record
    const antrian = await tx.antrian.create({
      data: {
        slotId,
        balitaId,
        wargaId,
        nomorUrut,
        statusAntrian: 'menunggu',
      },
      include: { slotSesi: { include: { jadwal: { include: { posyandu: true } } } } },
    })

    return { antrianId: antrian.id, nomorUrut, estimasiMenit: antrian.slotSesi.jadwal.estimasiDurasiMenit * nomorUrut }
  })
}
```

**After transaction commits:** emit `queue:update` from the service (outside the transaction) and enqueue WA job.

[ASSUMED] The exact `$queryRaw` column name casing for snake_case return — verified by inspection of Prisma docs pattern; actual column names confirmed from `prisma/schema.prisma` `@@map` directives.

---

### Pattern 2: Socket.IO Room Management

**What:** Queue status room `sesi:{slotId}` — citizen joins on tiket screen mount, server broadcasts on state changes.

**Backend emit (from antrian.service.ts):**

```typescript
// Source: CLAUDE.md §Socket.IO Events + backend/src/config/socket.ts
import { io } from '../../config/socket'

async function broadcastQueueUpdate(slotId: string): Promise<void> {
  if (!io) return // io is undefined until initSocket() called

  // Fetch current antrian list for the slot
  const antrianList = await prisma.antrian.findMany({
    where: { slotId, statusAntrian: { in: ['menunggu', 'dipanggil'] } },
    orderBy: { nomorUrut: 'asc' },
    select: { id: true, nomorUrut: true, statusAntrian: true },
  })

  const slot = await prisma.slotSesi.findUnique({
    where: { id: slotId },
    select: { durasiRataAktual: true },
  })

  // Payload per CLAUDE.md spec
  io.to(`sesi:${slotId}`).emit('queue:update', {
    nomorAktif: 0,          // Phase 2: always 0; Phase 3 updates this
    durasiRataAktual: slot?.durasiRataAktual ?? null,
    antrianList,
  })
}
```

**Backend server-side room join (in socket.ts or a queue.socket.ts helper):**

Extend `socket.ts` `server.on('connection')` handler to listen for `queue:join`:

```typescript
// Source: CLAUDE.md §Socket.IO Events
socket.on('queue:join', ({ slotId, antrianId }: { slotId: string; antrianId: string }) => {
  void socket.join(`sesi:${slotId}`)
  logger.debug({ socketId: socket.id, slotId, antrianId }, 'Citizen joined queue room')
})
```

**Frontend — socket singleton (frontend/src/lib/socket.ts):**

```typescript
// Source: socket.io-client docs — singleton pattern
import { io } from 'socket.io-client'

// Connect once; share across components
export const socket = io({
  path: '/socket.io',
  withCredentials: true,
  autoConnect: false,   // Connect only when TiketAntrianPage mounts
})
```

**Frontend — useAntrianSocket hook:**

```typescript
// Source: established hook pattern from frontend/src/hooks/
import { useEffect } from 'react'
import { socket } from '@/lib/socket'
import { useQueryClient } from '@tanstack/react-query'

interface QueueUpdate {
  nomorAktif: number
  durasiRataAktual: number | null
  antrianList: Array<{ id: string; nomorUrut: number; statusAntrian: string }>
}

export function useAntrianSocket(slotId: string, antrianId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    socket.connect()
    socket.emit('queue:join', { slotId, antrianId })

    socket.on('queue:update', (data: QueueUpdate) => {
      // Invalidate the TanStack Query cache for this antrian
      void queryClient.invalidateQueries({ queryKey: ['antrian', antrianId] })
      // Also store in a ref or state for countdown compute
    })

    return () => {
      socket.off('queue:update')
      socket.disconnect()
    }
  }, [slotId, antrianId, queryClient])
}
```

**Do NOT leave the room on browser tab hide** (UI-SPEC rule). Only disconnect on unmount.

---

### Pattern 3: BullMQ Extension for Antrian WA Notification

**What:** Extend the existing notification queue with a new job type for antrian confirmation WA.

**New file — backend/src/modules/notification/antrian.job.ts:**

```typescript
// Source: mirrors otp.job.ts pattern
export interface AntrianJobData {
  nomorPonsel: string
  nomorUrut: number
  estimasiMenit: number
  namaPosyandu: string
  tanggalPelaksanaan: string  // DD/MM/YYYY format
  labelSesi: string           // "Sesi 1 (08:00 - 09:00)"
}

export const ANTRIAN_WA_JOB_NAME = 'antrian_whatsapp' as const
```

**Extend notification.queue.ts** — add `enqueueAntrianWaJob`:

```typescript
// Source: mirrors enqueueOtpJob pattern
export async function enqueueAntrianWaJob(data: AntrianJobData): Promise<void> {
  await notificationQueue.add(ANTRIAN_WA_JOB_NAME, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },  // 1s, 5s, 30s — CLAUDE.md rule
  })
}
```

**Extend notification.worker.ts** — add handler in the worker callback:

```typescript
if (job.name === ANTRIAN_WA_JOB_NAME) {
  const data = job.data as AntrianJobData
  const message = `Nomor antrian Anda: *${String(data.nomorUrut).padStart(2, '0')}*\n` +
    `${data.namaPosyandu} - ${data.tanggalPelaksanaan}\n${data.labelSesi}\n` +
    `Estimasi tunggu: ±${data.estimasiMenit} menit.\n` +
    `Harap hadir tepat waktu.`
  // same Fonnte fetch pattern as OTP
}
```

---

### Pattern 4: SlotSesi Auto-Generation Algorithm

**When Puskesmas creates a Jadwal, the backend service must atomically create 3 SlotSesi.**

```typescript
// Source: CONTEXT.md §Phase Boundary + CLAUDE.md §Antrian
const SESI_CONFIG = [
  { nomorSesi: 1, label: 'Sesi 1 (08:00 - 09:00)', mulai: { h: 8, m: 0 }, selesai: { h: 9, m: 0 } },
  { nomorSesi: 2, label: 'Sesi 2 (09:00 - 10:00)', mulai: { h: 9, m: 0 }, selesai: { h: 10, m: 0 } },
  { nomorSesi: 3, label: 'Sesi 3 (10:00 - 11:00)', mulai: { h: 10, m: 0 }, selesai: { h: 11, m: 0 } },
]

export async function createJadwal(data: CreateJadwalInput, puskesmasId: string) {
  const kuota = Math.floor(60 / data.estimasiDurasiMenit)

  // Use prisma.$transaction to ensure atomic create
  return prisma.$transaction(async (tx) => {
    const jadwal = await tx.jadwal.create({
      data: {
        posyanduId: data.posyanduId,
        puskesmasId,
        tanggalPelaksanaan: new Date(data.tanggalPelaksanaan),
        estimasiDurasiMenit: data.estimasiDurasiMenit,
        statusJadwal: 'aktif',  // requires schema migration (see §Common Pitfalls)
      },
    })

    const slots = SESI_CONFIG.map(s => ({
      jadwalId: jadwal.id,
      nomorSesi: s.nomorSesi,
      labelSesi: s.label,
      jamMulai: buildTimeDate(s.mulai.h, s.mulai.m),
      jamSelesai: buildTimeDate(s.selesai.h, s.selesai.m),
      kuota,
      terisi: 0,
    }))

    await tx.slotSesi.createMany({ data: slots })
    return jadwal
  })
}

// Prisma @db.Time requires a Date object — only time portion is stored
function buildTimeDate(hours: number, minutes: number): Date {
  const d = new Date(0)           // 1970-01-01T00:00:00.000Z
  d.setUTCHours(hours, minutes, 0, 0)
  return d
}
```

---

### Pattern 5: TanStack Query Hooks Pattern (from Phase 01)

```typescript
// Source: frontend/src/hooks/useWilayah.ts — established pattern
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/axios'

// GET available jadwal for a date (citizen flow)
export function useJadwalTersedia(tanggal: string | null) {
  return useQuery({
    queryKey: ['jadwal', 'tersedia', tanggal],
    queryFn: () =>
      apiClient.get('/jadwal/tersedia', { params: { tanggal } }).then(r => r.data.data),
    enabled: !!tanggal,
    staleTime: 30_000,  // 30s — slot availability changes frequently
  })
}

// POST ambil antrian — mutation
export function useAmbilAntrian() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { slotId: string; balitaId: string }) =>
      apiClient.post('/antrian/ambil', body).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['antrian', 'saya'] })
    },
  })
}
```

---

### Pattern 6: Zustand Antrian Store (transient nav state only)

```typescript
// Source: frontend/src/stores/useAuthStore.ts — established pattern
import { create } from 'zustand'

interface AntrianState {
  selectedDate: string | null        // 'YYYY-MM-DD'
  selectedSlotId: string | null
  selectedBalitaId: string | null
  setSelectedDate: (date: string | null) => void
  setSelectedSlotId: (slotId: string | null) => void
  setSelectedBalitaId: (balitaId: string | null) => void
  reset: () => void
}

export const useAntrianStore = create<AntrianState>((set) => ({
  selectedDate: null,
  selectedSlotId: null,
  selectedBalitaId: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedSlotId: (slotId) => set({ selectedSlotId: slotId }),
  setSelectedBalitaId: (balitaId) => set({ selectedBalitaId: balitaId }),
  reset: () => set({ selectedDate: null, selectedSlotId: null, selectedBalitaId: null }),
}))
```

**Rule:** Do NOT persist this store. Clear it after successful antrian creation.

---

### Pattern 7: Role Guard for Frontend Routes

**Current state:** `ProtectedRoute` only checks `isAuthenticated` — no role check.
**Required:** Citizen antrian routes and Puskesmas jadwal route need role-level protection.

**Extend ProtectedRoute or create RoleGuard:**

```typescript
// frontend/src/router/ProtectedRoute.tsx — EXTEND
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: RolePengguna[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />
  }
  return children as JSX.Element
}
```

Usage in router:
```tsx
<Route path="/citizen/antrian/*" element={
  <ProtectedRoute allowedRoles={['citizen']}>
    <CitizenAntrianRoutes />
  </ProtectedRoute>
} />
<Route path="/puskesmas/jadwal" element={
  <ProtectedRoute allowedRoles={['puskesmas']}>
    <ManajemenJadwalPage />
  </ProtectedRoute>
} />
```

---

### Pattern 8: Backend Role Guard Middleware

```typescript
// Reusable role guard for Express — add to shared/middleware/
import type { Response, NextFunction } from 'express'
import type { RolePengguna } from '@prisma/client'
import type { AuthRequest } from './auth.middleware'

export function requireRole(...roles: RolePengguna[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Anda tidak memiliki akses ke endpoint ini.',
      })
      return
    }
    next()
  }
}
```

Usage: `jadwalRouter.post('/', authMiddleware, requireRole('puskesmas'), createJadwalHandler)`

---

### Anti-Patterns to Avoid

- **Anti-pattern: Calling Fonnte directly in antrian.service.ts** — Always enqueue via BullMQ. Direct Fonnte calls bypass retry logic and block the request cycle. [CLAUDE.md]
- **Anti-pattern: Prisma `update` without SELECT FOR UPDATE** — Using `prisma.slotSesi.update({ where: { id }, data: { terisi: { increment: 1 } } })` without a transaction allows two concurrent requests to both read `terisi=7`, both see `7 < 8`, and both create antrian records — race condition. [CLAUDE.md]
- **Anti-pattern: Storing antrian data in Zustand** — Zustand (`useAntrianStore`) holds transient nav state only (selectedDate, selectedSlotId, selectedBalitaId). Antrian data (nomorUrut, statusAntrian, etc.) must come from TanStack Query cache, not Zustand. [CLAUDE.md + 02-UI-SPEC.md]
- **Anti-pattern: Absolute time display in countdown** — Never display "08:14 WIB" as the estimated service time. Always "±14 menit". [CLAUDE.md + QUEUE-03]
- **Anti-pattern: socket.leave() on tab hide** — Do not leave the socket room when the browser tab is backgrounded. Only leave on component unmount. [02-UI-SPEC.md]
- **Anti-pattern: Using `io` before `initSocket()` is called** — `io` is `undefined | Server`. Always guard: `if (!io) return`. [backend/src/config/socket.ts — verified pattern]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row-level locking | Custom Redis lock / flag columns | `prisma.$transaction + $queryRaw FOR UPDATE` | Redis lock has TTL edge cases; DB lock is transactional, auto-releases on commit/rollback |
| WA notification retry | Custom setTimeout retry loop | BullMQ job options `{ attempts: 3, backoff: { type: 'exponential', delay: 1000 } }` | BullMQ handles Redis persistence across restarts; setTimeout retry is lost on crash |
| Socket.IO pub/sub across containers | Custom Redis pub/sub | `@socket.io/redis-adapter` (already configured) | Already set up in `backend/src/config/socket.ts`; do not duplicate |
| Calendar date picker | Custom calendar component | shadcn `<Calendar>` | Accessibility, keyboard navigation, locale formatting |
| Form state management | `useState` per field | React Hook Form + Zod | Validation, error display, performance |
| Status color mapping | Inline style objects | CSS class map (`{ menunggu: 'bg-blue-50 text-blue-600 border-blue-200', ... }`) | Consistent with design token table in 02-UI-SPEC.md |

**Key insight:** The SELECT FOR UPDATE is the critical correctness guarantee. Any custom approach (optimistic locks, Redis distributed locks, DB-level unique constraints alone) has edge cases that Prisma transactions + PostgreSQL advisory locks don't. Always use the mandated pattern.

---

## Critical Schema Findings (REQUIRES PRISMA MIGRATION)

### Finding 1: `StatusAntrian` Missing 'dibatalkan' [VERIFIED: prisma/schema.prisma]

Current enum values: `menunggu | dipanggil | selesai | ditangguhkan | tidak_hadir`

Decision D-06 requires `statusAntrian = 'dibatalkan'` for the cancel flow. UI-SPEC has color token for 'dibatalkan' status. The schema does NOT have this value.

**Required migration:** Add `dibatalkan` to `StatusAntrian` enum.

```sql
-- In a new Prisma migration
ALTER TYPE "StatusAntrian" ADD VALUE 'dibatalkan';
```

Via Prisma: update `prisma/schema.prisma` enum, then run `npx prisma migrate dev --name add-dibatalkan-status`.

### Finding 2: `StatusJadwal` Missing 'aktif' [VERIFIED: prisma/schema.prisma]

Current enum values: `draft | terkunci | selesai | dibatalkan`

UI-SPEC jadwal table shows badge values: DRAFT | AKTIF | DIKUNCI. When Puskesmas creates a jadwal (Phase 2), it should immediately be 'aktif' (published/visible to citizens). The schema has no 'aktif' value — it would default to 'draft'.

**Required migration:** Add `aktif` to `StatusJadwal` enum.

Both migrations must run in **Wave 0** before any backend module implementation.

### Finding 3: `Warga.posyanduUtamaId` Field Name [VERIFIED: prisma/schema.prisma]

CLAUDE.md and some comments use `posyanduId` but the actual Prisma model uses `posyanduUtamaId`. All queries in antrian service must use `posyanduUtamaId`:

```typescript
const warga = await prisma.warga.findUnique({
  where: { id: wargaId },
  select: { posyanduUtamaId: true, nomorPonsel: true },
})
if (!warga?.posyanduUtamaId) throw Error('POSYANDU_BELUM_DIPILIH')
```

---

## Common Pitfalls

### Pitfall 1: $queryRaw Returns snake_case Column Names
**What goes wrong:** Accessing `slot.terisi` works but `slot.jadwalId` fails — the raw query returns `jadwal_id` (snake_case from DB), not `jadwalId` (camelCase from Prisma).
**Why it happens:** `$queryRaw` bypasses Prisma's column name mapping. Only the Prisma fluent API (findMany, findUnique, etc.) does camelCase conversion.
**How to avoid:** In `$queryRaw` SELECT statements, alias snake_case columns or type the return interface with snake_case names (`jadwal_id`, `durasi_rata_aktual`).
**Warning signs:** `slot.jadwalId === undefined` when you expect a value.

### Pitfall 2: Prisma @db.Time and Timezone Issues
**What goes wrong:** `jamMulai` stored as `08:00:00` in DB but read back as `1970-01-01T08:00:00.000Z` (UTC) — timezone offset in local time may shift the displayed hour.
**Why it happens:** Prisma maps `@db.Time` to a full `Date` object in JavaScript; the date component is arbitrary (1970-01-01). If the app's timezone is not UTC, `toLocaleTimeString()` may show 09:00 for an 08:00 value.
**How to avoid:** Always format time using `toUTCString()` or `date.toISOString().substring(11, 16)` to get the UTC hours — which match what was stored.
**Warning signs:** Session times off by N hours in the UI.

### Pitfall 3: `io` is undefined Before `initSocket()` Runs
**What goes wrong:** antrian.service.ts imports `io` from socket.ts — if the service is called during startup before `initSocket()` completes, `io` is `undefined`, and `io.to(...).emit(...)` throws.
**Why it happens:** `io` is a module-level variable set lazily by `initSocket()`. Any early call (e.g., during seed or health check) runs before Socket.IO initializes.
**How to avoid:** Always guard: `if (!io) { logger.warn('Socket.IO not ready — skipping broadcast'); return }`. Never assert `io!`.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'to')`.

### Pitfall 4: Duplicate antrian — missing unique constraint check inside transaction
**What goes wrong:** Citizen submits antrian twice rapidly (double-tap); both slip past the terisi<kuota check, creating 2 antrian records for the same (slotId, balitaId).
**Why it happens:** The `@@unique([slotId, balitaId])` constraint on Antrian model IS in the schema — but if the check is done with findUnique inside the transaction (before the FOR UPDATE lock covers antrian rows), two concurrent transactions could both proceed.
**How to avoid:** The DB unique constraint on `antrian(slotId, balitaId)` is the final safety net. Catch `P2002` Prisma unique violation error and return 409 `SUDAH_DAFTAR`.
**Warning signs:** Prisma error code `P2002` on antrian.create() — handle explicitly in controller.

### Pitfall 5: Cancel antrian decrement without guard
**What goes wrong:** `PATCH /api/antrian/:id/batalkan` decrements `slot_sesi.terisi` but only the requesting warga's antrian should be cancellable. If any authenticated user can cancel, a bad actor can cancel others' antrian.
**Why it happens:** Forgetting to verify `antrian.wargaId === req.user.userId` before updating.
**How to avoid:** Always verify ownership: `const antrian = await prisma.antrian.findFirst({ where: { id, wargaId: req.user.userId } })`.
**Warning signs:** 200 response on cancel requests from different warga accounts.

### Pitfall 6: Socket broadcast inside Prisma transaction
**What goes wrong:** `io.to(...).emit(...)` called inside `prisma.$transaction()` before the transaction commits — if the transaction later rolls back, clients receive an update for data that was never persisted.
**Why it happens:** The broadcast is async and fires immediately on call; it doesn't wait for DB commit.
**How to avoid:** ALWAYS broadcast after the transaction resolves (outside the `prisma.$transaction(async tx => {...})` block). Return data from the transaction, broadcast in the outer scope.
**Warning signs:** Socket clients showing updates that don't match DB state.

---

## API Endpoints Required

All endpoints except `/api/auth/*` are protected by `authMiddleware`. Role guards apply as noted.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /api/posyandu | puskesmas | List posyandu assigned to auth puskesmas |
| POST | /api/jadwal | puskesmas | Create jadwal + auto-gen 3 SlotSesi |
| GET | /api/jadwal | puskesmas | List jadwal for auth puskesmas (paginated) |
| GET | /api/jadwal/tersedia | citizen | List jadwal dates with open slots for citizen's posyanduUtamaId |
| GET | /api/sesi | citizen | List SlotSesi for a specific jadwalId (citizen picks session) |
| POST | /api/antrian/ambil | citizen | Take a queue slot — SELECT FOR UPDATE |
| PATCH | /api/antrian/:id/batalkan | citizen | Cancel antrian (own only) |
| GET | /api/antrian/saya | citizen | Citizen's active antrian today |
| GET | /api/antrian/:id | citizen | Specific antrian detail (tiket screen) |

**App.ts registration:**
```typescript
app.use('/api/posyandu', posyanduRouter)
app.use('/api/jadwal', jadwalRouter)
app.use('/api/antrian', antrianRouter)
```

---

## Code Examples

### Countdown Computation (Frontend)

```typescript
// Source: CONTEXT.md D-03 + 02-UI-SPEC.md §Real-Time Countdown Logic
// frontend/src/components/antrian/CountdownEstimasi.tsx

interface CountdownInput {
  nomorUrut: number
  nomorAktif: number         // Always 0 in Phase 2
  estimasiDurasiMenit: number
  durasiRataAktual: number | null
}

export function computeCountdown({ nomorUrut, nomorAktif, estimasiDurasiMenit, durasiRataAktual }: CountdownInput): number {
  const durasi = durasiRataAktual ?? estimasiDurasiMenit
  return Math.max(0, (nomorUrut - nomorAktif) * durasi)
}

// Display: `±${Math.round(minutesLeft)} menit`
// Color: minutesLeft < 5 → text-amber-600; else text-foreground
// "estimasi" caption ALWAYS visible below the figure
```

### Buat Jadwal Dialog — Preview Slots (Frontend)

```typescript
// Source: 02-UI-SPEC.md Screen 6
// Computed client-side, display-only (not sent to server)
function previewSlots(estimasiDurasiMenit: number) {
  const kuota = Math.floor(60 / estimasiDurasiMenit)
  return [
    { sesi: 1, jam: '08:00 – 09:00', kuota },
    { sesi: 2, jam: '09:00 – 10:00', kuota },
    { sesi: 3, jam: '10:00 – 11:00', kuota },
  ]
}
```

### Error Code → HTTP Status Mapping (Backend)

```typescript
// Pattern from auth.controller.ts — apply in antrian.controller.ts
const ERROR_MAP: Record<string, number> = {
  SLOT_PENUH: 409,
  SUDAH_DAFTAR: 409,
  JADWAL_SUDAH_ADA: 409,
  SLOT_TIDAK_DITEMUKAN: 404,
  ANTRIAN_TIDAK_DITEMUKAN: 404,
  POSYANDU_BELUM_DIPILIH: 400,
  FORBIDDEN: 403,
}
```

### Queue Update Broadcast Payload (per CLAUDE.md)

```typescript
// Source: CLAUDE.md §Socket.IO Events
io.to(`sesi:${slotId}`).emit('queue:update', {
  nomorAktif: 0,           // Phase 2 always 0
  durasiRataAktual: null,  // Phase 2 always null (no Phase 3 moving average yet)
  antrianList: [
    { id: string, nomorUrut: number, statusAntrian: string }
  ]
})
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual Redis lock for race condition | Prisma `$transaction` + `SELECT FOR UPDATE` | DB-native locking; no Redis lock TTL edge cases |
| Direct Fonnte API call in request handler | BullMQ job enqueue + worker | Async delivery, retry, no request blocking |
| Polling for queue status | Socket.IO room subscription | Real-time, no server polling overhead |
| Shared npm package for FE+BE Zod schemas | Backend schemas in `shared/schemas/`, FE copies in `lib/validations/` | Works within the monorepo structure; no hoisting complexity |

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|-------------|-----------|-------|
| PostgreSQL 16 | SELECT FOR UPDATE | ✓ | Running in Docker (sispos-db) — confirmed Phase 01 |
| Redis 7 | Socket.IO adapter + BullMQ | ✓ | Running in Docker (sispos-redis) — confirmed Phase 01 |
| Socket.IO server | queue:update broadcast | ✓ | Initialized in backend/src/config/socket.ts |
| socket.io-client ^4.7.5 | TiketAntrianPage | ✓ | In frontend/package.json — not yet used in any component |
| BullMQ ^5.7.0 | WA notification job | ✓ | In backend/package.json — notification module active |
| Fonnte API | WA delivery | Conditional | FONNTE_API_KEY in docker-compose.yml; delivery may fail if key is test key |
| shadcn CLI | calendar/dialog/etc install | ✓ | shadcn already initialized (components.json confirmed Phase 01) |

**Missing with no fallback:** None identified.

**Conditional:** Fonnte API — if FONNTE_API_KEY is invalid, BullMQ jobs will fail after 3 retries and log errors. The antrian creation itself succeeds; only WA notification fails. This is acceptable for Phase 2 testing (BullMQ log shows enqueue + failure, which satisfies success criterion 5).

---

## Validation Architecture

> `workflow.nyquist_validation: true` in .planning/config.json — section required.

### Test Framework

No test framework is installed in either the frontend or backend (`package.json` has no jest, vitest, mocha, or similar dependencies). Phase 2 validation is manual.

| Property | Value |
|----------|-------|
| Framework | None installed — manual verification only |
| Config file | None |
| Quick run command | Manual: open 2 browser tabs simultaneously |
| Full suite command | Manual: walk through all 5 success criteria |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| QUEUE-01 | Jadwal created → 3 SlotSesi in DB | manual | `curl -X POST /api/jadwal` + Prisma Studio query | Verify terisi=0, kuota=floor(60/7)=8 |
| QUEUE-02 | 2 tabs ambil slot sisa 1 → 1 succeeds, 1 gets 409 | manual | Open 2 browser tabs to KonfirmasiAntrianPage simultaneously | Exact race condition test |
| QUEUE-03 | Tiket shows "±14 menit" label (never absolute time) | manual | Visual inspection of TiketAntrianPage | Check "±" prefix + "estimasi" caption |
| QUEUE-04 | Countdown updates without refresh | manual | Open tiket in tab A; simulate queue update; verify tab A updates | Requires Phase 3 trigger or manual socket emit |
| QUEUE-05 | durasiRataAktual update (DEFERRED) | — | Phase 3 | Not in Phase 2 scope |
| QUEUE-06 | WA job enqueued → BullMQ log | manual | `docker compose logs backend | grep antrian_whatsapp` | Verify job appears in BullMQ queue log |

### Sampling Rate

- **Per task commit:** Open browser, verify the page being implemented renders correctly and calls the API
- **Per wave merge:** Walk through the full user flow for that wave (e.g., Wave 2.1: Puskesmas login → create jadwal → verify 3 slots in DB)
- **Phase gate:** All 5 success criteria verified manually before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Schema migrations: `npx prisma migrate dev --name add-aktif-dan-dibatalkan-status` — covers StatusJadwal.aktif + StatusAntrian.dibatalkan
- [ ] shadcn components: 8 `npx shadcn add` commands
- [ ] `frontend/src/lib/socket.ts` — socket singleton (no test file needed, but must exist before any hook uses it)

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"`

### Applicable ASVS Categories (Phase 02)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT httpOnly cookie via existing authMiddleware |
| V3 Session Management | partial | Existing JWT refresh/logout — no new session logic in Phase 2 |
| V4 Access Control | yes | requireRole('citizen') / requireRole('puskesmas') on all queue/jadwal endpoints |
| V5 Input Validation | yes | Zod schema validation on all POST/PATCH bodies |
| V6 Cryptography | no | No new encrypted fields in Phase 2 (catatanKonsultasi/rekomendasiAi are Phase 3) |

### Known Threat Patterns for Queue System

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Race condition / slot over-booking | Tampering | SELECT FOR UPDATE inside prisma.$transaction |
| Cancel another citizen's antrian | Elevation of Privilege | Verify `antrian.wargaId === req.user.userId` before update |
| Create jadwal for another puskesmas' posyandu | Tampering | Verify `posyandu.puskesmasId === req.user.userId` in jadwal.service.ts |
| WA number injection in BullMQ job data | Tampering | Use `warga.nomorPonsel` from DB (not from request body) for enqueue |
| Antrian ID enumeration (GET /antrian/:id) | Information Disclosure | Verify `antrian.wargaId === req.user.userId` on GET detail |
| Slot kuota overflow | Tampering | SELECT FOR UPDATE is the primary guard; also validate `terisi < kuota` after lock |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `$queryRaw` returns snake_case column names matching `@@map` directives in schema | Pattern 1 | Column access will be undefined; fix by aliasing in SQL or adjusting interface types |
| A2 | Prisma `@db.Time` values can be written as `new Date(0)` with UTC hours set and read back correctly | Pattern 4 | Time values off by timezone offset; fix by using UTC-aware formatting |
| A3 | BullMQ exponential backoff with `delay: 1000` produces 1s/5s/30s delays (not 1s/2s/4s) | Pattern 3 | Backoff timing differs from CLAUDE.md spec; verify with BullMQ v5 docs |
| A4 | shadcn `npx shadcn add calendar` installs the DayPicker-based calendar component compatible with react-router v6 | Standard Stack | Calendar may have peer dependency issues; test after install |
| A5 | Frontend Zod v4 and backend Zod v3 schema syntax differences are limited to minor API changes (z.string().min etc. unchanged) | Standard Stack | Schema copy between FE/BE may have incompatibilities in edge cases |

---

## Open Questions

1. **Posyandu module scope**
   - What we know: Puskesmas form needs `GET /api/posyandu` to list posyandu assigned to them; citizen tiket needs posyandu name.
   - What's unclear: Should posyandu be its own module or inline query in jadwal/antrian services?
   - Recommendation: Create a minimal `posyandu` module with 1 endpoint (`GET /api/posyandu`) protected by puskesmas role. Citizen-facing posyandu data (name, address) is returned via the jadwal/antrian join queries — no separate citizen posyandu endpoint needed.

2. **GET /api/jadwal/tersedia date filtering**
   - What we know: Citizen sees calendar for their posyandu; dates with open slots get green dots.
   - What's unclear: Does the endpoint return a list of dates with slots for the full month, or per-date slot data?
   - Recommendation: Return list of available dates for a month (`GET /api/jadwal/tersedia?bulan=2026-07`), then a separate `GET /api/sesi?jadwalId=X` for the slot picker. This matches the two-step flow (pilih tanggal → pilih sesi).

3. **BullMQ `parseBullMQConnection()` duplication**
   - What we know: `notification.queue.ts` and `notification.worker.ts` both define this function identically.
   - What's unclear: Should Phase 2 work centralize it to avoid triplication (antrian job adds a third user)?
   - Recommendation: Extract to `backend/src/config/bullmq.ts` as a shared helper. Low-risk refactor with high payoff for maintainability.

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` — All Prisma models, enums, field names, constraints verified
- `backend/src/config/socket.ts` — Socket.IO initialization pattern, `io` export, `undefined | Server` type
- `backend/src/modules/notification/notification.queue.ts` — BullMQ queue setup, job options, parseBullMQConnection pattern
- `backend/src/modules/notification/notification.worker.ts` — Worker job handler pattern, Fonnte call pattern
- `backend/src/shared/middleware/auth.middleware.ts` — AuthRequest type, authMiddleware pattern
- `frontend/src/hooks/useWilayah.ts` — TanStack Query hook pattern (queryKey, queryFn, enabled, staleTime)
- `frontend/src/stores/useAuthStore.ts` — Zustand store with persist pattern
- `frontend/src/router/ProtectedRoute.tsx` — Current ProtectedRoute implementation (no role check yet)
- `frontend/src/lib/axios.ts` — Axios interceptor + 401 refresh pattern
- `frontend/src/lib/queryClient.ts` — QueryClient default options
- `frontend/package.json` — All FE dependencies and versions confirmed
- `backend/package.json` — All BE dependencies and versions confirmed
- `.planning/phases/02-queue-system/02-CONTEXT.md` — Locked decisions D-01 through D-08
- `.planning/phases/02-queue-system/02-UI-SPEC.md` — Screen contracts, component inventory, copywriting contract
- `CLAUDE.md` — All mandatory rules, tech stack, Socket.IO event spec

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — QUEUE-01 through QUEUE-06 requirement descriptions
- `.planning/ROADMAP.md` — Wave 2.1, 2.2, 2.3 structure

### Tertiary (LOW confidence)
- None — all claims verified from codebase source files

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from package.json
- Schema and data model: HIGH — verified from prisma/schema.prisma (including identified gaps)
- Architecture patterns: HIGH — derived from Phase 01 codebase inspection
- Pitfalls: HIGH — derived from code analysis + Prisma/Socket.IO known behaviors
- Countdown math: HIGH — verified against CONTEXT.md D-03 and UI-SPEC
- BullMQ retry timing: MEDIUM — A3 assumption about 1s/5s/30s backoff progression

**Research date:** 2026-07-01
**Valid until:** 2026-07-15 (stable stack, no fast-moving dependencies)
