---
phase: 02-queue-system
plan: "02"
subsystem: jadwal-posyandu-backend
tags: [prisma, express, zod, rbac, transaction, slotSesi, posyandu, jadwal]
dependency_graph:
  requires:
    - 02-01 (requireRole middleware, StatusJadwal.aktif enum)
  provides:
    - CreateJadwalSchema Zod (posyanduId, tanggalPelaksanaan, estimasiDurasiMenit)
    - GET /api/posyandu (puskesmas-scoped)
    - POST /api/jadwal (atomic Jadwal + 3 SlotSesi)
    - GET /api/jadwal (paginated, puskesmas-scoped)
    - GET /api/jadwal/tersedia (citizen posyanduUtamaId-scoped)
    - GET /api/jadwal/sesi alias GET /api/sesi (slot detail with HH:MM time format)
  affects:
    - 02-03: antrian module can POST /api/antrian/ambil using slotSesi.id from GET /api/jadwal/tersedia
    - 02-05: citizen PilihTanggalPage calls GET /api/jadwal/tersedia
    - 02-06: puskesmas ManajemenJadwalPage calls GET /api/jadwal + POST /api/jadwal
tech_stack:
  added: []
  patterns:
    - prisma.$transaction for atomic multi-model create (Jadwal + SlotSesi)
    - new Date(0) + setUTCHours() for @db.Time timezone-safe storage
    - Prisma P2002 unique constraint error caught and re-thrown with domain error code
    - Zod safeParse in controller, service throws domain error codes caught in controller
    - posyandu ownership verification (T-02-04) before createJadwal
key_files:
  created:
    - backend/src/shared/schemas/jadwal.schema.ts
    - backend/src/modules/posyandu/posyandu.service.ts
    - backend/src/modules/posyandu/posyandu.controller.ts
    - backend/src/modules/posyandu/posyandu.routes.ts
    - backend/src/modules/jadwal/jadwal.service.ts
    - backend/src/modules/jadwal/jadwal.controller.ts
    - backend/src/modules/jadwal/jadwal.routes.ts
  modified:
    - backend/src/app.ts (mount posyanduRouter, jadwalRouter, GET /api/sesi alias)
decisions:
  - "GET /api/sesi alias added directly in app.ts (artifacts spec lists /api/sesi, not /api/jadwal/sesi; both paths work)"
  - "getCitizenPosyanduId helper in jadwal.service fetches Warga.posyanduUtamaId — controller stays thin, D-01 enforced at backend"
  - "kuota = Math.floor(60 / estimasiDurasiMenit) — CLAUDE.md §Antrian formula"
  - "SlotSesi times stored as UTC (new Date(0).setUTCHours()) to avoid PostgreSQL @db.Time timezone pitfall"
  - "Prisma.PrismaClientKnownRequestError P2002 → 409 JADWAL_SUDAH_ADA — proper Prisma error class usage"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-07-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 1
---

# Phase 02 Plan 02: Jadwal + Posyandu Backend Summary

**One-liner:** Posyandu module (GET /api/posyandu puskesmas-scoped), Jadwal module (4 endpoints, atomic Jadwal + 3 SlotSesi via prisma.$transaction, kuota=floor(60/estimasiDurasiMenit)), RBAC enforcement via requireRole, and full STRIDE T-02-04..08 mitigation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Shared Jadwal Zod schema + posyandu module | 22d5c5d | jadwal.schema.ts, posyandu.{service,controller,routes}.ts |
| 2 | Jadwal module (4 endpoints + SlotSesi auto-gen) + app.ts | b0696cf | jadwal.{service,controller,routes}.ts, app.ts |

## What Was Built

### Task 1 — Shared Jadwal Zod Schema + Posyandu Module

**`backend/src/shared/schemas/jadwal.schema.ts`**
- `CreateJadwalSchema`: posyanduId (uuid), tanggalPelaksanaan (YYYY-MM-DD regex), estimasiDurasiMenit (int, min 5, max 30)
- `CreateJadwalInput` type inferred from schema
- T-02-08 mitigation: Zod int + min/max rejects out-of-range values with 400 VALIDASI_GAGAL

**Posyandu module** (`posyandu.service.ts`, `posyandu.controller.ts`, `posyandu.routes.ts`)
- `getPosyanduList(puskesmasId)`: prisma.posyandu.findMany WHERE puskesmasId — enforces D-08 (tidak bocorkan posyandu puskesmas lain)
- Route: `GET /` protected by authMiddleware + requireRole('puskesmas')
- Verified: returns 200 with `{ id, namaPosyandu, kelurahan, kecamatan }` for puskesmas; 403 FORBIDDEN for citizen

### Task 2 — Jadwal Module + app.ts

**`jadwal.service.ts`** — 5 exported functions:

1. `createJadwal(data, puskesmasId)`:
   - Security: `prisma.posyandu.findFirst({ where: { id, puskesmasId } })` → throws POSYANDU_TIDAK_DITEMUKAN if check fails (T-02-04)
   - `kuota = Math.floor(60 / estimasiDurasiMenit)`
   - SESI_CONFIG: 3 entries (Sesi 1 08:00-09:00, Sesi 2 09:00-10:00, Sesi 3 10:00-11:00)
   - `prisma.$transaction`: jadwal.create → slotSesi.createMany (3 records) → jadwal.findUnique with include
   - Catches Prisma P2002 → rethrows as JADWAL_SUDAH_ADA

