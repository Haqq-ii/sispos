---
phase: 02-queue-system
plan: "04"
subsystem: frontend-shared-infrastructure
tags: [zustand, tanstack-query, zod, react-hooks, protected-route, countdown, rbac]
dependency_graph:
  requires:
    - 02-03 (antrian backend endpoints — POST /api/antrian/ambil, PATCH /api/antrian/:id/batalkan, GET /api/antrian/saya)
    - 02-02 (jadwal backend endpoints — GET /api/jadwal, GET /api/jadwal/tersedia, GET /api/sesi)
  provides:
    - ProtectedRoute with allowedRoles?: RolePengguna[] defense-in-depth role guard
    - useAntrianStore: ephemeral Zustand wizard nav state (selectedDate/selectedSlotId/selectedBalitaId + reset)
    - CreateJadwalFESchema: Zod v4 schema with estimasiDurasiMenit min(5)/max(30)
    - useJadwalList: TanStack Query hook for GET /jadwal (puskesmas list)
    - useJadwalTersedia(bulan): TanStack Query hook with enabled: !!bulan guard
    - useSesiAvailability(jadwalId): TanStack Query hook with enabled: !!jadwalId guard
    - useAmbilAntrian: mutation POST /antrian/ambil
    - useBatalkanAntrian: mutation PATCH /antrian/:id/batalkan
    - computeCountdown pure function: (nomorUrut - nomorAktif) × (durasiRataAktual ?? estimasiDurasiMenit)
    - useCountdownEstimasi React hook with mandatory ± prefix in displayText
  affects:
    - 02-05 (PilihTanggalPage imports useJadwalTersedia + useAntrianStore)
    - 02-06 (PilihSesiPage + KonfirmasiPage imports useSesiAvailability + useAmbilAntrian + useAntrianStore)
    - 02-07 (TiketAntrianPage imports useCountdownEstimasi + useBatalkanAntrian)
    - 02-08 (ManajemenJadwalPage imports useJadwalList + CreateJadwalFESchema)
tech_stack:
  added: []
  patterns:
    - Zustand create() without persist() — ephemeral transient wizard state
    - TanStack Query enabled guard pattern (enabled: !!param) — prevent premature API calls
    - computeCountdown pure function separated from React hook — independently testable
    - ProtectedRoute allowedRoles second guard after isAuthenticated check (defense-in-depth)
key_files:
  created:
    - frontend/src/stores/useAntrianStore.ts
    - frontend/src/lib/validations/jadwal.schema.ts
    - frontend/src/hooks/useJadwalList.ts
    - frontend/src/hooks/useSesiAvailability.ts
    - frontend/src/hooks/useCountdownEstimasi.ts
  modified:
    - frontend/src/router/ProtectedRoute.tsx
decisions:
  - "useAntrianStore intentionally has no persist() — wizard state resets on tab close is correct behavior; antrian data from TanStack Query only"
  - "computeCountdown separated as pure function for independent testability; useCountdownEstimasi wraps it for React lifecycle"
  - "± prefix hardcoded in displayText — countdown is estimate not promise (QUEUE-03 requirement + CLAUDE.md)"
  - "useJadwalTersedia enabled: !!bulan — calendar not yet rendered means no month selected; no premature API call"
  - "useSesiAvailability staleTime 15s — slot availability changes frequently; short cache reduces stale kuota display"
metrics:
  duration: "~3 menit"
  completed_date: "2026-07-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 04: Frontend Shared Infrastructure — ProtectedRoute + Stores + Hooks Summary

**One-liner:** Frontend shared infrastructure layer: ProtectedRoute extended with allowedRoles RBAC guard, ephemeral Zustand antrian wizard store, Zod jadwal FE schema, TanStack Query hooks for jadwal/sesi with enabled guards, and countdown computation (pure function + React hook) with mandatory ± prefix.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ProtectedRoute extension + useAntrianStore + jadwal FE Zod schema | 179da10 | ProtectedRoute.tsx, useAntrianStore.ts, jadwal.schema.ts |
| 2 | TanStack Query hooks — useJadwalList, useJadwalTersedia, useSesiAvailability, mutations, useCountdownEstimasi | b90620b | useJadwalList.ts, useSesiAvailability.ts, useCountdownEstimasi.ts |

## What Was Built

### Task 1 — ProtectedRoute + useAntrianStore + jadwal.schema.ts

**`frontend/src/router/ProtectedRoute.tsx`** (modified):
- Added `allowedRoles?: RolePengguna[]` to `ProtectedRouteProps` interface
- Imports `RolePengguna` type from `@/stores/useAuthStore`
- Destructures `{ isAuthenticated, user }` from `useAuthStore()`
- First guard: `if (!isAuthenticated)` → redirect `/login` (existing behavior preserved)
- Second guard: `if (allowedRoles && user && !allowedRoles.includes(user.role))` → redirect `/login`
- Defense-in-depth only — server's `requireRole()` middleware is authoritative gate

