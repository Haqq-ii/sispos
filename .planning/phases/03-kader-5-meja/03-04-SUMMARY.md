---
phase: 03-kader-5-meja
plan: "04"
subsystem: frontend-meja2-penimbangan
tags: [kader, meja2, zscore, biological-gate, react-hook-form, zod-v4, tanstack-query]
dependency_graph:
  requires:
    - 03-03 (useKaderMejaStore, useKaderSocket, Meja1Page, router routes)
    - 03-02 (growth.service.ts, POST /api/growth/pemeriksaan)
  provides:
    - frontend/src/hooks/usePemeriksaan.ts
    - frontend/src/lib/schemas/pemeriksaan.schemas.ts
    - frontend/src/pages/kader/meja/Meja2Page.tsx (stub → full implementation)
    - backend GET /api/kader/antrian/:id (balita detail for Meja 2)
    - Meja1Page hadir → Meja2 navigation with state
  affects:
    - frontend/src/pages/kader/meja/Meja1Page.tsx (balitaId in AntrianItem, hadir navigation)
    - backend/src/modules/queue/queue-kader.service.ts (getAntrianDetail added)
    - backend/src/modules/queue/queue-kader.controller.ts (getAntrianDetailHandler added)
    - backend/src/modules/queue/queue-kader.routes.ts (GET /kader/antrian/:id added)
tech_stack:
  added: []
  patterns:
    - Zod v4 schema (error: not required_error) matching jadwal.schema.ts pattern
    - useForm + zodResolver + register(valueAsNumber:true) for decimal numeric inputs
    - useMutation with inline onSuccess for per-call result storage (pemResult state)
    - Biological gate via Dialog (not AlertDialog — unavailable); konfirmasiBiologis header
    - StatusGizi badge inline component with Record<string,string> style map
    - Router state chain: Meja1→Meja2→Meja3 via navigate({state:{antrianId,balitaId,namaBalita}})
key_files:
  created:
    - frontend/src/hooks/usePemeriksaan.ts
    - frontend/src/lib/schemas/pemeriksaan.schemas.ts
  modified:
    - frontend/src/pages/kader/meja/Meja2Page.tsx (stub → full implementation)
    - frontend/src/pages/kader/meja/Meja1Page.tsx (balitaId field + hadir navigation)
    - backend/src/modules/queue/queue-kader.service.ts (getAntrianDetail)
    - backend/src/modules/queue/queue-kader.controller.ts (getAntrianDetailHandler)
    - backend/src/modules/queue/queue-kader.routes.ts (GET /kader/antrian/:id)
decisions:
  - "Used shadcn Input type=number + inputMode=decimal instead of custom numpad buttons — plan explicitly offers this alternative; integrates cleanly with useForm + valueAsNumber"
  - "Dialog used for biological gate (not AlertDialog — component not in shadcn ui set)"
  - "Meja2Schema uses .min(0.1) not .positive() — matches verified jadwal.schema.ts Zod v4 pattern"
  - "GET /api/kader/antrian/:id added as Rule 2 deviation — Meja2Page needs balitaId which Meja1 antrian list has from Prisma but AntrianItem type did not declare"
metrics:
  duration: "~35 minutes"
  completed: "2026-07-02"
  tasks_completed: 2
  files_modified: 7
---

# Phase 03 Plan 04: Meja 2 (Penimbangan) Summary

Zod v4 schema for BB/TB validation, TanStack Query hooks for pemeriksaan CRUD, and full Meja2Page with large decimal inputs, biological confirmation dialog (BB > 30 kg), Z-Score result card after save, and state chain navigation to Meja 3. Backend kader antrian detail endpoint added. Meja1Page updated to navigate to Meja2 with balita context after hadir.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | usePemeriksaan hook + pemeriksaan.schemas.ts (Zod v4) | 0dedd67 | usePemeriksaan.ts, pemeriksaan.schemas.ts |
| 2 | Meja2Page — decimal inputs, biological gate, Z-Score display | 38dbe05 | Meja2Page.tsx |
| 3 (Rule 2) | GET /api/kader/antrian/:id + Meja1 hadir navigation | 701b757 | queue-kader.service/controller/routes.ts, Meja1Page.tsx |

## Key Decisions Made

1. **shadcn Input over custom numpad**: Plan offered "use shadcn Input with type='number' + inputmode='decimal' as an alternative". Chosen for clean React Hook Form integration (`register + valueAsNumber`). Mobile decimal keyboard provides equivalent numpad UX on Android/iOS.

2. **Dialog for biological gate**: AlertDialog shadcn component not in `frontend/src/components/ui/`. Used existing Dialog component. Functionally identical — same confirmation flow.

3. **Zod v4 `.min(0.1)` not `.positive()`**: Following the verified pattern in `jadwal.schema.ts` which uses `.min(5, '...')`. This avoids potential `.positive()` API differences between Zod v3 and v4.

4. **Backend antrian detail endpoint** (Rule 2 deviation): `getSlotAntrian` Prisma query returns `balitaId` from the DB, but `AntrianItem` type in Meja1Page didn't declare it. Added `balitaId: string` to the type and added `GET /api/kader/antrian/:id` for Meja2Page fetch fallback. This is critical for the router-state chain from Meja1→Meja2→Meja3.

## Deviations from Plan

### Auto-added: GET /api/kader/antrian/:id + Meja1 navigation (Rule 2 — Missing Critical Functionality)

- **Found during:** Task 2 (Meja2Page implementation)
- **Issue:** Meja2Page needs `balitaId` from Meja1. Meja1Page's `AntrianItem` type didn't include `balitaId` even though Prisma `getSlotAntrian` returns it. Without navigation, the smoke test "Meja 1: click Hadir → navigate to Meja 2 with antrianId + balitaId in state" would fail. The plan's `files_modified` did not include these backend files, but the plan task 2 action explicitly says "check if existing endpoint works, otherwise create GET /api/kader/antrian/:antrianId."
- **Fix:** Added `balitaId: string` to `AntrianItem`. Updated hadir mutation to pass payload object and navigate to `/kader/meja/2` with state. Added backend `getAntrianDetail` service + handler + route.
- **Files modified:** Meja1Page.tsx, queue-kader.service/controller/routes.ts
- **Commit:** 701b757

### Plan mentioned NumpadInput artifact — replaced with standard Input

- **Plan said:** Inline numpad with digit buttons
- **Implementation:** shadcn `Input type="number" inputMode="decimal"` — plan explicitly offers this as alternative
- **Impact:** None — same functional outcome; mobile devices show decimal keyboard

## Known Stubs

None — Meja2Page fully implemented. Meja3-5 pages remain as stubs (addressed in plans 03-05 to 03-07).

## Threat Flags

None new — T-03-04-01 through T-03-04-SC all mitigated:
- T-03-04-01: Z-Score computed server-side only; values from request body ignored
- T-03-04-02: Biological gate enforced at backend (`x-konfirmasi-biologis` header check); UI gate is additional UX layer
- T-03-04-03: IDOR guard in `getAntrianDetail` verifies `kader.posyanduId === jadwal.posyanduId`

## Self-Check: PASSED

- frontend/src/hooks/usePemeriksaan.ts: FOUND (commit 0dedd67)
- frontend/src/lib/schemas/pemeriksaan.schemas.ts: FOUND (commit 0dedd67)
- frontend/src/pages/kader/meja/Meja2Page.tsx: FOUND (commit 38dbe05)
- backend GET /api/kader/antrian/:id: ADDED (commit 701b757)
- frontend TypeScript errors in new/modified files: 0
- Commits verified: 0dedd67, 38dbe05, 701b757
