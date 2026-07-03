---
phase: 04-dashboard-dss-ai-chatbot
plan: "02"
subsystem: users-audit-puskesmas
tags: [kader-management, audit-log, master-overrule, prisma-transaction, idor-guard, unit-tests]
dependency_graph:
  requires:
    - 04-01 (PuskesmasLayout + dashboard backend — routes nested di bawah PuskesmasLayout)
  provides:
    - GET /api/users/kader (kader list scoped by puskesmasId JWT)
    - PATCH /api/users/kader/:id/unlock (master overrule + AuditLog MASTER_OVERRULE atomic)
    - GET /api/audit-log?page=1&limit=20 (paginated audit log scoped to puskesmas)
    - ManajemenPenggunaPage at /puskesmas/pengguna
    - AuditLogPage at /puskesmas/audit-log
  affects:
    - backend/src/app.ts (usersRouter + auditRouter registered)
    - frontend/src/router/index.tsx (placeholder diganti dengan komponen asli)
tech_stack:
  added: []
  patterns:
    - prisma.$transaction wraps kader.update + auditLog.create (MASTER_OVERRULE atomicity)
    - IDOR guard via posyandu.puskesmasId comparison in service layer
    - kaderIds computed server-side from puskesmasId JWT (audit log scoping)
    - vitest vi.mock factory pattern untuk unit test tanpa DB connection
key_files:
  created:
    - backend/src/modules/users/users.service.ts
    - backend/src/modules/users/users.controller.ts
    - backend/src/modules/users/users.routes.ts
    - backend/src/modules/audit/audit.service.ts
    - backend/src/modules/audit/audit.controller.ts
    - backend/src/modules/audit/audit.routes.ts
    - backend/tests/users.test.ts
    - frontend/src/pages/puskesmas/ManajemenPenggunaPage.tsx
    - frontend/src/pages/puskesmas/AuditLogPage.tsx
  modified:
    - backend/src/app.ts (usersRouter + auditRouter registered)
    - frontend/src/router/index.tsx (ManajemenPenggunaPage + AuditLogPage lazy imported)
decisions:
  - "PLAN path di users.test.ts salah (../../src/) — PATH BENAR dari backend/tests/ adalah ../src/ (satu level naik, bukan dua)"
  - "4 tests ditulis (bukan 3) — termasuk test findMany scoping untuk getKaderList"
  - "AuditLog OR clause: jika kaderIds kosong, klausa in: [] di-skip untuk menghindari error Prisma"
  - "AuditLogPage pagination control hanya tampil jika totalPages > 1 (single-page list tidak perlu nav)"
metrics:
  duration: "~15 min"
  completed: "2026-07-03"
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 2
---

# Phase 04 Plan 02: Manajemen Kader + Audit Log Summary

**One-liner:** Users backend modul dengan IDOR guard + prisma.$transaction MASTER_OVERRULE; audit log backend scoped by kaderIds server-side; ManajemenPenggunaPage kader list + unlock button; AuditLogPage paginated table; 4 unit tests lulus.

## What Was Built

### Task 1 — Users Backend Module + Unit Tests

**users.service.ts:**
- `getKaderList(puskesmasId)` — `prisma.kader.findMany` dengan `where: { posyandu: { puskesmasId } }`, include posyandu.namaPosyandu, orderBy posyandu + namaLengkap
- `unlockKader(kaderId, puskesmasId, meta)` — IDOR guard via `kader.posyandu.puskesmasId !== puskesmasId` → throw `AKSES_DITOLAK`; `prisma.$transaction` atomic: `kader.update(gagalLogin=0, terkunciSampai=null)` + `auditLog.create(aksi='MASTER_OVERRULE')`

**users.controller.ts:** `getKaderListHandler` + `unlockKaderHandler` dengan error mapping 404/403/500

**users.routes.ts:** `GET /kader` + `PATCH /kader/:id/unlock` — keduanya di belakang `authMiddleware + requireRole('puskesmas')`

**app.ts:** `usersRouter` didaftarkan di `/api/users` setelah `dashboardRouter`

**users.test.ts (backend/tests/):**
- 4 tests, semua lulus
- `getKaderList`: verifikasi `findMany` dipanggil dengan `where: { posyandu: { puskesmasId } }`
- `unlockKader`: throws `AKSES_DITOLAK` (IDOR), memanggil `$transaction` (guard lolos), throws `KADER_TIDAK_DITEMUKAN` (null kader)

**Deviasi kecil:** PLAN menyebut path test sebagai `'../../src/config/db'` tetapi path yang BENAR dari `backend/tests/` adalah `'../src/config/db'` (satu level naik ke `backend/`, bukan dua level). Fixed inline — Deviation Rule 3.

### Task 2 — ManajemenPenggunaPage + Router Update