**`frontend/src/stores/useAntrianStore.ts`** (new):
- `AntrianState` interface: `selectedDate: string | null`, `selectedSlotId: string | null`, `selectedBalitaId: string | null`
- Setter functions: `setSelectedDate`, `setSelectedSlotId`, `setSelectedBalitaId` (all void)
- `reset()` sets all three fields to null simultaneously
- `create<AntrianState>()` without `persist()` — ephemeral by design
- JSDoc: "Transient navigation state for antrian wizard. Do NOT store antrian data here — use TanStack Query."

**`frontend/src/lib/validations/jadwal.schema.ts`** (new):
- `CreateJadwalFESchema`: Zod object with `posyanduId` (min 1), `tanggalPelaksanaan` (z.date), `estimasiDurasiMenit` (int, min 5, max 30)
- `CreateJadwalFEInput` type inferred from schema

### Task 2 — TanStack Query Hooks

**`frontend/src/hooks/useJadwalList.ts`** (new):
- `useJadwalList()`: `GET /jadwal`, `staleTime: 30_000`, returns `JadwalListItem[]`
- `useJadwalTersedia(bulan)`: `GET /jadwal/tersedia`, `enabled: !!bulan`, `staleTime: 60_000`, returns `JadwalTersediaItem[]`
- Type definitions: `JadwalListItem`, `JadwalTersediaItem`, `SlotSesiItem`

**`frontend/src/hooks/useSesiAvailability.ts`** (new):
- `useSesiAvailability(jadwalId)`: `GET /sesi`, `enabled: !!jadwalId`, `staleTime: 15_000`, returns `SlotSesiDetail[]`
- `useAmbilAntrian()`: `POST /antrian/ambil`, `onSuccess: invalidate ['antrian', 'saya']`
- `useBatalkanAntrian()`: `PATCH /antrian/:id/batalkan`, `onSuccess: invalidate ['antrian']`

**`frontend/src/hooks/useCountdownEstimasi.ts`** (new):
- `CountdownInput` interface: `{ nomorUrut, nomorAktif, estimasiDurasiMenit, durasiRataAktual }`
- `computeCountdown(input)` pure function: `Math.max(0, (nomorUrut - nomorAktif) × (durasiRataAktual ?? estimasiDurasiMenit))`
- `useCountdownEstimasi(nomorUrut, estimasiDurasiMenit, durasiRataAktual)` React hook:
  - `useState` for `minutesLeft`, `useEffect` recomputes when deps change
  - Phase 2: `nomorAktif` hardcoded to 0 (Meja 1 hadir deferred to Phase 3)
  - `displayText = '±' + Math.round(minutesLeft) + ' menit'` — ± prefix mandatory

## Verification Results

| Check | Result |
|-------|--------|
| `allowedRoles` in ProtectedRoute.tsx (grep -c) | 3 (interface, param, includes check) |
| `persist` import in useAntrianStore | PASS — no persist (only comment mentioning it) |
| `estimasiDurasiMenit` in jadwal.schema.ts | 1 (in schema definition) |
| `computeCountdown` in useCountdownEstimasi (grep -c) | 3 (export, definition, usage in hook) |
| `enabled: !!bulan` in useJadwalList | PASS |
| `enabled: !!jadwalId` in useSesiAvailability | PASS |
| `±` prefix in useCountdownEstimasi displayText | PASS |
| Formula verification (3-0)×7=21, (1-1)×7=0, (8-0)×7=56 | PASS (Math.max guard) |

## Deviations from Plan

None — plan executed exactly as written. All hooks follow the `enabled: !!param` pattern. `computeCountdown` exported as pure function. `useAntrianStore` has no `persist()`. `ProtectedRoute` role guard added as second check after `isAuthenticated`.

## Known Stubs

None. This plan produces shared infrastructure only — no UI pages, no placeholder text, no empty data flows. All hooks will be wired to real API calls when enabled guards are satisfied.

## Threat Flags

No new threat surface beyond the planned STRIDE register.
- T-02-16: ProtectedRoute allowedRoles is UI-level defense only — accepted as documented
- T-02-17: useAntrianStore selectedSlotId tampered in DevTools — server verifies via SELECT FOR UPDATE

## Self-Check: PASSED

- [x] frontend/src/router/ProtectedRoute.tsx has allowedRoles in props interface and second guard
- [x] frontend/src/stores/useAntrianStore.ts created, no persist() import, exports selectedDate/selectedSlotId/selectedBalitaId + reset
- [x] frontend/src/lib/validations/jadwal.schema.ts exports CreateJadwalFESchema + CreateJadwalFEInput
- [x] frontend/src/hooks/useJadwalList.ts exports useJadwalList + useJadwalTersedia
- [x] frontend/src/hooks/useSesiAvailability.ts exports useSesiAvailability + useAmbilAntrian + useBatalkanAntrian
- [x] frontend/src/hooks/useCountdownEstimasi.ts exports CountdownInput + computeCountdown + useCountdownEstimasi
- [x] Task 1 commit 179da10 exists
- [x] Task 2 commit b90620b exists
