---
phase: 00-infrastructure-setup
plan: "02"
subsystem: backend
tags: [backend, express, prisma, socket.io, ioredis, bullmq, pino, zod, dockerfile, typescript]
dependency_graph:
  requires:
    - prisma/schema.prisma (fixed, 14 models — Plan 00-01)
    - docker-compose.yml (build context "."; dockerfile backend/Dockerfile — Plan 00-01)
  provides:
    - backend/Dockerfile (builds from project root; copies prisma/; runs prisma generate)
    - backend/package.json (all runtime + dev deps)
    - backend/tsconfig.json (strict mode, ES2022, commonjs)
    - backend/nodemon.json (ts-node hot-reload)
    - backend/src/config/env.ts (Zod-validated env; exit(1) on missing vars)
    - backend/src/config/db.ts (PrismaClient singleton)
    - backend/src/config/redis.ts (ioredis + createRedisAdapter)
    - backend/src/config/socket.ts (Socket.IO server init + Redis adapter)
    - backend/src/app.ts (Express app; cors, cookie-parser, pino-http redacted)
    - backend/src/server.ts (HTTP entry point; connectDB before listen)
    - backend/src/modules/health/health.routes.ts (GET /api/health)
    - 12 module dirs: auth, users, posyandu, child, queue, growth, immunization, ai, voice, dashboard, reports, notification
    - 4 shared dirs: schemas, middleware, utils, data (who-growth-tables.json placeholder)
  affects:
    - Plan 00-04: docker compose build sispos-backend will use this Dockerfile
    - Phase 1+: all module routers mount to app.ts; auth middleware from shared/middleware
tech_stack:
  added:
    - express@^4.19.2
    - "@prisma/client@^5.15.0"
    - socket.io@^4.7.5
    - "@socket.io/redis-adapter@^8.3.0"
    - ioredis@^5.4.1
    - bullmq@^5.7.0
    - pino@^9.2.0 + pino-http@^10.2.0
    - zod@^3.23.8
    - cors + cookie-parser + multer + exceljs + pdfkit + dotenv
    - nodemon + ts-node + typescript@^5.4.5 (devDependencies)
  patterns:
    - PrismaClient global singleton (ts-node hot-reload safe)
    - Zod env validation at module load time (fail-fast startup)
    - ioredis dual-client pattern (publish + subscribe) for Socket.IO Redis adapter
    - Dynamic import in health.routes.ts to avoid socket.ts circular dependency
    - pino-http with JWT+cookie redaction (T-00-02-A mitigation)
key_files:
  created:
    - backend/Dockerfile
    - backend/package.json
    - backend/tsconfig.json
    - backend/nodemon.json
    - backend/src/config/env.ts
    - backend/src/config/db.ts
    - backend/src/config/redis.ts
    - backend/src/config/socket.ts
    - backend/src/app.ts
    - backend/src/server.ts
    - backend/src/modules/health/health.routes.ts
    - backend/src/shared/data/who-growth-tables.json
    - backend/src/modules/{auth,users,posyandu,child,queue,growth,immunization,ai,voice,dashboard,reports,notification}/.gitkeep
    - backend/src/shared/{schemas,middleware,utils}/.gitkeep
  modified:
    - .gitignore (added !nodemon.json and !who-growth-tables.json exceptions)
decisions:
  - "io variable declared as Server | undefined (not Server) agar type-safe saat health check dilakukan sebelum initSocket dipanggil"
  - "health.routes.ts menggunakan dynamic import untuk socket.ts guna menghindari circular dependency di masa depan"
  - "pino logger dibuat dua instans: satu di app.ts (export logger), satu lokal di db.ts/redis.ts/socket.ts — menghindari import app.ts dari config layer (circular dep)"
metrics:
  duration: "~6 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 00 Plan 02: Backend Scaffold Summary

