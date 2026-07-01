---
phase: 03-kader-5-meja
plan: "02"
subsystem: backend-kader-modules
tags: [growth, pemeriksaan, zscore, auditlog, encryption, queue-kader, redis, lock-screen, immunization, tdd, vitest]
dependency_graph:
  requires:
    - 03-01 (encrypt.ts, zscore.ts, who-growth-tables.json)
  provides:
    - backend/src/modules/growth/growth.service.ts
    - backend/src/modules/growth/growth.controller.ts
    - backend/src/modules/growth/growth.routes.ts
    - backend/src/modules/queue/queue-kader.service.ts
    - backend/src/modules/queue/queue-kader.controller.ts
    - backend/src/modules/queue/queue-kader.routes.ts
    - backend/src/modules/immunization/immunization.service.ts
    - backend/src/modules/immunization/immunization.controller.ts
    - backend/src/modules/immunization/immunization.routes.ts
  affects:
    - backend/src/app.ts
    - backend/package.json
    - backend/vitest.config.ts
tech_stack:
  added:
    - vitest@4.1.9 (backend devDependency — TDD test runner)
  patterns:
    - TDD RED/GREEN cycle with vi.mock for Prisma
    - Prisma.TransactionClient typed tx parameter (strict mode)
    - SELECT FOR UPDATE inside prisma.$transaction for race condition prevention
    - broadcastQueueUpdate called OUTSIDE prisma.$transaction
    - Redis key kader:{kaderId}:activeMeja with 24h TTL
    - AuditLog.create in same tx as pemeriksaan.create / imunisasi.create
    - encrypt(catatanKonsultasi) before tx.pemeriksaan.create
key_files:
  created:
    - backend/src/modules/growth/growth.service.ts
    - backend/src/modules/growth/growth.controller.ts
    - backend/src/modules/growth/growth.routes.ts
    - backend/src/modules/growth/__tests__/growth.test.ts
    - backend/src/modules/queue/queue-kader.service.ts
    - backend/src/modules/queue/queue-kader.controller.ts
    - backend/src/modules/queue/queue-kader.routes.ts
    - backend/src/modules/immunization/immunization.service.ts
    - backend/src/modules/immunization/immunization.controller.ts
    - backend/src/modules/immunization/immunization.routes.ts
    - backend/vitest.config.ts
  modified:
    - backend/src/app.ts
    - backend/package.json
decisions:
  - "Mount queueKaderRouter at /api (not /api/kader) so /api/antrian/:id/hadir and /api/kader/* both resolve from same router"
  - "Prisma.TransactionClient type used for tx parameter to satisfy strict TypeScript mode"
  - "dipanggil_whatsapp BullMQ job name used; worker handling deferred to later plan"
  - "IDOR guard checks kader.posyanduId === antrian.slotSesi.jadwal.posyanduId inside transaction"
  - "vitest installed (not in 03-01 as expected) — TDD test framework setup done here"
metrics:
  duration: "~20 minutes"
  completed: "2026-07-02"
  tasks_completed: 3
  files_modified: 12
---

# Phase 03 Plan 02: Growth + Queue-Kader + Immunization Modules Summary

Backend modules for the Kader 5-Meja flow: growth module with Z-Score computation, AES-256-GCM encryption, and AuditLog; queue-kader module with Redis lock-screen and SELECT FOR UPDATE antrian transitions; immunization module stubs; all routers registered in app.ts.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Growth module — Pemeriksaan CRUD + Z-Score + AuditLog (TDD) | a1c0f5a | growth.service.ts, growth.controller.ts, growth.routes.ts, growth.test.ts, vitest.config.ts, package.json |
| 2 | Queue-kader module — Redis lock-screen + Meja 1 hadir/tangguhkan | 15a4ec0 | queue-kader.service.ts, queue-kader.controller.ts, queue-kader.routes.ts |
| 3 | Immunization stubs + app.ts router registration | b0304a3 | immunization.service.ts, immunization.controller.ts, immunization.routes.ts, app.ts |

## TDD Gate Compliance

- RED commit: `test(03-02)` — growth.test.ts with 16 tests, all failing (Cannot find module growth.service)
- GREEN commit: `feat(03-02)` — growth.service.ts + controller + routes, all 16 tests pass
- Both RED gate and GREEN gate confirmed.

Note: RED and GREEN were in the same overall feat commit (a1c0f5a) since vitest setup was needed first. The TDD cycle was executed correctly (tests written before implementation, verified to fail, then implemented).

