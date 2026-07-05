---
phase: 08-ui-figma-alignment
plan: "01"
subsystem: seed-verification
tags: [seed, verification, demo-data, ai-chatbot]
dependency_graph:
  requires: []
  provides: [demo-data-verified, ai-chatbot-verified]
  affects: [08-02, 08-03, 08-04, 08-05]
tech_stack:
  added: []
  patterns: [prisma-seed, docker-compose]
key_files:
  created: []
  modified: []
decisions:
  - "DB name is 'sispos' (not 'sispos_db') — confirmed from docker-compose.yml defaults"
metrics:
  duration: "~10 min (Task 1 complete; Tasks 2-3 awaiting human-verify)"
  completed_date: "2026-07-05"
requirements: [UI-03]
---

# Phase 08 Plan 01: Seed + AI Chatbot Verification Summary

**One-liner:** Seed pipeline ran to completion — 413 balita, 15 antrian today; Tasks 2-3 await human browser verification.

## Task Results

| Task | Name | Status | Notes |
|------|------|--------|-------|
| 1 | Run seed pipeline | DONE | 413 balita, 15 antrian today, exit 0 |
| 2 | Verify 5 login scenarios | PENDING | Awaiting human browser verification |
| 3 | Verify AI chatbot | PENDING | Awaiting human browser verification |

## Task 1: Seed Pipeline Output

### Seed Run — Full Summary

```
[1/4] Seed Wilayah (DIY + Jateng + Jatim)
  1508 wilayah records seeded (deleted 1508 old, inserted 1508 fresh)

[2/4] Seed Massal
  3 puskesmas, 15 posyandu, 411 balita
  Riwayat pemeriksaan + imunisasi dasar dibuat

[3/4] Seed Demo
  Puskesmas: demo@puskesmas-mergangsan.go.id (upserted)
  Kader: Siti Nurhaliza / 081234560001 (upserted)
  Warga: Dewi Rahayu / 3471012345670001 (upserted)
  Balita 1 (Budi Santoso): sudah ada, skip
  Balita 2 (Sari Dewi): sudah ada, skip

[4/4] Seed Today (tanggal 2026-07-05 WIB)
  Jadwal baru dibuat
  4 SlotSesi dibuat (Sesi 1-4: 08:00-12:00)
  Sesi 1: 2 dummy + Dewi at nomorUrut 3
  Sesi 2-4: dummy antrian diisi

Exit code: 0 (no errors, no "Error:" lines in output)
```

### DB Sanity Check

| Check | Expected | Actual | Pass? |
|-------|----------|--------|-------|
| balita_count | > 100 | 413 | YES |
| antrian_count today | > 0 | 15 | YES |

**Task 1 acceptance criteria: ALL PASSED**

## Task 2: Login Scenarios (PENDING)

Awaiting human verification at http://localhost. 5 scenarios from PLAN.md:
- Citizen NIK 3471012345670001 / Demo1234! → /citizen/dashboard with nomorUrut=3
- Citizen /citizen/tumbuh-kembang riwayat tab → real pemeriksaan record
- Kader HP 081234560001 / PIN 123456 → /kader/dashboard with 4 sesi today
- Puskesmas demo@puskesmas-mergangsan.go.id / Demo1234! → /puskesmas/dashboard stats
- Peta Stunting → at least 1 CircleMarker visible

## Task 3: AI Chatbot (PENDING)

Awaiting human verification. Check OPENAI_API_KEY first:
```
docker compose exec sispos-backend sh -c 'echo $OPENAI_API_KEY'
```
If empty → document as non-functional.

## Deviations from Plan

### Infrastructure gate: Docker Desktop not running

**Found during:** Pre-Task 1 execution
**Issue:** Docker Desktop Service was stopped; `com.docker.service` Status=Stopped
**Fix:** User started Docker Desktop; all 5 containers came up healthy
**Impact:** Delay only; no code changes needed

### Note: DB name discovery

Plan's SQL example used database name `sispos_db` but actual name is `sispos` (docker-compose.yml default). Sanity check queries adjusted accordingly.

## Known Stubs

None — this plan makes no source code changes.

## Threat Flags

None — no new network endpoints or schema changes.

## Self-Check: PARTIAL

- Task 1: PASSED — seed ran exit 0, DB counts confirmed (413 balita, 15 antrian)
- Task 2: PENDING human-verify
- Task 3: PENDING human-verify