2. `getJadwalList(puskesmasId, page, limit)`: paginated, includes posyandu.namaPosyandu + slotSesi summary

3. `getJadwalTersedia(posyanduId, bulan)`: jadwal aktif for month, each entry includes `hasAvailableSlot: slotSesi.some(s => s.terisi < s.kuota)`

4. `getCitizenPosyanduId(wargaId)`: fetches Warga.posyanduUtamaId for D-01 enforcement

5. `getSesiList(jadwalId)`: returns SlotSesi with jadwal context (time formatted in controller)

**`jadwal.controller.ts`** — 4 handlers:
- `createJadwalHandler`: Zod validation → service call → maps POSYANDU_TIDAK_DITEMUKAN→403, JADWAL_SUDAH_ADA→409
- `getJadwalListHandler`: page/limit query params with bounds (max 50, default 10)
- `getJadwalTersediaHandler`: validates bulan YYYY-MM, calls getCitizenPosyanduId for D-01, returns 422 POSYANDU_BELUM_DIPILIH if null
- `getSesiListHandler`: requires jadwalId query param; destructures jamMulai/jamSelesai and formats via `.toISOString().substring(11, 16)` → "08:00"

**`jadwal.routes.ts`**:
- `POST /` → authMiddleware + requireRole('puskesmas') + createJadwalHandler
- `GET /` → authMiddleware + requireRole('puskesmas') + getJadwalListHandler (T-02-06)
- `GET /tersedia` → authMiddleware + requireRole('citizen') + getJadwalTersediaHandler
- `GET /sesi` → authMiddleware + getSesiListHandler (both roles)

**`app.ts`**:
- `app.use('/api/posyandu', posyanduRouter)`
- `app.use('/api/jadwal', jadwalRouter)`
- `app.get('/api/sesi', authMiddleware, getSesiListHandler)` — alias per artifacts spec

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (backend container) | No errors |
| POST /api/jadwal (puskesmas, estimasiDurasiMenit=7) | 201, 3 SlotSesi kuota=8, terisi=0 |
| POST /api/jadwal duplicate posyanduId+tanggal | 409 JADWAL_SUDAH_ADA |
| POST /api/jadwal as citizen | 403 FORBIDDEN |
| GET /api/posyandu as puskesmas | 200 with posyandu array |
| GET /api/posyandu as citizen | 403 FORBIDDEN |
| GET /api/sesi?jadwalId=X | 3 items, jamMulai="08:00" (HH:MM, not ISO) |
| GET /api/jadwal/tersedia as citizen | 200 with jadwal + hasAvailableSlot |

## Deviations from Plan

### Auto-added Features

**1. [Rule 2 - Missing Critical Functionality] GET /api/sesi alias in app.ts**
- **Found during:** Task 2 implementation
- **Issue:** Plan artifacts spec lists "GET /api/sesi" as an HTTP endpoint, but jadwalRouter registers `GET '/sesi'` which results in path `/api/jadwal/sesi`. The must_have test uses `/api/sesi`.
- **Fix:** Added `app.get('/api/sesi', authMiddleware, getSesiListHandler)` in app.ts as alias. `/api/jadwal/sesi` also works.
- **Files modified:** backend/src/app.ts
- **Commit:** b0696cf

**2. [Rule 2 - Missing Critical Functionality] getCitizenPosyanduId service helper**
- **Found during:** Task 2 — getJadwalTersedia controller implementation
- **Issue:** Plan action says "read query param bulan (required), call getJadwalTersedia" but doesn't specify how posyanduId is obtained. D-01 requires using Warga.posyanduUtamaId (not client-supplied).
- **Fix:** Added `getCitizenPosyanduId(wargaId)` service function; controller uses it to enforce D-01 at backend. Returns 422 POSYANDU_BELUM_DIPILIH if not set.
- **Files modified:** backend/src/modules/jadwal/jadwal.service.ts, jadwal.controller.ts

**3. [Rule 2 - Missing Critical Functionality] bulan query param format validation**
- **Found during:** Task 2 controller implementation
- **Issue:** Plan says "read query param bulan (required)" but doesn't specify validation.
- **Fix:** Added regex `/^\d{4}-\d{2}$/` check in controller; returns 400 VALIDASI_GAGAL if invalid.

## Known Stubs

None. This plan produced backend modules only. No UI data flow, no placeholder text.

## Threat Flags

None. All endpoints are behind authMiddleware. STRIDE threats T-02-04 through T-02-08 are mitigated as planned.

## Self-Check: PASSED
- [x] backend/src/shared/schemas/jadwal.schema.ts exists, exports CreateJadwalSchema + CreateJadwalInput
- [x] backend/src/modules/posyandu/posyandu.service.ts calls prisma.posyandu.findMany WHERE puskesmasId
- [x] backend/src/modules/posyandu/posyandu.routes.ts has requireRole('puskesmas')
- [x] backend/src/modules/jadwal/jadwal.service.ts uses prisma.$transaction for createJadwal
- [x] backend/src/modules/jadwal/jadwal.service.ts has kuota = Math.floor(60 / estimasiDurasiMenit)
- [x] backend/src/modules/jadwal/jadwal.routes.ts uses requireRole on correct endpoints
- [x] backend/src/app.ts mounts posyanduRouter at /api/posyandu and jadwalRouter at /api/jadwal
- [x] Task 1 commit 22d5c5d exists
- [x] Task 2 commit b0696cf exists
- [x] TypeScript: no errors in backend container (npx tsc --noEmit clean)
- [x] Live verification: all 7 test cases passed
