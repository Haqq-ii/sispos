---
phase: 01-auth-wilayah
plan: "02"
subsystem: auth-full-stack
tags: [auth, login, jwt, bcrypt, kader-lockout, react, react-hook-form, zod, tanstack-query, axios, shadcn, protected-route]
dependency_graph:
  requires:
    - "01-01 (issueTokens, auth schemas, shadcn UI components, app.ts mounting)"
  provides:
    - "POST /api/auth/login (single gateway — detects citizen/kader/puskesmas from identifier format)"
    - "POST /api/auth/refresh (new access_token from refresh_token cookie)"
    - "POST /api/auth/logout (clear both httpOnly cookies)"
    - "authMiddleware (verify access_token cookie — ready for Phase 2+ route protection)"
    - "LoginPage /login (single gateway login UI with auto role-detection)"
    - "RoleBadge + detectRole (citizen/kader/puskesmas badge based on identifier input)"
    - "KaderLockScreen (MM:SS countdown overlay on 403 AKUN_TERKUNCI)"
    - "ProtectedRoute (redirects unauthenticated users to /login)"
    - "Axios 401 interceptor with refresh-then-retry logic"
  affects:
    - "01-03 (wilayah API — authMiddleware ready to protect all future routes)"
    - "01-04 (register pages — router pattern set, ProtectedRoute available)"
    - "All Phase 2+ modules (authMiddleware provides req.user for all protected endpoints)"
tech_stack:
  added: []
  patterns:
    - "Single gateway login via detectRole(identifier) — 16-digit NIK=citizen, 08/+62=kader, @=puskesmas"
    - "Kader PIN lockout: gagalLogin >= 10 → terkunciSampai = NOW()+30min; cek sebelum bcrypt agar hemat CPU (T-02-05)"
    - "axios 401 interceptor: separate refreshClient (no interceptor) → retry originalRequest → else clearAuth + redirect"
    - "_isRetry flag pada InternalAxiosRequestConfig untuk mencegah infinite refresh loop"
    - "TanStack Query useMutation untuk login — onSuccess: setUser + navigate, onError: parse error code + set state"
key_files:
  created:
    - backend/src/modules/auth/auth.service.ts (detectRole, login, refreshAccessToken, logout appended to 01-01 functions)
    - backend/src/modules/auth/auth.controller.ts (loginHandler, refreshHandler, logoutHandler)
    - backend/src/modules/auth/auth.routes.ts (POST /login, POST /refresh, POST /logout)
    - backend/src/shared/middleware/auth.middleware.ts (authMiddleware, AuthRequest)
    - frontend/src/lib/validations/login.schema.ts
    - frontend/src/components/auth/RoleBadge.tsx
    - frontend/src/components/auth/KaderLockScreen.tsx
    - frontend/src/components/auth/LoginForm.tsx
    - frontend/src/pages/auth/LoginPage.tsx
    - frontend/src/router/ProtectedRoute.tsx
  modified:
    - frontend/src/router/index.tsx (/ → /login redirect, /login route, dashboard routes wrapped in ProtectedRoute)
    - frontend/src/lib/axios.ts (401 interceptor upgraded: refresh-then-retry with loop prevention)
decisions:
  - "refreshAccessToken Phase 1: tidak verifikasi user masih ada di DB saat refresh — cukup verify JWT_REFRESH_SECRET; hardening dijadwalkan di Phase security (sesuai plan spec)"
  - "Axios refresh client menggunakan axios.create() terpisah tanpa interceptor — mencegah infinite 401 loop saat refresh token sendiri expired"
  - "KaderLockScreen muncul sebagai overlay di LoginPage (bukan halaman terpisah) — memudahkan onUnlock callback untuk clear state dan izinkan retry"
  - "detectRole di frontend (RoleBadge.tsx) mirror logika backend (auth.service.ts) — tidak ada shared Zod schema untuk detectRole karena ia pure regex function"
metrics:
  duration: "25 minutes"
  completed: "2026-07-01T00:30:00Z"
  tasks_completed: 2
  files_created: 10
  files_modified: 2
---

# Phase 01 Plan 02: Auth Full Stack — Login/Refresh/Logout + Frontend Login UI Summary

**One-liner:** Single-gateway JWT login untuk tiga role (citizen NIK, kader HP+PIN, puskesmas email) dengan Kader 10x lockout, frontend LoginPage+RoleBadge+KaderLockScreen, ProtectedRoute, dan Axios 401 refresh interceptor.

## Tasks Completed

| Task | Type | Commit | Files |
|------|------|--------|-------|
| Task 1: Backend — login/refresh/logout + authMiddleware + Kader PIN lock | feat | `b91ebc6` | auth.service.ts (append), auth.controller.ts, auth.routes.ts, auth.middleware.ts |
| Task 2: Frontend — LoginPage + RoleBadge + KaderLockScreen + ProtectedRoute + Axios upgrade | feat | `c3f3d37` | 8 files |
| Chore: package-lock.json | chore | `5b6c5cd` | frontend/package-lock.json |

## What Was Built

### Backend: Login / Refresh / Logout

