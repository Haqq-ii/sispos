---
phase: 00-infrastructure-setup
plan: "01"
subsystem: infrastructure
tags: [prisma, docker, nginx, schema-fix, devops]
dependency_graph:
  requires: []
  provides:
    - prisma/schema.prisma (valid, 14 models)
    - docker-compose.yml (5-container topology)
    - nginx/nginx.conf (reverse proxy)
    - .env.example (env var documentation)
    - .gitignore (credential protection)
  affects:
    - All subsequent plans (backend Dockerfile uses valid schema for prisma generate)
    - Plans 00-02 through 00-04 (rely on network topology defined here)
tech_stack:
  added: []
  patterns:
    - Docker Compose 5-container topology with bridge network
    - Nginx upstream proxy for /api/, /socket.io/, / routes
    - PostgreSQL + Redis healthchecks before backend starts
    - *.json gitignore pattern with explicit package.json exceptions
key_files:
  modified:
    - prisma/schema.prisma
    - .env.example
    - .gitignore
  created:
    - docker-compose.yml
    - nginx/nginx.conf
decisions:
  - "AuditLog polymorphic relations removed — Prisma cannot map single userId scalar to two different models; userId + userRole is sufficient for audit lookup"
  - "APP_ENCRYPTION_KEY added to .env.example — required for UU PDP column encryption (catatanKonsultasi, rekomendasiAi)"
  - "JWT_EXPIRES_IN and JWT_REFRESH_EXPIRES_IN preserved from original .env.example — needed by auth module"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 00 Plan 01: Infrastructure & Schema Fix Summary

**One-liner:** Fixed 4 Prisma schema validation errors then created 5-container Docker Compose topology with Nginx reverse proxy, env documentation, and credential-protecting gitignore.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Fix prisma/schema.prisma — 4 schema bugs | `6a8ce11` | Done |
| 2 | Create docker-compose.yml, nginx.conf, .env.example, .gitignore | `d8561b5` | Done |

## Schema Changes (Task 1)

Four targeted fixes applied to `prisma/schema.prisma` (schema v2.0 Final):

**FIX 1 — Warga back-relation added**
```prisma
// Warga model, after antrian Antrian[]
riwayatChat       RiwayatChat[]
```
RiwayatChat model references `wargaId → Warga.id` but Warga had no inverse `riwayatChat` field — Prisma requires both sides of a one-to-many relation to be declared.

**FIX 2 — AuditLog polymorphic relations removed**
```prisma
// REMOVED from AuditLog model:
// Relasi opsional untuk traceability
puskesmas     Puskesmas?   @relation(fields: [userId], references: [id])
kader         Kader?       @relation(fields: [userId], references: [id])
```
Prisma cannot use a single scalar field (`userId`) to reference two different models. AuditLog is an append-only log — `userId + userRole` is sufficient for lookup without these broken relations.

**FIX 3 — Back-relations removed from Puskesmas and Kader**
```prisma
// REMOVED from Puskesmas: auditLog       AuditLog[]
// REMOVED from Kader:     auditLog      AuditLog[]
```
These were the inverse side of the now-removed AuditLog relations.

**FIX 4 — Three columns added to Pemeriksaan model**
```prisma
catatanKlinis       String?     // catatan klinis oleh kader (plaintext)
tandaKlinis         Json?       // { rambutKemerahan, perutBuncit, edema, pucat, lainnya }
statusGiziOverride  StatusGizi? // override manual kader jika tidak setuju hasil otomatis
```
Required for Meja 3 (grafik Z-Score, checkbox tanda klinis, override) and Meja 4 (catatan konsultasi kader). The superseded ALTER TABLE comment block at the bottom of the file was also deleted.

**Model count: 14 (unchanged)**

## Infrastructure Files Created (Task 2)

### docker-compose.yml
- 5 services on `sispos-network` (bridge): `sispos-nginx`, `sispos-backend`, `sispos-frontend`, `sispos-db`, `sispos-redis`
- Only `sispos-nginx` exposes port `80:80` to host — all other services are internal
- `sispos-db` and `sispos-redis` have `healthcheck:` blocks
- `sispos-backend` uses `condition: service_healthy` for both db and redis dependencies
- Backend build context is `.` (project root) so Dockerfile can COPY both `backend/` and `prisma/`