**ManajemenPenggunaPage.tsx:**
- `useQuery(['users','kader'])` → `GET /api/users/kader`
- `useMutation` → `PATCH /users/kader/{id}/unlock` + `invalidateQueries` + toast
- Lock helper `isLocked()` — cek `terkunciSampai !== null && new Date(terkunciSampai) > new Date()`
- Badge status: merah "Terkunci" (dengan icon LockKeyhole + tombol "Buka Kunci"), hijau "Ketua", abu-abu secondary "Aktif"
- Tombol "Buka Kunci" disabled + spinner "Membuka..." saat `isPending`
- Counter gagalLogin informasional: "Percobaan gagal: N/10"
- Loading skeleton (3 placeholder rows), empty state, error state

**router/index.tsx:** Lazy import `ManajemenPenggunaPage`, route `/puskesmas/pengguna` diganti dari `HalamanDevelopment`.

### Task 3 — Audit Log Backend + AuditLogPage

**audit.service.ts:**
- `getAuditLog(puskesmasId, page, limit)` — Step 1: collect kaderIds via `prisma.kader.findMany({ where: { posyandu: { puskesmasId } } })`; Step 2: OR clause `[{ userId: puskesmasId, userRole: 'puskesmas' }, { userId: { in: kaderIds } }]` (kaderIds kosong di-skip); Step 3: `prisma.auditLog.findMany` + `count` parallel
- Return `{ data, meta: { total, page, limit, totalPages } }`

**audit.controller.ts:** `getAuditLogHandler` — page/limit parsing (limit max 100), respond 200 `{ success, data, meta }`

**audit.routes.ts:** `GET /` → `authMiddleware + requireRole('puskesmas')`

**app.ts:** `auditRouter` didaftarkan di `/api/audit-log` setelah `usersRouter`

**AuditLogPage.tsx:**
- `useQuery(['audit-log', page])` dengan `staleTime: 30_000`
- Table kolom: Waktu (DD/MM/YYYY HH:MM), Pengguna (userId truncate 8 + role badge), Aksi (monospace chip), Tabel, Record ID (truncate 8)
- Role badge color: biru (puskesmas), hijau (kader/ketua_kader), ungu (citizen)
- Pagination: tombol Sebelumnya/Selanjutnya disabled di batas; "Halaman N dari M (X entri)"
- Pagination hanya tampil jika `totalPages > 1`
- Loading skeleton, empty state ("Belum ada aktivitas tercatat."), error state

**router/index.tsx:** Lazy import `AuditLogPage`, route `/puskesmas/audit-log` diganti dari `HalamanDevelopment`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Path test vi.mock salah di PLAN.md**
- **Found during:** Task 1 — test gagal dengan error `process.exit unexpectedly called with "1"` karena env.ts dieksekusi
- **Issue:** PLAN menyebut `vi.mock('../../src/config/db', ...)` tetapi dari `backend/tests/users.test.ts`, `../../` naik 2 level ke `D:/Semester 4/PSI/sispos/` (bukan `backend/`), menyebabkan path tidak match dan module asli di-load
- **Fix:** Ganti semua mock path ke `'../src/config/db'` dan `'../src/config/env'` (satu level naik ke `backend/`, lalu masuk `src/`)
- **Files modified:** `backend/tests/users.test.ts`
- **Commit:** `c30ffb5`

## Known Stubs

- `/puskesmas/laporan` → masih placeholder `HalamanDevelopment` (diimplementasi di plan mendatang)
- Posyandu lat/lng masih NULL untuk seed data yang ada — PetaStuntingPage tetap menampilkan empty state (sudah diketahui dari Plan 04-01)

## Threat Flags

Tidak ada threat surface baru di luar yang sudah ada di `<threat_model>`:
- T-04-02-01: IDOR unlockKader — MITIGATED (IDOR guard via posyandu.puskesmasId dalam service)
- T-04-02-02: AuditLog atomicity — MITIGATED (prisma.$transaction)
- T-04-02-03: Elevation of privilege unlock — MITIGATED (requireRole('puskesmas'))
- T-04-02-04: Info disclosure kader list — MITIGATED (requireRole + puskesmasId dari JWT)
- T-04-02-05: Info disclosure audit log — MITIGATED (requireRole + scoped by kaderIds)
- T-04-02-06: IDOR audit log — MITIGATED (kaderIds computed server-side dari JWT)

## Self-Check: PASSED

Files yang dibuat semua ada:
- backend/src/modules/users/users.service.ts ✓
- backend/src/modules/users/users.controller.ts ✓
- backend/src/modules/users/users.routes.ts ✓
- backend/src/modules/audit/audit.service.ts ✓
- backend/src/modules/audit/audit.controller.ts ✓
- backend/src/modules/audit/audit.routes.ts ✓
- backend/tests/users.test.ts ✓
- frontend/src/pages/puskesmas/ManajemenPenggunaPage.tsx ✓
- frontend/src/pages/puskesmas/AuditLogPage.tsx ✓

Commits:
- c30ffb5: feat(04-02): users backend module + unit tests ✓
- 3bef8f8: feat(04-02): ManajemenPenggunaPage + router update ✓
- 23dcf1e: feat(04-02): audit log backend module + AuditLogPage ✓

Tests: 4/4 lulus (npx vitest run tests/users.test.ts)
TypeScript: 0 errors (npx tsc --noEmit)