**One-liner:** Full backend scaffold dengan Dockerfile multi-stage-aware, Express+Pino+Zod config layer, PrismaClient singleton, ioredis dual-client untuk Socket.IO, dan GET /api/health endpoint yang mengecek konektivitas DB+Redis+Socket.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Dockerfile, package.json, tsconfig.json, nodemon.json, 12 modul dirs, 4 shared dirs, who-growth-tables.json | `59a687a` | Done |
| 2 | env.ts, db.ts, redis.ts, socket.ts, app.ts, server.ts, health.routes.ts | `78ca7d4` | Done |

## Files Created

### Backend Root Config Files

| File | Tujuan |
|------|--------|
| `backend/Dockerfile` | Build dari project root; `COPY prisma/ ./prisma/`; `RUN npx prisma generate` |
| `backend/package.json` | Runtime deps: express, prisma, socket.io, ioredis, bullmq, pino, zod, dll. |
| `backend/tsconfig.json` | `strict: true`, `noImplicitAny: true`, ES2022, commonjs, `rootDir: ./src` |
| `backend/nodemon.json` | Hot-reload ts-node: watch `src/`, ext `ts,json`, exec `ts-node src/server.ts` |

### Config Layer (backend/src/config/)

**env.ts** — Zod schema validation saat module load:
- Validasi: `DATABASE_URL` (url), `REDIS_URL` (url), `JWT_SECRET` (min 32), `JWT_REFRESH_SECRET` (min 32), `PORT` (number, default 3000), `NODE_ENV` (enum, default development), `FRONTEND_URL` (url, default localhost)
- `process.exit(1)` jika ada var yang invalid, dengan pesan error Zod ke stderr (tidak mengekspos nilai, hanya nama field — mitigasi T-00-02-B)

**db.ts** — PrismaClient singleton:
- Pattern: `global as unknown as { prisma: PrismaClient }` untuk mencegah multiple instance saat hot-reload
- Export `prisma` + `connectDB()` async function
- Mitigasi T-00-02-D (connection pool exhaustion)

**redis.ts** — ioredis dual-client:
- `redis` = publish client dari `env.REDIS_URL`
- `subClient` = `redis.duplicate()` untuk subscribe
- `createRedisAdapter()` = factory yang mengembalikan `createAdapter(redis, subClient)`

**socket.ts** — Socket.IO init:
- `io: Server | undefined` (module-level, diset oleh `initSocket`)
- `initSocket(httpServer)`: buat Server, attach Redis adapter, log connection
- CORS dari `env.FRONTEND_URL` dengan credentials

### Express App

**app.ts** — Middleware stack:
- `pino-http` dengan `redact: ['req.headers.authorization', 'req.headers.cookie']` (T-00-02-A)
- `cors` dengan `origin: env.FRONTEND_URL, credentials: true`
- `cookie-parser` (untuk JWT httpOnly cookie di Phase 1)
- `express.json({ limit: '10mb' })`
- Mount: `/api/health` → healthRouter
- 404 handler: `{ success: false, error: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' }`

**server.ts** — Entry point:
1. `http.createServer(app)`
2. `initSocket(httpServer)` — Socket.IO sebelum listen
3. `await connectDB()` — DB tersambung sebelum menerima request
4. `httpServer.listen(env.PORT)`

### Health Endpoint

**health.routes.ts** — `GET /api/health`:
- Cek DB: `prisma.$queryRaw\`SELECT 1\``
- Cek Redis: `redis.ping()` → expects `'PONG'`
- Cek Socket: dynamic import `socket.ts` → `io ? 'ready' : 'not_initialized'`
- Response: `{ success: bool, data: { db, redis, socket }, message }` — status 200 OK atau 503 Service Unavailable

### Module Directory Structure

12 modul dengan `.gitkeep`:
```
backend/src/modules/
├── auth/          ← Phase 1: login, register, OTP, JWT
├── users/         ← Phase 1: profil warga, kader, puskesmas
├── posyandu/      ← Phase 1: posyandu, jadwal, slot sesi
├── child/         ← Phase 1: balita, multi-profil
├── queue/         ← Phase 2: antrian, countdown engine
├── growth/        ← Phase 3: Z-Score WHO, grafik
├── immunization/  ← Phase 3: imunisasi, riwayat vaksin
├── ai/            ← Phase 5: chatbot, function calling, early warning
├── voice/         ← Phase 5: Google Cloud STT
├── dashboard/     ← Phase 4: monitoring
├── reports/       ← Phase 4: Excel + PDF e-PPGBM
└── notification/  ← Phase 6: Fonnte + BullMQ
```

