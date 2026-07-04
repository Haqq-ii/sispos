---
phase: 07-seed-data-demo
plan: "02"
subsystem: seed-massal
tags: [seed, prisma, bulk-data, posyandu, balita, pemeriksaan, imunisasi]
dependency_graph:
  requires: [07-01]
  provides: [seed-massal, bulk-posyandu-data, pemeriksaan-history, imunisasi-history]
  affects: [07-03]
tech_stack:
  added: []
  patterns: [prisma-bulk-upsert, weighted-random-seed, deterministic-nik-generation, balita-record-accumulator]
key_files:
  created:
    - prisma/seed.massal.ts
  modified: []
decisions:
  - "Tasks 1+2 completed in single cohesive file creation — both target prisma/seed.massal.ts, pemeriksaan/imunisasi included inline"
  - "BCRYPT_ROUNDS=8 (faster than 10 for 411-balita bulk seed; acceptable for demo data)"
  - "balitaRecords accumulator array separates warga/balita creation (pass 1) from pemeriksaan+imunisasi (pass 2)"
  - "StatusGizi imported from @prisma/client — cast as StatusGizi (no bare as any)"
  - "getZScores + getMeasurements as module-level pure functions — deterministic, no external deps"
  - "NIK pattern 3471+posIdx:2+balIdx:4+suffix:6 guarantees no collision with demo NIKs (T-07-02-02)"
  - "HP pattern 0812+posIdx:3+balIdx:5 — max 081201400034, no collision with demo HPs"
  - "posyanduList array (ordered, parallel to POSYANDU_DATA) carries posyandu id/kecamatan/kelurahan/rw for loop"
metrics:
  duration: "~7 min"
  completed: "2026-07-04"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 07 Plan 02: Bulk Data Seed (Massal) Summary

**One-liner:** Bulk seed generator for 3 puskesmas, 15 posyandu with Leaflet coordinates, 411 balita with weighted status-gizi distribution, 12-15 months pemeriksaan history, and Kemenkes imunisasi dasar schedule.

## What Was Built

Created `prisma/seed.massal.ts` (648 lines) exporting `seedMassal(prisma: PrismaClient)`. The function executes in four sequential passes:

1. **Puskesmas upsert (3):** Mergangsan (demo credentials), Gedongtengen, Umbulharjo — all idempotent via email unique key.

2. **Posyandu findFirst+create (15):** 5 per puskesmas with latitude/longitude for Leaflet stunting map. Posyandu Dahlia (Wirogunan RW 007, `kritis`) serves as the D-13 dramatic stunting cluster. All 5 status groups represented: sehat, sedang, rawan, kritis, outlier.

3. **Warga upsert + Balita findFirst/create (411 total):** Deterministic NIK `3471{posIdx:2}{balIdx:4}{suffix:6}` and HP `0812{posIdx:3}{balIdx:5}` — mathematically guaranteed non-collision with demo accounts. Warga upsert uses `update: {}` for idempotency. Balita created with nikBalita `nik.slice(0,15)+'9'`. All records collected into `balitaRecords[]` array.

4. **Pemeriksaan history (12-15 months per balita, ~4161 records estimated):** Per-balita lookback with 75% attendance rate (25% skipped for realism), Z-Score computed via `getZScores()` helper based on status-gizi category, BB/TB from `getMeasurements()` by age range. Three trend types: improving (index%3==0), stable (index%3==1), declining (index%3==2). findFirst guard prevents duplicates on re-run.

5. **Imunisasi dasar (9 vaccines per schedule, ~2219 records estimated):** BCG, Polio 1-4, DPT-HB-Hib 1-3, Campak 9mo — skips age-ineligible vaccines and ~25% for realistic non-completion. findFirst guard on (balitaId, namaVaksin, dosisKe).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create seed.massal.ts — Puskesmas, Posyandu, Warga, Balita | 48d32d6 | prisma/seed.massal.ts |
| 2 | Pemeriksaan history + Imunisasi dasar (included in Task 1 commit) | 48d32d6 | prisma/seed.massal.ts |

