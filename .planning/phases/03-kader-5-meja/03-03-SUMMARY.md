---
phase: 03-kader-5-meja
plan: "03"
subsystem: frontend-kader-foundation
tags: [kader, zustand, socket.io, tanstack-query, react-router, meja1, hadir, tangguhkan, go-show, lock-screen]
dependency_graph:
  requires:
    - 03-02 (queue-kader.service.ts, queue-kader.routes.ts — backend endpoints)
  provides:
    - frontend/src/stores/useKaderMejaStore.ts
    - frontend/src/hooks/useKaderSocket.ts
    - frontend/src/hooks/useActiveMeja.ts
    - frontend/src/pages/kader/KaderDashboardPage.tsx
    - frontend/src/pages/kader/LockScreenPage.tsx
    - frontend/src/pages/kader/meja/Meja1Page.tsx
    - frontend/src/router/index.tsx (8 new kader routes)
  affects:
    - backend/src/modules/queue/queue-kader.service.ts (getTodaySlots added)
    - backend/src/modules/queue/queue-kader.controller.ts (getTodaySlotsHandler added)
    - backend/src/modules/queue/queue-kader.routes.ts (GET /api/kader/today-slots added)
tech_stack:
  added: []
  patterns:
    - Zustand persist middleware with partialize — isLocked only; activeMeja/activeSlotId transient
    - useKaderSocket analog of useAntrianSocket — same 3 mandatory rules (connect on mount, disconnect on unmount only, guard if !slotId)
    - useActiveMeja staleTime:0 refetchOnMount:true — Redis as source of truth for lock-screen
    - Client-side groupBy RT using Array.reduce
    - Reload-recovery pattern: useActiveMeja on mount auto-redirects if Redis has activeMeja
key_files:
  created:
    - frontend/src/stores/useKaderMejaStore.ts
    - frontend/src/hooks/useKaderSocket.ts
    - frontend/src/hooks/useActiveMeja.ts
    - frontend/src/pages/kader/KaderDashboardPage.tsx
    - frontend/src/pages/kader/LockScreenPage.tsx
    - frontend/src/pages/kader/meja/Meja1Page.tsx
    - frontend/src/pages/kader/meja/Meja2Page.tsx (stub)
    - frontend/src/pages/kader/meja/Meja3Page.tsx (stub)
    - frontend/src/pages/kader/meja/Meja4Page.tsx (stub)
    - frontend/src/pages/kader/meja/Meja5Page.tsx (stub)
    - frontend/src/pages/kader/RekapHarianPage.tsx (stub)
  modified:
    - frontend/src/router/index.tsx
    - backend/src/modules/queue/queue-kader.service.ts
    - backend/src/modules/queue/queue-kader.controller.ts
    - backend/src/modules/queue/queue-kader.routes.ts
decisions:
  - "isLocked only field persisted in useKaderMejaStore — Redis is truth for activeMeja/slotId; localStorage only for immediate UI feedback on reload"
  - "KaderDashboardPage embeds meja selector as inline modal — no separate route needed for selector; LockScreenPage retained as standalone route for future deep-link use"
  - "Backend deviation: GET /api/kader/today-slots added to queue-kader module — no existing endpoint served kader-role access to today jadwal (GET /api/jadwal/ is puskesmas-only)"
  - "Meja1Page: Tangguhkan button shows only when statusAntrian=dipanggil (backend validates same constraint)"
metrics:
  duration: "~25 minutes"
  completed: "2026-07-02"
  tasks_completed: 3
  files_modified: 14
---

# Phase 03 Plan 03: Kader Frontend Foundation Summary

Zustand store for meja lock state, Socket.IO hook for realtime antrian updates, TanStack Query hooks for Redis lock-screen recovery, real KaderDashboardPage with today's slot listing, LockScreenPage with 5 meja buttons, and Meja1Page with hadir/tangguhkan checklist grouped by RT. Router wired with 8 new kader routes.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | useKaderMejaStore + useKaderSocket + useActiveMeja + router routes | 1c80c61 | useKaderMejaStore.ts, useKaderSocket.ts, useActiveMeja.ts, router/index.tsx, 3 backend files |
| 2 | KaderDashboardPage + LockScreenPage | d7314e8 | KaderDashboardPage.tsx, LockScreenPage.tsx |
| 3 | Meja1Page + Meja2-5 stubs + RekapHarian stub | f06a72a | Meja1Page.tsx, Meja2-5Page.tsx, RekapHarianPage.tsx |

