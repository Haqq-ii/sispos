---
phase: 01-auth-wilayah
plan: "04"
subsystem: frontend-auth
tags: [register, otp, wilayah, citizen, frontend, react, tanstack-query]
dependency_graph:
  requires: ["01-01", "01-02", "01-03"]
  provides: ["citizen-register-flow", "wilayah-cascade-component", "otp-input-component"]
  affects: ["frontend/router", "frontend/auth-pages"]
tech_stack:
  added: []
  patterns:
    - "react-hook-form + zodResolver — onBlur validation mode (same as LoginForm pattern)"
    - "TanStack Query staleTime 1h for wilayah data (rarely changes)"
    - "sessionStorage for cross-page phone number handoff between register and OTP pages"
    - "Cascade Select reset pattern: onChange clears downstream selections"
    - "OTP auto-submit via 300ms setTimeout after 6th digit entered"
    - "Password strength 3-level bar computed inline without external library"
key_files:
  created:
    - frontend/src/lib/validations/register.schema.ts
    - frontend/src/hooks/useOtpCountdown.ts
    - frontend/src/hooks/useWilayah.ts
    - frontend/src/components/auth/OtpInput.tsx
    - frontend/src/components/wilayah/WilayahSelect.tsx
    - frontend/src/pages/auth/RegisterPage.tsx
    - frontend/src/pages/auth/VerifikasiOtpPage.tsx
    - frontend/src/pages/auth/OnboardingLokasiPage.tsx
    - frontend/src/pages/auth/LokasiSelesaiPage.tsx
  modified:
    - frontend/src/router/index.tsx
    - frontend/tailwind.config.js
decisions:
  - "sessionStorage ('reg_ponsel', 'reg_ponsel_masked') digunakan untuk handoff nomor HP dari RegisterPage ke VerifikasiOtpPage — scope tab-only, cleared on success, accepted per T-04-01"
  - "Password strength dihitung inline (tanpa library) untuk menghindari dependency baru"
  - "animate-shake ditambahkan ke tailwind.config.js (keyframes + animation) agar OtpInput error state bisa menggunakan Tailwind class"
  - "WilayahSelect menggunakan Loader2 spinner di dalam SelectTrigger (bukan Skeleton) sesuai spesifikasi PLAN.md Task 2 Step 1"
metrics:
  duration: "~40 menit"
  completed_date: "2026-07-01"
  tasks_completed: 2
  files_created: 9
  files_modified: 2
---

# Phase 01 Plan 04: Register Frontend Flow — Summary

**One-liner:** Citizen register flow end-to-end: form (NIK/HP/password) → OTP verify (6-box countdown) → lokasi cascade (4-level wilayah) → success screen, dengan Zod schema, TanStack Query wilayah hooks, dan OtpInput komponen reusable.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Register schema + hooks + OtpInput component | `8f7ede2` | register.schema.ts, useOtpCountdown.ts, useWilayah.ts, OtpInput.tsx, tailwind.config.js |
| 2 | WilayahSelect + 4 register pages + router update | `47ffff0` | WilayahSelect.tsx, RegisterPage.tsx, VerifikasiOtpPage.tsx, OnboardingLokasiPage.tsx, LokasiSelesaiPage.tsx, router/index.tsx |

## Deliverables

### register.schema.ts
Zod schema untuk form registrasi citizen. Fields: `nikIbu` (16 digit numeric), `namaLengkap` (min 2, max 200 char), `nomorPonsel` (regex `^(08|\+628)\d{8,11}$`), `password` (min 8), `konfirmasi` (refine: harus sama dengan password). Berisi sync comment ke `backend/src/shared/schemas/auth.schema.ts` sesuai PLAN.md.

### useOtpCountdown.ts
Hook `useOtpCountdown(initialSeconds = 60)` dengan `setInterval` yang auto-decrement, cleanup on unmount. Returns `{ seconds, isExpired: seconds <= 0, reset }`.

### useWilayah.ts
Empat TanStack Query hooks: `useProvinsi`, `useKabupaten(provinsi)`, `useKecamatan(kabupaten, provinsi)`, `useKelurahan(kecamatan, kabupaten, provinsi)`. Semua dengan `staleTime: 1 jam`. Level `kabupaten`/`kecamatan`/`kelurahan` hanya `enabled` saat parent dipilih.

### OtpInput.tsx
6-box OTP input dengan:
- Auto-advance: saat digit diisi, fokus pindah ke kotak berikutnya
- Backspace pada kotak kosong → fokus ke kotak sebelumnya
- Paste support: menyebar 6 karakter ke semua kotak sekaligus
- `aria-label="Digit ke-{N}"` pada setiap input
- Error state: `animate-shake` via Tailwind class + `border-destructive`
- Auto-call `onComplete()` setelah 300ms saat semua 6 kotak terisi

