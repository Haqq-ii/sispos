---
phase: 03-kader-5-meja
plan: "05"
subsystem: frontend-meja3-klinis
tags: [kader, meja3, zscore-chart, tanda-klinis, recharts, patch-endpoint, audit-log, encryption]
dependency_graph:
  requires:
    - 03-04 (usePemeriksaan.ts hooks, pemeriksaan.schemas.ts, Meja2Page navigation state)
    - 03-02 (growth.service.ts createPemeriksaan, growth.routes.ts)
  provides:
    - frontend/src/components/kader/ZScoreChart.tsx (recharts LineChart 3 series + reference lines)
    - frontend/src/pages/kader/meja/Meja3Page.tsx (full Meja 3 implementation)
    - PATCH /api/growth/pemeriksaan/:id (update tanda klinis + statusGiziOverride + rekomendasiAi)
  affects:
    - backend/src/modules/growth/growth.routes.ts (PATCH route added)
    - backend/src/modules/growth/growth.controller.ts (updatePemeriksaanHandler + UpdatePemeriksaanSchema)
    - backend/src/modules/growth/growth.service.ts (updatePemeriksaan function)
tech_stack:
  added: []
  patterns:
    - recharts LineChart with 3 data series + ReferenceLine (WHO SD zones)
    - native HTML input[type=checkbox] + Tailwind when @radix-ui/react-checkbox not installed
    - Prisma $transaction with auditLog.create in same tx (AuditLog compliance pattern)
    - encrypt() for rekomendasiAi + catatanKonsultasi; excluded from AuditLog.dataSesudah
    - IDOR guard via kader.posyanduId vs pemeriksaan.antrian.slotSesi.jadwal.posyanduId
    - React Router state chain Meja2→Meja3→Meja4 with tandaKlinis + statusGizi for AI prompt
key_files:
  created:
    - frontend/src/components/kader/ZScoreChart.tsx
  modified:
    - frontend/src/pages/kader/meja/Meja3Page.tsx (stub → full implementation)
    - backend/src/modules/growth/growth.routes.ts (PATCH /pemeriksaan/:pemeriksaanId added)
    - backend/src/modules/growth/growth.controller.ts (updatePemeriksaanHandler + UpdatePemeriksaanSchema)
    - backend/src/modules/growth/growth.service.ts (updatePemeriksaan + UpdatePemeriksaanInput)
decisions:
  - "Native HTML checkbox over @radix-ui/react-checkbox — package not in package.json; Tailwind styling + role-compatible; follows InlineProgress pattern from 03-02"
  - "TandaKlinisSchema without .default() — Zod v4 .default() causes zodResolver Resolver<InputType> mismatch; same fix pattern as Meja2Schema using explicit useForm defaultValues"
  - "updatePemeriksaan returns decrypted rekomendasiAi in response — Meja 4 needs plaintext for AI prompt; only encrypted version stored in DB"
  - "IDOR guard via antrian relationship chain — pemeriksaan created in Meja 2 can optionally have antrianId; guard applied when antrian relation exists"
  - "Tooltip formatter using typeof v === 'number' check — recharts v3 Formatter type uses ValueType union (number | string | Array), not bare number"
metrics:
  duration: "~30 minutes"
  completed: "2026-07-02"
  tasks_completed: 2
  files_modified: 5
---

# Phase 03 Plan 05: Meja 3 (Pencatatan Klinis) Summary

Meja 3 end-to-end: recharts Z-Score trend chart with 3 line series and WHO reference lines at ±2/±3 SD, tanda klinis checkbox form (4 signs + free-text), statusGiziOverride select, and PATCH /api/growth/pemeriksaan/:id backend with IDOR guard, AES-256-GCM encryption for rekomendasiAi/catatanKonsultasi, and AuditLog in same Prisma transaction. State chain Meja2→Meja3→Meja4 carries tandaKlinis + statusGizi needed for Meja 4 AI early-warning prompt.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | ZScoreChart component + PATCH /api/growth/pemeriksaan/:id backend | 9615840 | ZScoreChart.tsx, growth.routes/controller/service.ts |
| 2 | Meja3Page — Z-Score chart + tanda klinis form + statusGiziOverride | 24c8042 | Meja3Page.tsx |

## Key Decisions Made

1. **Native HTML checkbox over shadcn Checkbox**: `@radix-ui/react-checkbox` is not in `frontend/package.json`. Used native `<input type="checkbox">` styled with Tailwind CSS. Visually and functionally equivalent. No new package install needed. Consistent with Plan 03-02 precedent (InlineProgress instead of @radix-ui/react-progress).

