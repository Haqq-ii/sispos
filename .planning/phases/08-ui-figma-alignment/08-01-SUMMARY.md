---
phase: 08-ui-figma-alignment
plan: "01"
subsystem: seed-verification
tags: [seed, verification, demo-data, ai-chatbot, bug-fix]
dependency_graph:
  requires: []
  provides: [seed-pipeline-verified, growth-riwayat-endpoint, dashboard-stats-fix]
  affects: [08-02, 08-03, 08-04, 08-05]
tech_stack:
  added: []
  patterns: [prisma-seed, docker-compose, tanstack-query]
key_files:
  created: []
  modified:
    - backend/src/modules/growth/growth.service.ts
    - backend/src/modules/growth/growth.controller.ts
    - backend/src/modules/growth/growth.routes.ts
    - backend/src/modules/dashboard/dashboard.service.ts
decisions:
  - "DB name is 'sispos' (not 'sispos_db') — docker-compose.yml default"
  - "getDashboardStats rewritten to query pemeriksaan directly (not via antrian chain) — seedMassal creates pemeriksaan with antrianId=null"
  - "AI chatbot verification (Task 3) deferred to post-design-wave — user decision"
  - "Peta stunting circle radius fix deferred to Wave 8.4 (visual only)"
metrics:
  duration: "~30 min"
  completed_date: "2026-07-05"
requirements: [UI-03]
---

# Phase 08 Plan 01: Seed + AI Chatbot Verification Summary

**One-liner:** Seed pipeline OK (413 balita), two backend bugs fixed (riwayat endpoint + dashboard stats), login verification partial, AI chatbot deferred.

## Task Results

| Task | Name | Status | Commit | Notes |
|------|------|--------|--------|-------|
| 1 | Run seed pipeline | DONE | e1d3f80 | 413 balita, 15 antrian today, exit 0 |
| — | Fix Bug 1: GET /growth/riwayat | DONE | 8b89c49 | Endpoint missing; added with citizen role |
| — | Fix Bug 2: getDashboardStats | DONE | 8b89c49 | Rewrote query to bypass empty antrian chain |
| 2 | Verify 5 login scenarios | PARTIAL | — | Scenarios 1, 3, 5 pass; 2 and 4 have residual gaps |
| 3 | Verify AI chatbot | DEFERRED | — | User decision — defer to post-design-wave |

---

## Task 1: Seed Pipeline

### Seed Run Output (abridged)

```
[1/4] Seed Wilayah — 1508 records (DIY + Jateng + Jatim)
[2/4] Seed Massal — 3 puskesmas, 15 posyandu, 411 balita
                    riwayat pemeriksaan + imunisasi dibuat
[3/4] Seed Demo   — Dewi Rahayu (citizen), Siti Nurhaliza (kader),
                    Puskesmas Mergangsan, Budi Santoso + Sari Dewi
[4/4] Seed Today  — Jadwal 2026-07-05, 4 SlotSesi (08:00-12:00),
                    Dewi at nomorUrut=3 in Sesi 1

Exit code: 0 — no errors
```

### DB Sanity Check

| Check | Expected | Actual | Pass? |
|-------|----------|--------|-------|
| balita_count | > 100 | 413 | YES |
| antrian_count today | > 0 | 15 | YES |

---

## Bug Fixes (Rule 1 — Auto-fixed)

### Bug 1 — GET /growth/riwayat endpoint missing

**Found during:** Task 2 scenario 2 (TumbuhKembangPage shows "Belum ada data pemeriksaan")
**Root cause:** TumbuhKembangPage calls GET /api/growth/riwayat but the route did not exist — 404 returned, query treated as empty.
**Fix:** Added getRiwayatForCitizen(wargaId) in growth.service.ts; handler in controller; GET /riwayat route with requireRole('citizen').
**DB verify:** 7 pemeriksaan records for demo citizen's balita.
**Commit:** 8b89c49

### Bug 2 — getDashboardStats always returned 0

**Found during:** Task 2 scenario 4 (Puskesmas dashboard all-zero stats)
**Root cause:** Query traversed posyandu→jadwal→slotSesi→antrian(selesai)→pemeriksaan, but seedMassal creates pemeriksaan with antrianId=null — chain always returned 0.
**Fix:** Rewrote dashboard.service.ts getDashboardStats to query pemeriksaan directly via balita→warga(posyanduUtamaId)→posyandu(puskesmasId), filtered by tanggalPemeriksaan month range.
**DB verify:** 211 pemeriksaan for demo puskesmas in July 2026.
**Commit:** 8b89c49

---

## Task 2: Login Verification (PARTIAL — user accepted)

| Scenario | Status | Notes |
|----------|--------|-------|
| 1 — Citizen login → /citizen/dashboard | PASS | Dewi Rahayu dashboard visible, nomorUrut=3 card shown |
| 2 — Citizen /tumbuh-kembang riwayat tab | PARTIAL | Endpoint now fixed; browser re-test pending in later wave |
| 3 — Kader login → /kader/dashboard | PASS | Siti Nurhaliza dashboard, 4 sesi today visible |
| 4 — Puskesmas dashboard stats | PARTIAL | Stats query fixed; browser re-test pending in later wave |
| 5 — Peta Stunting CircleMarker | PASS | Map renders with circles visible (size visual issue deferred to 8.4) |

---

## Task 3: AI Chatbot Verification (DEFERRED — user decision)

Deferred to post-design-wave. Backend exists and is functional:
- POST /api/ai/chat/assistant (ai-assistant.service.ts)
- Rate limit 20 msg/day WIB (Redis)
- parallel_tool_calls:false (T-04-04-01)

Prerequisite: verify OPENAI_API_KEY is set before testing.
```
docker compose exec sispos-backend sh -c 'echo $OPENAI_API_KEY'
```

---

## Deferred Items

| Item | Target Wave |
|------|-------------|
| AI chatbot end-to-end verification | Post-08 |
| Peta Stunting circle radius (visual) | 8.4 |
| Scenario 2 browser re-test (tumbuh-kembang riwayat) | 8.2 |
| Scenario 4 browser re-test (puskesmas dashboard stats) | 8.2 |

---

## Deviations from Plan

### [Rule 1 - Bug] GET /growth/riwayat endpoint missing
- Found during: Task 2 scenario 2
- Fix: growth.service.ts + controller + routes
- Commit: 8b89c49

### [Rule 1 - Bug] getDashboardStats returned 0 via empty antrian chain
- Found during: Task 2 scenario 4
- Fix: dashboard.service.ts rewritten
- Commit: 8b89c49

### Infrastructure gate: Docker Desktop not running
- Pre-Task 1; user started Docker Desktop; no code changes

### Task 3 deferred by user
- AI chatbot verification moved to post-design-wave

---

## Known Stubs

None — new riwayat endpoint returns real DB data.

## Threat Flags

None — GET /growth/riwayat protected by authMiddleware + requireRole('citizen').

## Self-Check: PASSED (partial plan — user accepted)

- Task 1 commit: e1d3f80 present
- Bug fix commit: 8b89c49 present
- GET /growth/riwayat: registered in growth.routes.ts
- getDashboardStats: DB verified returns 211 records for demo puskesmas
- SUMMARY.md: written at correct path
- Task 2: PARTIAL (scenarios 1, 3, 5 pass; 2 and 4 have fixes applied, re-test deferred)
- Task 3: DEFERRED (user decision)