### WilayahSelect.tsx
Cascade 4-level: Provinsi → Kabupaten → Kecamatan → Kelurahan. Setiap level: loading spinner di SelectTrigger, reset downstream saat parent berubah, error state dengan tombol retry. Interface `WilayahValue` di-export untuk dipakai halaman konsumer.

### RegisterPage.tsx
Halaman registrasi citizen (`/register`):
- Back button ke `/login`
- Form fields: NIK (live counter X/16), Nama, HP, Password (strength bar 3-level: lemah/sedang/kuat), Konfirmasi
- Show/hide toggle dengan `aria-pressed` pada kedua field password
- Submit: `POST /api/auth/register` → simpan ponsel ke sessionStorage → navigate ke `/register/verifikasi`
- Error mapping: `NIK_SUDAH_TERDAFTAR` → field error, `HP_SUDAH_TERDAFTAR` → field error, server error → Alert destructive

### VerifikasiOtpPage.tsx
Halaman verifikasi OTP (`/register/verifikasi`):
- Redirect ke `/register` jika sessionStorage kosong
- OtpInput 6-box + useOtpCountdown 60s
- Auto-submit 300ms setelah digit ke-6 diisi
- Resend max 3x dengan state counter
- Submit: `POST /api/auth/otp/verify` → setUser di authStore → navigate ke `/register/lokasi`
- Error: `aria-live="polite"` region, shake animation via OtpInput `error` prop

### OnboardingLokasiPage.tsx
Halaman onboarding lokasi (`/register/lokasi`):
- WilayahSelect cascade
- RW/RT fields (numeric, max 3 char) muncul setelah Kelurahan dipilih
- CTA "Simpan Lokasi": enabled hanya saat semua 4 level dipilih
- Submit: `PATCH /api/auth/lokasi` → navigate ke `/register/lokasi-selesai` dengan state lokasi
- Skip button: variant ghost → `/citizen/dashboard`

### LokasiSelesaiPage.tsx
Success screen (`/register/lokasi-selesai`):
- CheckCircle icon 64px strokeWidth 1.5
- Ringkasan lokasi dari `location.state` (jika ada)
- Auto-redirect ke `/citizen/dashboard` setelah 5s dengan countdown display
- CTA "Mulai Gunakan SISPOS" untuk immediate redirect

### router/index.tsx (update)
Tambah 4 lazy routes: `/register`, `/register/verifikasi`, `/register/lokasi`, `/register/lokasi-selesai`. Semua public (tidak dibungkus ProtectedRoute). Routes 01-02 tidak dimodifikasi.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Tambah shake animation ke tailwind.config.js**
- **Found during:** Task 1 (OtpInput.tsx)
- **Issue:** Plan menyebut `animate-shake` sebagai Tailwind class untuk error state OtpInput, tetapi class ini tidak ada di tailwind.config.js default
- **Fix:** Tambah `keyframes.shake` (translateX 0 → -4px → 4px → -4px → 0) dan `animation.shake` (0.5s ease-in-out) ke `tailwind.config.js`
- **Files modified:** `frontend/tailwind.config.js`
- **Commit:** `8f7ede2`

### Install Note
Semua package (`react-hook-form`, `zod`, `@hookform/resolvers`) dan shadcn components (`button`, `input`, `label`, `form`, `select`, `card`, `badge`, `alert`, `separator`, `skeleton`) sudah terinstall dari plan 01-02. Tidak ada install tambahan diperlukan.

### Worktree Base Recovery
Worktree ditemukan dalam state branch mismatch (HEAD di `466b2c3` "first commit" instead of expected `73b5025`). Recovery: `git reset --hard 73b502596f1ebc87d3fec427850e2adfed5c5f2c` di startup worktree_branch_check step. npm install dijalankan di worktree untuk verifikasi TypeScript.

## Known Stubs

Tidak ada. Semua halaman terhubung ke API backend nyata (01-01 endpoints). Placeholder text yang ada adalah form field `placeholder` HTML attribute (copy UI), bukan konten yang hardcoded.

## Threat Flags

Tidak ada surface baru di luar yang sudah terdaftar di threat model PLAN.md (T-04-01 s/d T-04-SC). Semua API calls menggunakan endpoints yang sudah ada dari 01-01 dan 01-03.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| register.schema.ts exists | FOUND |
| useOtpCountdown.ts exists | FOUND |
| useWilayah.ts exists | FOUND |
| OtpInput.tsx exists | FOUND |
| WilayahSelect.tsx exists | FOUND |
| RegisterPage.tsx exists | FOUND |
| VerifikasiOtpPage.tsx exists | FOUND |
| OnboardingLokasiPage.tsx exists | FOUND |
| LokasiSelesaiPage.tsx exists | FOUND |
| Task 1 commit `8f7ede2` exists | FOUND |
| Task 2 commit `47ffff0` exists | FOUND |
| 4 register routes in router | FOUND |
| TypeScript `tsc --noEmit` | PASS |