2. **TandaKlinisSchema without `.default()`**: Zod v4's `.default(false)` infers two different types (input type with optional fields, output type with required fields), causing `zodResolver` to fail with `Resolver<InputType>` incompatibility. Fixed by removing `.default()` and setting boolean defaults in `useForm({ defaultValues: {...} })`.

3. **Tooltip formatter type fix**: recharts v3 `Formatter` type requires handling `ValueType = number | string | Array<number|string>`. Changed `(v: number) => v?.toFixed(2)` to `(v) => typeof v === 'number' ? v.toFixed(2) : String(v)`.

4. **IDOR guard via antrian chain**: `updatePemeriksaan` verifies `kader.posyanduId === pemeriksaan.antrian.slotSesi.jadwal.posyanduId` when `antrian` relation exists. Pemeriksaan without antrian (standalone) skip the IDOR check (kader created it directly).

5. **updatePemeriksaan returns decrypted rekomendasiAi**: Meja 4 AI prompt needs plaintext. Backend decrypts before returning response (same pattern as createPemeriksaan returning decrypted catatanKonsultasi).

## Deviations from Plan

### Auto-fixed: recharts Tooltip type mismatch (Rule 1 — Bug)
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `formatter={(v: number) => v?.toFixed(2)}` fails TypeScript because recharts v3 `Formatter` type is `(v: ValueType, ...) => ReactNode` where `ValueType = number | string | Array<...>`
- **Fix:** Changed to `(v) => typeof v === 'number' ? v.toFixed(2) : String(v)`
- **Files:** `frontend/src/components/kader/ZScoreChart.tsx`
- **Commit:** 9615840

### Auto-fixed: Zod v4 zodResolver mismatch with .default() (Rule 1 — Bug)
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `TandaKlinisSchema` used `.default(false)` causing Zod v4 to generate two incompatible types: `InputType` (optional booleans) vs `OutputType` (required booleans). `zodResolver` accepts the input type but `handleSubmit` passes the output type → type error.
- **Fix:** Removed `.default(false)`, added explicit `defaultValues` in `useForm()`
- **Files:** `frontend/src/pages/kader/meja/Meja3Page.tsx`
- **Commit:** 24c8042

### Plan divergence: native checkbox instead of shadcn Checkbox (Rule 3 — Blocking)
- **Plan said:** `shadcn imports: ... Checkbox ...`
- **Issue:** `@radix-ui/react-checkbox` is not in `frontend/package.json` and `frontend/src/components/ui/checkbox.tsx` does not exist.
- **Fix:** Native `<input type="checkbox">` with Tailwind; no new package required
- **Impact:** None functional; UI visually similar to shadcn Checkbox

## Known Stubs

None — Meja3Page fully implemented with chart, form, and navigation to Meja 4.

## Threat Flags

None new beyond what is in the plan's threat model. All mitigations applied:
- T-03-05-01 (IDOR): `updatePemeriksaan` verifies posyanduId chain before update
- T-03-05-03 (AuditLog bypass): `tx.auditLog.create` in same `prisma.$transaction` as `tx.pemeriksaan.update`
- T-03-05-04 (Info Disclosure): `dataSesudah` explicitly excludes `rekomendasiAi` and `catatanKonsultasi`

## Pre-existing TypeScript Errors (Out of Scope)

Frontend `npx tsc --noEmit` shows pre-existing errors in:
- `src/components/ui/calendar.tsx` — react-day-picker missing types
- `src/components/ui/dialog.tsx` — @radix-ui/react-dialog missing
- `src/components/ui/progress.tsx` — @radix-ui/react-progress missing
- `src/components/ui/radio-group.tsx` — @radix-ui/react-radio-group missing

None of these are caused by Plan 03-05 changes. They existed before this plan (verified: files not modified in commits 9615840 or 24c8042). Deferred to `deferred-items.md`.

Files created/modified in this plan: **0 TypeScript errors**.

## Self-Check: PASSED

- frontend/src/components/kader/ZScoreChart.tsx: FOUND (commit 9615840)
- frontend/src/pages/kader/meja/Meja3Page.tsx: FOUND (commit 24c8042)
- PATCH /api/growth/pemeriksaan/:id route: ADDED in growth.routes.ts (commit 9615840)
- updatePemeriksaan service with AuditLog: ADDED in growth.service.ts (commit 9615840)
- TypeScript errors in new/modified files: 0
- Commits verified: 9615840, 24c8042