4 shared dirs: `schemas/`, `middleware/`, `data/` (who-growth-tables.json placeholder), `utils/`

## Deviations from Plan

### Auto-fixed: .gitignore terlalu broad (Rule 3 — Blocking Issue)

- **Found during:** Task 1 commit
- **Issue:** `.gitignore` punya pattern `*.json` yang mengabaikan `nodemon.json` dan `who-growth-tables.json` — keduanya adalah file yang perlu di-track oleh git dan tercantum eksplisit dalam plan.
- **Fix:** Tambah dua baris ke `.gitignore`: `!nodemon.json` dan `!who-growth-tables.json`
- **Files modified:** `.gitignore`
- **Commit:** `59a687a`

### Keputusan Implementasi: io typed sebagai Server | undefined

- **Found during:** Task 2 (socket.ts)
- **Issue:** Plan mendeklarasikan `export let io: Server` tapi `io` belum di-set saat module diload — hanya tersedia setelah `initSocket()` dipanggil. Health route memeriksa `io ? 'ready' : 'not_initialized'` yang butuh falsy check.
- **Fix:** Diubah ke `export let io: Server | undefined` — type-safe tanpa `@ts-expect-error`
- **Impact:** health.routes.ts bisa memeriksa `io` secara type-safe; tidak ada behavior change

### Keputusan Implementasi: pino logger lokal di config files

- **Found during:** Task 2 (db.ts, redis.ts, socket.ts)
- **Issue:** Plan menyebut "log success/failure via pino logger" di db.ts tapi tidak menjelaskan import dari mana. Mengimport `logger` dari `app.ts` akan menciptakan circular dependency (app.ts → db.ts → app.ts).
- **Fix:** Setiap config file membuat pino instance lokal sendiri. `app.ts` tetap mengeksport `logger` untuk digunakan oleh server.ts dan modul-modul yang tidak berada di config layer.

## Threat Mitigations Applied

| Threat ID | Mitigasi |
|-----------|---------|
| T-00-02-A | `pino-http` dengan `redact: ['req.headers.authorization', 'req.headers.cookie']` — JWT dan cookie tidak pernah muncul di log |
| T-00-02-B | Zod mencetak nama field yang gagal ke stderr, bukan nilai env var |
| T-00-02-C | Health endpoint tanpa auth (accepted) — tidak mengembalikan PII |
| T-00-02-D | PrismaClient singleton dengan global pattern mencegah exhaustion connection pool |

## Known Stubs

| File | Stub | Alasan |
|------|------|--------|
| `backend/src/shared/data/who-growth-tables.json` | `{}` | Tabel LMS WHO 2006 akan diisi di Phase 3 sebelum Z-Score diimplementasikan. CLAUDE.md melarang formula Z-Score dari memory — harus dari file ini. |

## Threat Flags

Tidak ada surface baru di luar yang sudah terdokumentasi di `<threat_model>` plan ini.

## Self-Check: PASSED

**Files exist:**
- `backend/Dockerfile` — FOUND
- `backend/package.json` — FOUND
- `backend/tsconfig.json` — FOUND
- `backend/nodemon.json` — FOUND
- `backend/src/config/env.ts` — FOUND
- `backend/src/config/db.ts` — FOUND
- `backend/src/config/redis.ts` — FOUND
- `backend/src/config/socket.ts` — FOUND
- `backend/src/app.ts` — FOUND
- `backend/src/server.ts` — FOUND
- `backend/src/modules/health/health.routes.ts` — FOUND
- `backend/src/shared/data/who-growth-tables.json` — FOUND
- All 12 module .gitkeep files — FOUND

**Commits exist:**
- `59a687a` — feat(00-02): backend scaffold
- `78ca7d4` — feat(00-02): backend config layer, Express app, and health endpoint
