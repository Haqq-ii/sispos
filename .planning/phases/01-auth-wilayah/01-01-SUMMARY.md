---
phase: 01-auth-wilayah
plan: "01"
subsystem: auth-backend
tags: [auth, jwt, bcrypt, bullmq, otp, fonnte, zod, shadcn]
dependency_graph:
  requires: []
  provides:
    - "POST /api/auth/register (citizen registration + OTP enqueue)"
    - "POST /api/auth/otp/send (OTP resend)"
    - "POST /api/auth/otp/verify (OTP verify + JWT cookie set)"
    - "PATCH /api/auth/lokasi (JWT-protected location update)"
    - "BullMQ notification queue (name: notification)"
    - "Zod auth schemas (shared BE artifact)"
    - "shadcn/ui components (frontend: button, input, label, form, select, card, badge, alert, separator, skeleton)"
  affects:
    - "01-02 (login flow — depends on issueTokens, authMiddleware pattern)"
    - "01-03 (wilayah API — depends on authRouter mounting pattern in app.ts)"
    - "01-04 (frontend register pages — depends on shadcn components + auth schemas)"
tech_stack:
  added:
    - "jsonwebtoken@^9.0.2 (JWT sign/verify)"
    - "bcrypt@^5.1.1 (password hashing)"
    - "@types/jsonwebtoken@^9.0.6"
    - "@types/bcrypt@^5.0.2"
    - "react-hook-form@^7.80 (frontend forms)"
    - "zod@^4.4.3 (frontend validation)"
    - "@hookform/resolvers@^5.4.0 (RHF + Zod integration)"
    - "@radix-ui/react-label, react-select, react-separator, react-slot (shadcn deps)"
  patterns:
    - "BullMQ Queue/Worker menggunakan parsed Redis URL options (bukan IORedis instance) untuk menghindari type conflict ioredis@5 vs bullmq bundled ioredis"
    - "OTP lifecycle: generate → invalidate old → create new → enqueue WA job (tidak pernah kirim langsung ke Fonnte)"
    - "JWT disimpan di httpOnly cookie (sameSite: lax, secure: production only)"
    - "Error codes sebagai (err as NodeJS.ErrnoException).code untuk propagasi ke controller"