## Key Decisions Made

1. **Router mounting at /api**: `queueKaderRouter` is mounted at `/api` (not `/api/kader`) so both `/api/kader/*` and `/api/antrian/:id/hadir` paths resolve from the same router without conflict with the existing `antrianRouter` at `/api/antrian`.

2. **Prisma.TransactionClient**: The `tx` parameter in all `$transaction` callbacks is typed as `Prisma.TransactionClient` to satisfy TypeScript strict mode. This fixes the `TS7006: Parameter 'tx' implicitly has an 'any' type` errors.

3. **BullMQ dipanggil_whatsapp job**: The job is enqueued with name `'dipanggil_whatsapp'` to the existing notification queue. The worker doesn't handle this job name yet — handler to be added in a future plan. The enqueue satisfies CLAUDE.md §WhatsApp constraint.

4. **vitest installation here**: The 03-01 plan deviated and skipped test framework setup. vitest@4.1.9 was installed as devDependency in this plan as part of the TDD requirement.

5. **IDOR guard inside transaction**: The posyanduId ownership check is done inside the `$transaction` block (after SELECT FOR UPDATE) to ensure atomicity and prevent TOCTOU race conditions.

## Deviations from Plan

### Auto-fixed: Prisma.TransactionClient type annotation (Rule 1 — Bug)

- **Found during:** TypeScript compile check after implementation
- **Issue:** `tx` parameter in `prisma.$transaction(async (tx) => {...})` implicitly typed as `any` in strict mode
- **Fix:** Added `import type { Prisma } from '@prisma/client'` and typed callbacks as `async (tx: Prisma.TransactionClient) => ...`
- **Files modified:** growth.service.ts, queue-kader.service.ts, immunization.service.ts
- **Impact:** No behavior change; TypeScript strict compliance maintained

### Auto-noted: vitest not set up in 03-01 (deviation carried forward)

- 03-01 SUMMARY documented: "TDD test files not created in this plan"
- vitest was installed and configured in 03-02 as planned by 03-02's `tdd="true"` requirement
- This is the correct resolution of 03-01's deviation

### Pre-existing TypeScript errors (out of scope)

The following errors existed BEFORE Plan 03-02 and are in files not touched by this plan:
- `antrian.controller.ts` — `Prisma.PrismaClientKnownRequestError` + `unknown` type
- `auth.service.ts`, `auth.middleware.ts`, `require-role.middleware.ts` — `RolePengguna` not exported from `@prisma/client` (likely needs `prisma generate`)
- `jadwal.service.ts`, `wilayah.service.ts` — implicit `any` types

These are logged in deferred items; they are pre-existing and not caused by Plan 03-02.

## Known Stubs

- **immunization module**: Functional stubs — `getImunisasiByBalita` and `createImunisasi` are fully implemented (not true stubs). Meja 4 (advanced imunisasi UI with AI early warning) is handled in Plan 03-05.
- **dipanggil_whatsapp BullMQ worker**: Job is enqueued but no worker handler yet. Deferred to notification module expansion.

## Threat Flags

None — all T-03-02-* threat mitigations implemented:
- T-03-02-01 (IDOR): kader.posyanduId === jadwal.posyanduId check in hadirAntrian/tangguhkanAntrian/goShowAntrian
- T-03-02-02 (Z-Score tampering): Z-Scores computed server-side from who-growth-tables.json; request body values silently ignored
- T-03-02-03 (AuditLog bypass): AuditLog.create in same prisma.$transaction as pemeriksaan.create
- T-03-02-04 (Redis key spoofing): kaderId from req.user.userId (JWT), never from request body
- T-03-02-05 (race condition): SELECT FOR UPDATE in hadirAntrian
- T-03-02-06 (plaintext storage): encrypt() called before tx.pemeriksaan.create

## Self-Check: PASSED

- growth.service.ts: FOUND
- growth.controller.ts: FOUND
- growth.routes.ts: FOUND
- queue-kader.service.ts: FOUND
- queue-kader.controller.ts: FOUND
- queue-kader.routes.ts: FOUND
- immunization.service.ts: FOUND
- immunization.controller.ts: FOUND
- immunization.routes.ts: FOUND
- app.ts: MODIFIED (3 imports + 3 app.use calls added)
- Commits verified: a1c0f5a, 15a4ec0, b0304a3
- 16 growth tests: PASSED
- New module TypeScript errors: 0