**POST /api/auth/login** — Single gateway. `detectRole(identifier)` menentukan jalur:
- `citizen`: cari `Warga.nikIbu`, cek `statusVerifikasi === 'terverifikasi'`, bcrypt.compare → set cookies
- `kader`: cari `Kader.nomorPonsel`, cek `isAktif`, cek `terkunciSampai`, bcrypt.compare(pinHash) → on fail: increment `gagalLogin`, jika >=10 set `terkunciSampai = NOW()+30min`; on success: reset `gagalLogin = 0`
- `puskesmas`: cari `Puskesmas.email`, bcrypt.compare → set cookies

**POST /api/auth/refresh** — `jwt.verify(refresh_token, JWT_REFRESH_SECRET)`, issue access_token baru, set Set-Cookie.

**POST /api/auth/logout** — `res.clearCookie('access_token', ...)` + `res.clearCookie('refresh_token', ...)`.

**authMiddleware** — Ekstrak `req.cookies.access_token`, `jwt.verify(token, JWT_SECRET)`, attach `req.user = { userId, role }`, atau return 401 dengan error code (`UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`).

### Frontend: Login UI

**`LoginPage.tsx`** (`/login`) — Centered column max-w-[400px], logo ShieldCheck + "SISPOS" wordmark + tagline. Card `bg-green-50` berisi LoginForm. `useMutation` mengirim POST `/auth/login`. On success: `setUser()` + navigate per role. On 403 AKUN_TERKUNCI: tampilkan KaderLockScreen. On error: destructive Alert.

**`RoleBadge.tsx`** — `detectRole()` (mirror backend) + shadcn Badge dengan warna per role:
- citizen → `text-green-700 border-green-600` — "Warga (Citizen)"
- kader → `text-blue-700 border-blue-600` — "Kader / Staff"
- puskesmas → `text-purple-700 border-purple-600` — "Puskesmas"

**`KaderLockScreen.tsx`** — Fixed inset-0 overlay z-50, LockKeyhole icon, MM:SS countdown via `setInterval(1000)`, `onUnlock()` dipanggil saat `remainingMs <= 0`.

**`LoginForm.tsx`** — RHF + zodResolver(loginSchema), mode `onBlur`. Identifier field (autoFocus) + RoleBadge inline. Password field dengan EyeIcon/EyeOffIcon toggle (aria-label, aria-pressed). Kader PIN warning: amber-600 jika gagalLogin >=7, red-600 jika >=9. CTA "Masuk ke SISPOS" dengan Loader2 spinner saat loading.

**`ProtectedRoute.tsx`** — `useAuthStore().isAuthenticated` → false: `Navigate to="/login" replace`.

**`router/index.tsx`** — `/` redirect ke `/login`, `/login` → LoginPage, tiga dashboard routes dibungkus ProtectedRoute.

**`axios.ts`** — Interceptor 401: gunakan `refreshClient` (axios.create terpisah) POST `/auth/refresh` → jika sukses retry original request dengan `_isRetry` flag. Jika gagal: `clearAuth()` + `window.location.href = '/login'`.

## Deviations from Plan

None — plan executed exactly as written. TypeScript compiled cleanly (`npx tsc --noEmit` exit code 0).

## Known Stubs

Tidak ada stub. LoginPage terhubung ke real API (`/api/auth/login`), KaderLockScreen menggunakan waktu nyata dari response server, ProtectedRoute membaca state nyata dari `useAuthStore`.

## Threat Surface Scan

Semua permukaan ancaman yang diintroduksi oleh plan ini sudah tercakup di `<threat_model>` plan 01-02:

| Flag | File | Description |
|------|------|-------------|
| T-02-01 mitigated | auth.service.ts | Kader lockout 10x gagal → terkunciSampai NOW()+30min — DIIMPLEMENTASI |
| T-02-02 mitigated | auth.middleware.ts | JWT signed dengan JWT_SECRET (HS256) — authMiddleware verifikasi setiap request |
| T-02-03 mitigated | axios.ts | Token hanya di httpOnly cookie, tidak pernah disimpan localStorage atau response body |
| T-02-04 mitigated | auth.middleware.ts | Role claim dari verified JWT token; Prisma queries gunakan userId dari token terverifikasi |
| T-02-05 mitigated | auth.service.ts | Cek `terkunciSampai` sebelum `bcrypt.compare` — tidak buang CPU setelah lockout |

## Self-Check: PASSED

- [x] `frontend/src/lib/validations/login.schema.ts` — ditemukan
- [x] `frontend/src/components/auth/RoleBadge.tsx` — ditemukan, mengekspor detectRole dan RoleBadge
- [x] `frontend/src/components/auth/KaderLockScreen.tsx` — ditemukan, mengekspor KaderLockScreen
- [x] `frontend/src/components/auth/LoginForm.tsx` — ditemukan
- [x] `frontend/src/pages/auth/LoginPage.tsx` — ditemukan
- [x] `frontend/src/router/ProtectedRoute.tsx` — ditemukan, mengekspor ProtectedRoute
- [x] `frontend/src/router/index.tsx` — diupdate: / → /login, /login route ada, dashboard routes wrapped
- [x] `frontend/src/lib/axios.ts` — diupdate: 401 interceptor dengan refresh-then-retry
- [x] `backend/src/shared/middleware/auth.middleware.ts` — ditemukan, mengekspor authMiddleware dan AuthRequest
- [x] Commit `b91ebc6` (Task 1 backend) — terverifikasi di git log
- [x] Commit `c3f3d37` (Task 2 frontend) — terverifikasi di git log
- [x] TypeScript compilation `node_modules/.bin/tsc --noEmit` — exit code 0 (clean)