key_files:
  created:
    - backend/src/shared/schemas/auth.schema.ts
    - backend/src/modules/notification/otp.job.ts
    - backend/src/modules/notification/notification.queue.ts
    - backend/src/modules/notification/notification.worker.ts
    - backend/src/modules/auth/auth.service.ts
    - backend/src/modules/auth/auth.controller.ts
    - backend/src/modules/auth/auth.routes.ts
    - frontend/src/components/ui/button.tsx
    - frontend/src/components/ui/input.tsx
    - frontend/src/components/ui/label.tsx
    - frontend/src/components/ui/form.tsx
    - frontend/src/components/ui/select.tsx
    - frontend/src/components/ui/card.tsx
    - frontend/src/components/ui/badge.tsx
    - frontend/src/components/ui/alert.tsx
    - frontend/src/components/ui/separator.tsx
    - frontend/src/components/ui/skeleton.tsx
  modified:
    - backend/src/config/env.ts (added FONNTE_API_KEY, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_ROUNDS)
    - backend/src/app.ts (mounted authRouter at /api/auth)
    - backend/package.json (added jsonwebtoken, bcrypt + @types)
    - frontend/package.json (added react-hook-form, zod, @hookform/resolvers, @radix-ui/*)
decisions:
  - "BullMQ connection menggunakan parsed URL options bukan IORedis instance — menghindari TypeScript type conflict antara ioredis@5 top-level dan ioredis yang di-bundle oleh bullmq@5.7"
  - "FONNTE_API_KEY dibuat required (min(1)) sesuai spec plan — runtime akan gagal jika tidak di-set; perlu ditambahkan ke docker-compose.yml environment dan .env sebelum go-live"
  - "OTP kode menggunakan crypto.randomInt(100000, 999999) — 6 digit, nilai 100000-999998 (inclusive)"
metrics:
  duration: "14 minutes"
  completed: "2026-06-30T13:38:27Z"
  tasks_completed: 3
  files_created: 17
  files_modified: 4
---

# Phase 01 Plan 01: Auth Backend — Shared Schemas, BullMQ Notification, Auth Endpoints Summary

**One-liner:** JWT httpOnly cookie auth backend dengan OTP via BullMQ + Fonnte, 4 endpoint /api/auth, dan 10 shadcn/ui components untuk frontend.

## Tasks Completed

| Task | Type | Commit | Files |
|------|------|--------|-------|
| Task 0: Package Install | chore | `acb3e23` | backend/package.json, frontend/package.json, 10 shadcn UI components |
| Task 1: Shared schemas + env + notification | feat | `4975ffc` | env.ts, auth.schema.ts, otp.job.ts, notification.queue.ts, notification.worker.ts |
| Task 2: Auth module + app.ts wire | feat | `be11d90` | auth.service.ts, auth.controller.ts, auth.routes.ts, app.ts |

## What Was Built

### Backend Auth Endpoints

- **POST /api/auth/register** — Terima NIK 16 digit, namaLengkap, nomorPonsel, password. Validasi Zod. Cek duplikasi NIK + HP. Hash bcrypt. Buat Warga (belum_verifikasi). Generate OTP. Invalidasi OTP lama. Enqueue job WA ke BullMQ `notification` queue.
- **POST /api/auth/otp/send** — Resend OTP ke nomor yang terdaftar.
- **POST /api/auth/otp/verify** — Verifikasi OTP (check sudahDipakai=false, kedaluwarsa TTL). Update Warga ke `terverifikasi`. Issue JWT (access+refresh) sebagai httpOnly cookie.
- **PATCH /api/auth/lokasi** — Verifikasi JWT dari cookie, update provinsi/kabupaten/kecamatan/kelurahan/rw/rt.

### BullMQ + Fonnte Integration

`notification.queue.ts` mengekspor `notificationQueue` (Queue BullMQ bernama `notification`) dan `enqueueOtpJob`. Worker (`notification.worker.ts`) mengkonsumsi job `otp_whatsapp` dan mengirim WA via Fonnte API dengan retry 3x exponential backoff (1s, 5s, 30s). **WA tidak pernah dikirim langsung ke Fonnte (CLAUDE.md rule)**.

### Shared Zod Schemas

`auth.schema.ts` mengekspor RegisterSchema, OtpSendSchema, OtpVerifySchema, UpdateLokasiSchema — bisa dipakai di FE (plan 01-04) untuk validasi form yang konsisten.

### Frontend Components (untuk plan 01-04)

10 shadcn/ui components tersedia di `frontend/src/components/ui/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BullMQ ioredis type conflict**

- **Found during:** Task 1 TypeScript verification (`npx tsc --noEmit`)
- **Issue:** `bullmq@5.7.0` bundles ioredis sendiri di `node_modules/bullmq/node_modules/ioredis/`, menyebabkan type conflict ketika passing `IORedis` instance dari top-level `ioredis@^5.4.1`
- **Fix:** `notification.queue.ts` dan `notification.worker.ts` menggunakan parsed Redis URL options (object literal dengan host, port, password, maxRetriesPerRequest: null) alih-alih mengimpor IORedis instance dari `config/redis.ts`. Structural typing TypeScript tetap valid.
- **Files modified:** `notification.queue.ts`, `notification.worker.ts`
- **Commit:** `4975ffc` (sudah di-fix sebelum commit pertama Task 1)

### Configuration Notes (bukan deviasi, tapi perlu tindak lanjut)

- `FONNTE_API_KEY` dibuat required (`z.string().min(1)`) sesuai plan. Docker-compose.yml perlu diupdate untuk meneruskan variabel ini ke container backend. File `.env` perlu diisi dengan API key Fonnte yang valid sebelum go-live.
- `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` memiliki default value (`15m`, `7d`) sehingga tidak memerlukan perubahan `.env` segera.

## Threat Surface Scan

Tidak ada permukaan ancaman baru di luar apa yang sudah didefinisikan di `<threat_model>` plan ini. Semua endpoint baru berada dalam `/api/auth/*` yang dikecualikan dari `authMiddleware` per CLAUDE.md — ini sesuai desain.

## Known Stubs

Tidak ada stub. Semua endpoint terhubung ke Prisma (DB) dan BullMQ.

## Self-Check: PASSED

- [x] `backend/src/config/env.ts` — ditemukan, berisi FONNTE_API_KEY, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_ROUNDS
- [x] `backend/src/shared/schemas/auth.schema.ts` — ditemukan, mengekspor RegisterSchema, OtpSendSchema, OtpVerifySchema, UpdateLokasiSchema
- [x] `backend/src/modules/notification/notification.queue.ts` — ditemukan, mengekspor notificationQueue, enqueueOtpJob
- [x] `backend/src/modules/notification/notification.worker.ts` — ditemukan, mengekspor notificationWorker
- [x] `backend/src/modules/notification/otp.job.ts` — ditemukan, mengekspor OtpJobData, OTP_JOB_NAME
- [x] `backend/src/modules/auth/auth.service.ts` — ditemukan, mengekspor issueTokens, registerWarga, sendOtp, verifyOtpAndLogin, updateLokasi
- [x] `backend/src/modules/auth/auth.controller.ts` — ditemukan
- [x] `backend/src/modules/auth/auth.routes.ts` — ditemukan, mengekspor authRouter
- [x] `backend/src/app.ts` — berisi `app.use('/api/auth', authRouter)` (active)
- [x] 10 shadcn UI components — ditemukan di `frontend/src/components/ui/`
- [x] Commit `acb3e23` (Task 0) — terverifikasi di git log
- [x] Commit `4975ffc` (Task 1) — terverifikasi di git log
- [x] Commit `be11d90` (Task 2) — terverifikasi di git log
- [x] `npx tsc --noEmit` — exit code 0 (clean compilation)