## Key Decisions Made

1. **isLocked only in localStorage**: `useKaderMejaStore` persists only `isLocked` via `partialize`. activeMeja and activeSlotId are restored from Redis via `useActiveMeja` on each mount — localStorage is never stale for these fields.

2. **Reload-recovery via useActiveMeja**: KaderDashboardPage calls `useActiveMeja()` on mount. If Redis returns `{activeMeja, slotId}`, it sets Zustand state and navigates to `/kader/meja/{N}` replacing history. This is the canonical reload recovery path.

3. **GET /api/kader/today-slots backend addition**: The plan assumed `GET /api/jadwal/` was available to kader, but it requires `puskesmas` role. Added `getTodaySlots()` in queue-kader.service.ts to return today's jadwal + slots for the kader's posyandu — fetched by posyanduId from the kader's JWT identity.

4. **KaderDashboardPage inline meja selector**: Inline modal bottom-sheet on "Mulai Pelayanan" click, rather than navigating to `/kader/lock-screen`. LockScreenPage retained as a standalone route for backward compatibility and future navigation flows from other surfaces.

5. **Hadir button logic**: Shows on `menunggu` OR `ditangguhkan` (backend allows both); Tangguhkan shows only on `dipanggil` — matching backend validation in `tangguhkanAntrian()`.

## Deviations from Plan

### Auto-added: GET /api/kader/today-slots (Rule 2 — Missing Critical Functionality)

- **Found during:** Task 2 (KaderDashboardPage implementation)
- **Issue:** Plan referenced `GET /api/jadwal?posyanduId=...&date=today` but that route uses `requireRole('puskesmas')` — kader cannot call it. No existing endpoint serves today's slots for kader role.
- **Fix:** Added `getTodaySlots(kaderId)` to `queue-kader.service.ts`, `getTodaySlotsHandler` to controller, `GET /api/kader/today-slots` to routes.
- **Files modified:** queue-kader.service.ts, queue-kader.controller.ts, queue-kader.routes.ts
- **Commit:** 1c80c61

### Plan wording vs implementation: LockScreenPage is standalone, dashboard uses inline selector

- **Plan said:** "Mulai Pelayanan button → opens meja selector dialog"
- **Implementation:** Dashboard has inline modal + `/kader/lock-screen` as a standalone route also provided (for slotId passed via router state).
- **Impact:** None — behavior identical, LockScreenPage still accessible at its route.

## Known Stubs

- `frontend/src/pages/kader/meja/Meja2Page.tsx` — stub placeholder, implemented in Plan 03-04
- `frontend/src/pages/kader/meja/Meja3Page.tsx` — stub placeholder, implemented in Plan 03-05
- `frontend/src/pages/kader/meja/Meja4Page.tsx` — stub placeholder, implemented in Plan 03-06
- `frontend/src/pages/kader/meja/Meja5Page.tsx` — stub placeholder, implemented in Plan 03-07
- `frontend/src/pages/kader/RekapHarianPage.tsx` — stub placeholder, implemented in Plan 03-07

These stubs do not prevent Plan 03-03's goal (Meja 1 end-to-end flow) from being achieved.

## Threat Flags

None — all T-03-03-* mitigations implemented:
- T-03-03-01 (lock-screen bypass): Meja1Page checks `activeSlotId` from store; if null → redirect to /kader/dashboard. KaderDashboardPage calls useActiveMeja on mount to restore state from Redis.
- T-03-03-02 (XSS): React JSX auto-escapes all string values; no dangerouslySetInnerHTML used.
- T-03-03-03 (elevation of privilege): All kader routes use `ProtectedRoute allowedRoles={['kader','ketua_kader']}`.

## Self-Check: PASSED

- frontend/src/stores/useKaderMejaStore.ts: FOUND
- frontend/src/hooks/useKaderSocket.ts: FOUND
- frontend/src/hooks/useActiveMeja.ts: FOUND
- frontend/src/pages/kader/KaderDashboardPage.tsx: FOUND
- frontend/src/pages/kader/LockScreenPage.tsx: FOUND
- frontend/src/pages/kader/meja/Meja1Page.tsx: FOUND
- frontend/src/router/index.tsx: MODIFIED (8 new kader routes)
- backend GET /api/kader/today-slots: ADDED
- TypeScript errors in new files: 0
- Commits verified: 1c80c61, d7314e8, f06a72a
