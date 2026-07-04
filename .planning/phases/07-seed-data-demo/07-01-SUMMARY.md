---
phase: 07-seed-data-demo
plan: "01"
subsystem: seed-orchestration
tags: [seed, prisma, orchestrator, package-json]
dependency_graph:
  requires: []
  provides: [seed-orchestrator, prisma-db-seed-entry]
  affects: [07-02, 07-03]
tech_stack:
  added: []
  patterns: [prisma-seed-orchestrator, require.main-guard, ts-node-seed-entry]
key_files:
  created:
    - prisma/seed.ts
  modified:
    - prisma/seed.wilayah.ts
    - backend/package.json
decisions:
  - "seed.ts as single orchestrator calling 4 named exports in order (D-01, D-02)"
  - "require.main guard in seed.wilayah.ts for standalone backward compatibility (T-07-01-03)"
  - "ts-node --project ./tsconfig.json for seed entry to use backend tsconfig (D-04)"
metrics:
  duration: "~5 min"
  completed: "2026-07-04"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 07 Plan 01: Seed Orchestrator + Package.json Entry Summary

**One-liner:** Prisma db seed orchestrator wired via seed.ts importing all 4 seed phases with ts-node entry in backend/package.json.

## What Was Built

Created `prisma/seed.ts` as the master orchestrator that imports and sequentially calls `seedWilayah`, `seedMassal`, `seedDemo`, and `seedToday` (in mandated order). Refactored `prisma/seed.wilayah.ts` to export `seedWilayah(prisma: PrismaClient)` and added `require.main === module` guard for backward-compatible standalone execution. Updated `backend/package.json` prisma block with `"seed"` key so `npx prisma db seed` inside the container invokes the full pipeline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refactor seed.wilayah.ts + Create seed.ts orchestrator | 1105404 | prisma/seed.wilayah.ts, prisma/seed.ts |
| 2 | Update backend/package.json prisma seed entry | 8266b1a | backend/package.json |

## Artifacts

| File | Status | Purpose |
|------|--------|---------|
| `prisma/seed.ts` | CREATED | Master orchestrator — calls seedWilayah → seedMassal → seedDemo → seedToday |
| `prisma/seed.wilayah.ts` | MODIFIED | Added `export async function seedWilayah(prisma)` + `require.main` guard; removed top-level PrismaClient |
| `backend/package.json` | MODIFIED | Added `"seed": "ts-node --project ./tsconfig.json ./prisma/seed.ts"` to prisma block |

## Verification

```
grep "export async function seedWilayah" prisma/seed.wilayah.ts  → PASS
grep "require.main === module" prisma/seed.wilayah.ts             → PASS
grep "seed.*prisma/seed.ts" backend/package.json                  → PASS
grep -c "await seed" prisma/seed.ts                               → 4 (PASS)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

`prisma/seed.ts` imports `./seed.massal`, `./seed.demo` (as module export), and `./seed.today` (as module export) which do not yet exist with the required named exports. This is expected and documented in the plan — Plans 07-02 and 07-03 will deliver these files. TypeScript will report import errors until those plans complete; no `@ts-ignore` directives were added per plan instruction.

## Threat Flags

None — no new network endpoints or auth paths introduced. `require.main` guard mitigates T-07-01-03 (accidental standalone execution when imported as module).

## Self-Check: PASSED

- `prisma/seed.ts` exists: FOUND
- `prisma/seed.wilayah.ts` has `export async function seedWilayah`: FOUND
- `prisma/seed.wilayah.ts` has `require.main === module`: FOUND
- `backend/package.json` has seed entry: FOUND
- Commit 1105404 exists: VERIFIED
- Commit 8266b1a exists: VERIFIED
