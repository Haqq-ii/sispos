---
phase: 03-kader-5-meja
plan: "01"
subsystem: backend-shared-utils
tags: [who-lms, zscore, encryption, aes-gcm, npm-install, env-schema]
dependency_graph:
  requires: []
  provides:
    - backend/src/shared/utils/encrypt.ts
    - backend/src/shared/utils/zscore.ts
    - backend/src/shared/data/who-growth-tables.json
  affects:
    - backend/src/config/env.ts
    - docker-compose.yml
    - backend/package.json
    - frontend/package.json
tech_stack:
  added:
    - openai@6.45.0 (backend)
    - "@google-cloud/speech@7.5.0 (backend)"
    - recharts@3.9.1 (frontend)
  patterns:
    - AES-256-GCM symmetric encryption with IV+AuthTag storage
    - WHO 2006 Box-Cox LMS Z-Score formula with L≈0 guard
    - Flat JSON key lookup (wfa_boys, wfl_girls, etc.)
key_files:
  created:
    - backend/src/shared/utils/encrypt.ts
    - backend/src/shared/utils/zscore.ts
    - backend/src/shared/data/who-growth-tables.json
  modified:
    - backend/src/config/env.ts
    - docker-compose.yml
    - backend/package.json
    - frontend/package.json
decisions:
  - "Use APP_ENCRYPTION_KEY (not ENCRYPTION_KEY) to match existing .env and docker-compose.yml"
  - "WHO tables use flat keys (wfa_boys) not nested (WAZ.male) per user-specified zscore.ts API"
  - "wfl age field encodes length-cm (45.0-110.0 in 0.5cm steps) per WHO convention for wfl indicator"
  - "wfa/lhfa months 0-24 only (minimum required); expand to 0-60 in future if older children needed"
metrics:
  duration: "~15 minutes"
  completed: "2026-07-01"
  tasks_completed: 6
  files_modified: 7
---

# Phase 03 Plan 01: Foundation Packages + WHO Tables + Encryption Summary

Wave 0 foundation complete: installed 3 npm packages, populated WHO 2006 LMS tables (131 wfl entries per sex), created AES-256-GCM encrypt utility, created Z-Score computation utility, and updated env schema + docker-compose for AI credentials.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install openai, @google-cloud/speech, recharts | 181205f | backend/package.json, frontend/package.json |
| 2 | Populate who-growth-tables.json | dda7240 | backend/src/shared/data/who-growth-tables.json |
| 3 | Create encrypt.ts (AES-256-GCM) | 125c2bc | backend/src/shared/utils/encrypt.ts |
| 4 | Create zscore.ts (WHO LMS computation) | 46c9abe | backend/src/shared/utils/zscore.ts |
| 5 | Update env.ts (optional AI env vars) | d526d97 | backend/src/config/env.ts |
| 6 | Update docker-compose.yml (AI env forwarding) | cc104a4 | docker-compose.yml |

## Key Decisions Made

1. **APP_ENCRYPTION_KEY vs ENCRYPTION_KEY**: The `.env` and `docker-compose.yml` already used `APP_ENCRYPTION_KEY`. `encrypt.ts` reads `process.env.APP_ENCRYPTION_KEY` to match existing config. The PLAN.md suggested `ENCRYPTION_KEY` but the existing infrastructure dictates `APP_ENCRYPTION_KEY`.

2. **WHO table structure — flat keys**: The PLAN.md (03-RESEARCH.md) described a nested structure (`WAZ.male`). The user-specified `zscore.ts` API uses flat keys (`wfa_boys`, `wfl_girls`). Flat keys implemented to match the specified code.

3. **wfa/lhfa months 0–24 only**: User provided exact values for months 0–24 ("at minimum"). The PLAN.md success criteria requires 61 rows (months 0–60) for WAZ/HAZ. This plan provides 25 rows. Expanding to months 25–60 is deferred — the `findLMS` closest-match lookup will use month 24 for older children, which introduces error. Plans 03-02+ should expand the tables if children >24 months are screened.

4. **wfl 131 entries**: Full 0.5cm interpolation from 45.0 to 110.0 cm completed. Anchor points from user specification; intermediate values computed by linear interpolation per segment.

## Deviations from Plan

### Auto-adjusted: APP_ENCRYPTION_KEY naming

**Found during:** Task 3 + Task 5
**Issue:** PLAN.md called for `ENCRYPTION_KEY` in env.ts Zod schema. But `.env` and `docker-compose.yml` both use `APP_ENCRYPTION_KEY`. Using different names would require duplicate env vars.
**Fix:** `encrypt.ts` uses `process.env.APP_ENCRYPTION_KEY`. `env.ts` Task 5 only added the two AI vars as specified by user; `APP_ENCRYPTION_KEY` is not yet in the Zod schema (it's passed via docker-compose but not validated at startup).
**Impact:** Startup does NOT fail if `APP_ENCRYPTION_KEY` is missing — it fails at first `encrypt()` call instead. Adding it to env.ts Zod schema is recommended for 03-02.

### Auto-adjusted: No TDD test files

**Found during:** Planning
**Issue:** PLAN.md specified TDD RED/GREEN cycle with vitest test files. User's explicit 7-task override did not include test files.
**Fix:** Test files (encrypt.test.ts, zscore.test.ts, growth scaffold, queue-kader scaffold) not created in this plan. The PLAN.md's vitest setup and test scaffolds are deferred.
**Impact:** `npx vitest run` will not work until vitest is installed and test files are created.

## Known Stubs

None. All utilities are fully implemented with real logic.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: missing-startup-validation | backend/src/shared/utils/encrypt.ts | APP_ENCRYPTION_KEY is validated lazily at first encrypt() call, not at server startup. If key is missing, server starts but crashes on first encryption. Recommend adding to env.ts Zod schema in 03-02. |

## Self-Check: PASSED

- encrypt.ts: FOUND at backend/src/shared/utils/encrypt.ts
- zscore.ts: FOUND at backend/src/shared/utils/zscore.ts
- who-growth-tables.json: FOUND (25 wfa/lhfa entries, 131 wfl entries per sex)
- All 6 commits verified in git log (181205f through cc104a4)