### nginx/nginx.conf
- `location /api/` → `http://backend` (upstream sispos-backend:3000)
- `location /socket.io/` → `http://backend` with WebSocket upgrade headers
- `location /` → `http://frontend` (upstream sispos-frontend:5173) with WebSocket upgrade headers (required for Vite HMR)

### .env.example
Updated from prior placeholder format to CHANGEME-style documentation. Added:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (required by docker-compose.yml `sispos-db`)
- `APP_ENCRYPTION_KEY` (required for UU PDP column encryption — Rule 2 auto-add)
- All keys: DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET, OPENAI_API_KEY, FONNTE_API_KEY, GOOGLE_APPLICATION_CREDENTIALS

### .gitignore
- `*.json` with explicit exceptions `!package.json`, `!package-lock.json`, `!tsconfig*.json`, `!components.json`
- `.env` on its own line (plus `.env.local`, `.env.production`)
- `pino-*.log` for backend logging
- Covers `docker-volumes/`, `node_modules/`, `dist/`, `build/`

## Deviations from Plan

### Auto-added: APP_ENCRYPTION_KEY in .env.example (Rule 2 — Missing Critical Functionality)

- **Found during:** Task 2
- **Issue:** Plan's .env.example spec did not include `APP_ENCRYPTION_KEY`, but CLAUDE.md mandates that `catatanKonsultasi` and `rekomendasiAi` columns MUST be encrypted (UU PDP No. 27/2022). Without this key in .env, the encryption module cannot initialize.
- **Fix:** Added `APP_ENCRYPTION_KEY=CHANGEME_64_CHAR_HEX_STRING_GENERATE_WITH_OPENSSL` to .env.example
- **Files modified:** `.env.example`

### Preserved: Additional .env.example variables from prior file

- **Found during:** Task 2 (discovered .env.example already existed)
- **Decision:** Preserved `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, and `OPENAI_MODEL` from original .env.example — these are needed by the auth and AI modules in later phases. Not in plan spec but clearly required.
- **Files modified:** `.env.example`

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| riwayatChat present | `grep -c "riwayatChat" prisma/schema.prisma` | 1 (PASS) |
| No polymorphic AuditLog | `grep -n "AuditLog" prisma/schema.prisma` | Only model declaration (PASS) |
| 5 services | `grep -c "sispos-" docker-compose.yml` | 20 (names appear in multiple fields — PASS) |
| nginx only has ports | `grep -A10 "sispos-backend:" docker-compose.yml \| grep "ports:"` | No output (PASS) |
| .gitignore .env | `grep "^\.env$" .gitignore` | `.env` (PASS) |
| 3 Pemeriksaan columns | `grep "catatanKlinis\|tandaKlinis\|statusGiziOverride"` | 3 lines found (PASS) |
| Model count | `grep -c "^model " prisma/schema.prisma` | 14 (PASS) |

## Known Stubs

None — this plan only creates infrastructure files, not UI or data-rendering components.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced beyond what the plan's `<threat_model>` already documents.

Mitigations from threat register — applied:
- **T-00-01-A**: `.env` in gitignore (line `.env` present) ✓
- **T-00-01-B**: `*.json` excluded with package.json exceptions ✓
- **T-00-02**: Only `sispos-nginx` has ports (verified via grep) ✓
- **T-00-04**: docker-compose.yml reads `${REDIS_PASSWORD}` not hardcoded; redis uses `--requirepass` ✓

Note: `sispos-501005-5ca79d995298.json` (Google credentials file) was found in project root — it will now be gitignored by the `*.json` pattern. However, it has already been committed in `466b2c3 first commit`. Developer should run `git rm --cached sispos-501005-5ca79d995298.json` to remove it from git history tracking.

## Self-Check: PASSED

Files exist:
- `prisma/schema.prisma` — FOUND
- `docker-compose.yml` — FOUND
- `nginx/nginx.conf` — FOUND
- `.env.example` — FOUND
- `.gitignore` — FOUND

Commits exist:
- `6a8ce11` — FOUND (fix: repair prisma schema)
- `d8561b5` — FOUND (feat: Docker Compose topology)