## Artifacts

| File | Status | Purpose |
|------|--------|---------|
| `prisma/seed.massal.ts` | CREATED | Exports `seedMassal(prisma)` — 3 puskesmas, 15 posyandu (with coordinates), 411 warga/balita, 12-15 months pemeriksaan, imunisasi dasar |

## Data Volume Summary

| Entity | Count | Notes |
|--------|-------|-------|
| Puskesmas | 3 | Mergangsan (demo) + Gedongtengen + Umbulharjo |
| Posyandu | 15 | 5 per puskesmas; all with lat/lng for Leaflet |
| Warga | 411 | 1 per balita; upsert on nikIbu |
| Balita | 411 | 25-30 per posyandu; deterministic NIK |
| Pemeriksaan (est.) | ~4,161 | 12-15 months × ~75% attendance × 411 balita |
| Imunisasi (est.) | ~2,219 | 9 vaccines × ~75% completion × age-eligible balita |

## Posyandu Status Groups

| Group | Posyandu | StatusGizi Distribution |
|-------|----------|------------------------|
| sehat | Melati, Seruni, Flamboyan | 80% normal, 10% kurang, 5% pendek, 5% lebih |
| sedang | Anggrek, Cempaka, Kamboja, Teratai | 60% normal, 25% kurang, 10% pendek, 5% buruk |
| rawan | Mawar, Aster, Wijayakusuma | 40% normal, 30% kurang, 20% pendek, 10% buruk |
| kritis | Dahlia (D-13 cluster), Bougenville, Tulip | 30% normal, 25% kurang, 25% pendek, 15% buruk, 5% sangat_pendek |
| outlier | Kenanga, Lavender | 60% lebih, 25% obesitas, 15% normal (pola urban) |

## Verification

```
grep "export async function seedMassal" prisma/seed.massal.ts  → PASS
grep -c "namaPosyandu" prisma/seed.massal.ts                   → 19 (PASS, >= 15)
grep "pemeriksaan.create" prisma/seed.massal.ts                → PASS
grep "imunisasi.create" prisma/seed.massal.ts                  → PASS
grep "require.main === module" prisma/seed.massal.ts            → PASS
grep -c "namaVaksin" prisma/seed.massal.ts                     → 11 (PASS, >= 9)
grep "lookbackMonths" prisma/seed.massal.ts                    → PASS
grep "StatusGizi" prisma/seed.massal.ts                        → PASS (imported enum, not bare string)
All 5 status groups present in POSYANDU_DATA                   → PASS
Posyandu Dahlia: kritis, kelurahan Wirogunan, RW 007           → PASS (D-13)
```

## Deviations from Plan

### Implementation Note

**Tasks 1 and 2 both target `prisma/seed.massal.ts`.** Since both tasks operate on the same file and Task 2 "extends the balita loop" within the same file, the complete implementation (including `getZScores`, `getMeasurements`, `IMUNISASI_SCHEDULE`, and both pemeriksaan/imunisasi loops) was written in one cohesive file creation. Both tasks share the same commit `48d32d6`. All Task 1 and Task 2 acceptance criteria are satisfied by this single commit.

No functional deviations from the plan spec.

## Known Stubs

None — `seedMassal` is a seed-only script with no UI rendering paths. All data generation produces concrete values.

## Threat Flags

None new beyond those in the plan's threat model (T-07-02-01 through T-07-02-03, all accepted or mitigated as documented in plan frontmatter).

## Self-Check: PASSED

- `prisma/seed.massal.ts` exists: FOUND
- `prisma/seed.massal.ts` has `export async function seedMassal`: FOUND
- `prisma/seed.massal.ts` has `pemeriksaan.create`: FOUND
- `prisma/seed.massal.ts` has `imunisasi.create`: FOUND
- `prisma/seed.massal.ts` has `require.main === module`: FOUND
- Commit 48d32d6 exists: VERIFIED
