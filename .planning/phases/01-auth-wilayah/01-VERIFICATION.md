---
phase: 01-auth-wilayah
verified: 2026-07-01T08:00:00Z
status: human_needed
score: 14/15 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Login tiga role di browser"
    expected: "NIK 16 digit → /citizen/dashboard, HP kader → /kader/dashboard, email puskesmas → /puskesmas/dashboard"
    why_human: "Butuh DB berisi akun seed dan cookie response aktual yang tidak bisa diverifikasi via grep"
  - test: "Cascade dropdown wilayah berfungsi di browser (OnboardingLokasiPage)"
    expected: "Pilih DI Yogyakarta → dropdown Kabupaten terisi dengan 5 item; pilih Kota Yogyakarta → Kecamatan terisi 14 item; pilih Mergangsan → Kelurahan terisi Wirogunan/Brontokusuman/Keparakan"
    why_human: "Membutuhkan data DB aktual dari seed yang tidak bisa diverifikasi secara statik"
  - test: "Jumlah record wilayah di DB"
    expected: "SELECT COUNT(*) FROM wilayah >= 1500"
    why_human: "Tidak bisa query DB tanpa menjalankan container Docker"
  - test: "End-to-end registrasi citizen di browser"
    expected: "RegisterPage → form submit → OTP page (6 box) → masukkan OTP → OnboardingLokasiPage → cascade select → Simpan → LokasiSelesaiPage 5s countdown → /citizen/dashboard"
    why_human: "Butuh server aktif + FONNTE_API_KEY untuk WA OTP atau melihat BullMQ queue"
  - test: "Kader 10x PIN lockout di browser"
    expected: "Setelah 10x gagal dengan PIN salah, respons 403 menampilkan KaderLockScreen dengan countdown MM:SS"
    why_human: "Butuh akun kader seed di DB dan POST /api/auth/login 10x berurutan"
---

# Phase 01: Auth & Wilayah — Verification Report

**Phase Goal:** Tiga role (Citizen, Kader, Puskesmas) bisa login dan diarahkan ke dashboard masing-masing; OTP WhatsApp via BullMQ; seed wilayah DIY + Jateng + Jatim lengkap

**Phase Goal (Verifier wording):** Complete auth + wilayah foundation — all three roles can log in, citizen registration flow works end-to-end, and geographic cascade dropdown is backed by real wilayah data.

**Verified:** 2026-07-01T08:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (SC) | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Register citizen NIK → OTP WA terkirim via BullMQ → verifikasi → status `terverifikasi` | VERIFIED | `auth.service.ts` registerWarga: hash bcrypt, prisma.warga.create statusVerifikasi='belum_verifikasi', `createAndEnqueueOtp` calls `enqueueOtpJob`; `verifyOtpAndLogin` updates statusVerifikasi='terverifikasi'; `notification.worker.ts` sends WA via Fonnte |
| 2 | Login NIK 16 digit → JWT httpOnly cookie → redirect `/citizen/dashboard` | VERIFIED | `auth.service.ts login()` citizen path: findUnique nikIbu, bcrypt.compare, issueTokens; `auth.controller.ts loginHandler`: res.cookie access_token + refresh_token; `LoginPage.tsx`: navigate('/citizen/dashboard') on success |
| 3 | Login nomor HP → `/kader/dashboard`; Login email → `/puskesmas/dashboard` | VERIFIED | `auth.service.ts login()` kader path: findUnique nomorPonsel, cek terkunciSampai, bcrypt.compare pinHash, issueTokens; puskesmas path: findUnique email, bcrypt.compare; `LoginPage.tsx` navigate per role |
| 4 | Kader salah PIN 10x → akun terkunci 30 menit | VERIFIED | `auth.service.ts` kader path baris 242-253: `if (gagalBaru >= 10)` → `prisma.kader.update terkunciSampai = new Date(Date.now() + 30*60*1000)`; cek terkunciSampai sebelum bcrypt; `loginHandler` returns 403 AKUN_TERKUNCI; `KaderLockScreen.tsx` shows MM:SS countdown |
| 5 | Dropdown Provinsi → Kab → Kec → Kel berfungsi di frontend (data dari DB) | UNCERTAIN | Code VERIFIED: `wilayah.service.ts` 4 fungsi Prisma DISTINCT, `WilayahSelect.tsx` 4-level cascade via TanStack Query. Data DB: seed script (`prisma/seed.wilayah.ts`) ada dan commit `f14b4bc` ada di git log. SUMMARY klaim 1508 records. Perlu human verify COUNT(*) aktual |

**Score:** 4/5 VERIFIED, 1 UNCERTAIN

---

### Derived Truths (dari PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | POST /api/auth/register 201 + enqueue BullMQ OTP job | VERIFIED | `registerHandler`: Zod safeParse, `registerWarga` service, `res.status(201).json`; `enqueueOtpJob` dipanggil dalam `createAndEnqueueOtp` dengan attempts: 3, backoff exponential |
| 7 | POST /api/auth/otp/verify → Set-Cookie httpOnly + statusVerifikasi=terverifikasi | VERIFIED | `otpVerifyHandler`: `res.cookie('access_token', ...)` + `res.cookie('refresh_token', ...)` dengan httpOnly:true; `verifyOtpAndLogin` updates warga statusVerifikasi |
| 8 | PATCH /api/auth/lokasi dengan JWT valid → update DB | VERIFIED | `updateLokasiHandler`: manual JWT verify dari cookie, `UpdateLokasiSchema.safeParse`, `updateLokasi(userId, data)` → `prisma.warga.update` provinsi/kabupaten/kecamatan/kelurahan/rw/rt |
| 9 | POST /api/auth/refresh → Set-Cookie access_token baru | VERIFIED | `refreshHandler`: baca `refresh_token` cookie, `refreshAccessToken` via jwt.verify REFRESH_SECRET, `res.cookie('access_token', accessToken)` |
| 10 | POST /api/auth/logout → hapus kedua cookie | VERIFIED | `logoutHandler`: `res.clearCookie('access_token', ...)` + `res.clearCookie('refresh_token', ...)` → 200 |
| 11 | ProtectedRoute redirect ke /login jika !isAuthenticated | VERIFIED | `ProtectedRoute.tsx`: `const { isAuthenticated } = useAuthStore(); if (!isAuthenticated) return <Navigate to="/login" replace />`; router/index.tsx wrap semua dashboard routes dengan ProtectedRoute |
| 12 | GET /api/wilayah/* 4 endpoints mengembalikan data geografis | VERIFIED | `wilayah.service.ts` getProvinsi/getKabupaten/getKecamatan/getKelurahan — semua Prisma DISTINCT; `wilayah.routes.ts` tanpa authMiddleware; `app.ts` mount `app.use('/api/wilayah', wilayahRouter)` |
| 13 | Halaman RegisterPage, VerifikasiOtpPage, OnboardingLokasiPage, LokasiSelesaiPage render | VERIFIED | 4 file ada di `frontend/src/pages/auth/`, commit `47ffff0`; semua render real UI dengan form/component |
| 14 | WilayahSelect 4-level cascade memanggil GET /api/wilayah/* | VERIFIED | `WilayahSelect.tsx`: useProvinsi, useKabupaten(value.provinsi), useKecamatan(value.kabupaten, value.provinsi), useKelurahan; cascade reset pattern: onChange clears downstream |
| 15 | Submit RegisterPage → POST /auth/register → navigate /register/verifikasi | VERIFIED | `RegisterPage.tsx` baris 90: `apiClient.post('/auth/register', ...)`, onSuccess: `sessionStorage.setItem('reg_ponsel', ...)`, `navigate('/register/verifikasi')` |
| 16 | Submit VerifikasiOtpPage → POST /auth/otp/verify → setUser → navigate /register/lokasi | PARTIAL | API call + navigation VERIFIED. WARNING: type mismatch — lihat Anti-Pattern section |
| 17 | Submit OnboardingLokasiPage → PATCH /auth/lokasi → navigate /register/lokasi-selesai | VERIFIED | `OnboardingLokasiPage.tsx`: `apiClient.patch('/auth/lokasi', payload)`, onSuccess: `navigate('/register/lokasi-selesai', { state: { lokasi } })` |

**Score combined:** 14/15 VERIFIED (1 PARTIAL, 1 UNCERTAIN — SC5 = wilayah DB state)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/src/shared/schemas/auth.schema.ts` | VERIFIED | RegisterSchema, OtpSendSchema, OtpVerifySchema, UpdateLokasiSchema — semua diekspor, dikonfirmasi dibaca |
| `backend/src/modules/notification/notification.queue.ts` | VERIFIED | `notificationQueue` (Queue BullMQ 'notification'), `enqueueOtpJob` dengan attempts:3, backoff exponential |
| `backend/src/modules/notification/notification.worker.ts` | VERIFIED | Worker 'notification', fetch Fonnte, throw jika !response.ok (trigger retry), worker.on('failed') |
| `backend/src/modules/auth/auth.service.ts` | VERIFIED | issueTokens, registerWarga, sendOtp, verifyOtpAndLogin, updateLokasi, detectRole, login, refreshAccessToken, logout |
| `backend/src/modules/auth/auth.controller.ts` | VERIFIED | 7 handler: registerHandler, otpSendHandler, otpVerifyHandler, updateLokasiHandler, loginHandler, refreshHandler, logoutHandler |
| `backend/src/modules/auth/auth.routes.ts` | VERIFIED | 7 route: POST register/otp/send/otp/verify/login/refresh/logout + PATCH lokasi |
| `backend/src/shared/middleware/auth.middleware.ts` | VERIFIED | `authMiddleware`: ekstrak access_token cookie, jwt.verify, attach req.user = { userId, role }, 401 UNAUTHENTICATED/TOKEN_EXPIRED/TOKEN_INVALID |
| `backend/src/modules/wilayah/wilayah.service.ts` | VERIFIED | getProvinsi/getKabupaten/getKecamatan/getKelurahan — Prisma DISTINCT queries |
| `backend/src/modules/wilayah/wilayah.routes.ts` | VERIFIED | 4 GET routes, tanpa authMiddleware |
| `backend/src/app.ts` | VERIFIED | `app.use('/api/auth', authRouter)` dan `app.use('/api/wilayah', wilayahRouter)` keduanya aktif |
| `prisma/seed.wilayah.ts` | VERIFIED | File ada, WilayahTree hierarchy, flattenTree(), DIY+Jateng+Jatim data, commit f14b4bc |
| `frontend/src/lib/validations/register.schema.ts` | VERIFIED | registerSchema + konfirmasi refine, sync comment ke backend |
| `frontend/src/components/auth/OtpInput.tsx` | VERIFIED | 6 input, auto-advance, backspace, paste, aria-label, onComplete 300ms, animate-shake |
| `frontend/src/components/wilayah/WilayahSelect.tsx` | VERIFIED | 4 Select cascade, loading spinner, reset downstream, error+retry |
| `frontend/src/pages/auth/RegisterPage.tsx` | VERIFIED | RHF + Zod, NIK counter, password strength 3-level, POST /auth/register, 409 error mapping |
| `frontend/src/pages/auth/VerifikasiOtpPage.tsx` | VERIFIED | OtpInput 6-box, 60s countdown, resend max 3, POST /auth/otp/verify, aria-live polite |
| `frontend/src/pages/auth/OnboardingLokasiPage.tsx` | VERIFIED | WilayahSelect, RW/RT fields (tampil setelah kelurahan), PATCH /auth/lokasi, skip button |
| `frontend/src/pages/auth/LoginPage.tsx` | VERIFIED | ShieldCheck logo, LoginForm, KaderLockScreen overlay, useMutation /auth/login, navigate per role |
| `frontend/src/components/auth/RoleBadge.tsx` | VERIFIED | detectRole exported, Badge per role (green/blue/purple) |
| `frontend/src/components/auth/KaderLockScreen.tsx` | VERIFIED | fixed inset-0 overlay, LockKeyhole, MM:SS countdown setInterval, onUnlock saat remaining<=0 |
| `frontend/src/router/ProtectedRoute.tsx` | VERIFIED | isAuthenticated check, Navigate to="/login" replace |
| `frontend/src/router/index.tsx` | VERIFIED | / → /login redirect; /login; /register routes (4x); dashboard routes semua wrapped ProtectedRoute |
| `frontend/src/lib/axios.ts` | VERIFIED | refreshClient terpisah, _isRetry flag, POST /auth/refresh → retry originalRequest, clearAuth + redirect saat gagal |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.service.ts registerWarga` | BullMQ notificationQueue | `enqueueOtpJob(nomorPonsel, kodeOtp)` | VERIFIED | Baris 48 auth.service.ts: `await enqueueOtpJob(nomorPonsel, kodeOtp)` di dalam `createAndEnqueueOtp` |
| `notification.worker.ts` | Fonnte API | `fetch('https://api.fonnte.com/send', { Authorization: env.FONNTE_API_KEY })` | VERIFIED | Baris 34-41 notification.worker.ts, throw jika !response.ok |
| `LoginForm` | POST /api/auth/login | `useMutation → apiClient.post('/auth/login')` | VERIFIED | `LoginPage.tsx` baris 48-49: `apiClient.post<LoginResponse>('/auth/login', ...)` |
| `auth.middleware.ts` | req.cookies.access_token | `jwt.verify(token, env.JWT_SECRET) → attach req.user` | VERIFIED | auth.middleware.ts baris 17-46: ekstrak, verify, attach |
| `ProtectedRoute` | useAuthStore.isAuthenticated | Navigate to="/login" if false | VERIFIED | ProtectedRoute.tsx baris 9-12 |
| `axios.ts interceptor` | POST /api/auth/refresh | refreshClient.post('/auth/refresh') on 401 before redirect | VERIFIED | axios.ts baris 59-63: separate refreshClient, retry originalRequest |
| `wilayah.service.ts getKabupaten` | Prisma DISTINCT kabupaten | `prisma.wilayah.findMany distinct:['kabupaten']` | VERIFIED | wilayah.service.ts baris 19-25 |
| `app.ts` | wilayahRouter | `app.use('/api/wilayah', wilayahRouter)` | VERIFIED | app.ts baris 43 |
| `seed.wilayah.ts` | prisma.wilayah.createMany | `flattenTree() → createMany skipDuplicates:true` | VERIFIED | seed.wilayah.ts baris 33-45 flattenTree, batch createMany DIY+Jateng+Jatim |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `WilayahSelect.tsx` | provinsiQuery.data | useProvinsi → GET /api/wilayah/provinsi → prisma.wilayah DISTINCT | DB query (real) | VERIFIED — tapi DB seed state perlu human check |
| `LoginPage.tsx` | response.data.data.user | POST /api/auth/login → login() → prisma.warga/kader/puskesmas findUnique | Real DB lookup | VERIFIED |
| `VerifikasiOtpPage.tsx` | response.data.data | POST /api/auth/otp/verify → verifyOtpAndLogin() | Real OTP DB check | VERIFIED (backend). Warning: data type mismatch di frontend — lihat Anti-Patterns |
| `notification.worker.ts` | OtpJobData.kodeOtp | BullMQ queue → Fonnte API | Real API call | VERIFIED |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED untuk endpoint yang membutuhkan server aktif dan DB berisi data. Endpoint tidak bisa diuji tanpa Docker containers running.

---

### Probe Execution

Tidak ada probe scripts di `scripts/*/tests/probe-*.sh` ditemukan. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 01-01, 01-04 | Citizen register NIK + OTP WA + verifikasi | SATISFIED | registerWarga + enqueueOtpJob + verifyOtpAndLogin, RegisterPage/VerifikasiOtpPage/OnboardingLokasiPage |
| AUTH-02 | 01-02 | Citizen login NIK + password → /citizen/dashboard | SATISFIED | login() citizen path + loginHandler + LoginPage |
| AUTH-03 | 01-02 | Kader login HP + PIN → /kader/dashboard | SATISFIED | login() kader path + KaderLockScreen |
| AUTH-04 | 01-02 | Puskesmas login email → /puskesmas/dashboard | SATISFIED | login() puskesmas path |
| AUTH-05 | 01-02 | Single gateway deteksi role dari format identifier | SATISFIED | detectRole(): /^\d{16}$/ → citizen, /^(08|\+62)/ → kader, /@/ → puskesmas |
| AUTH-06 | 01-02 | Refresh + logout + Kader 10x lock 30 menit | SATISFIED | refreshHandler, logoutHandler, kader gagalLogin>=10 → terkunciSampai |
| AUTH-07 | 01-03, 01-04 | Wilayah seed DIY+Jateng+Jatim, cascade dropdown | PARTIAL | Code VERIFIED, DB state perlu human verification |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/auth/VerifikasiOtpPage.tsx` | 13-18, 59 | `VerifyOtpResponse` interface mendefinisikan `data: AuthUser` tapi backend mengembalikan `data: { user: AuthUser }`. `setUser(response.data.data)` di runtime menerima `{ user: AuthUser }` bukan `AuthUser` | WARNING | Auth store user object setelah OTP verify akan berisi `{ user: {id, namaLengkap, role} }` bukan `{id, namaLengkap, role}`. `isAuthenticated=true` tetap diset, navigasi berjalan, tapi `user.role`, `user.namaLengkap`, `user.id` akan `undefined` di store sampai user login ulang via LoginPage |
| `frontend/src/pages/auth/RegisterPage.tsx` | 25, 97 | `RegisterResponse` interface menggunakan `maskedPhone` tapi backend mengembalikan `nomorPonselMasked`. Fallback ke `variables.nomorPonsel` (nomor tidak termasked) | INFO | OTP page menampilkan nomor HP lengkap bukan format ****. UX minor, tidak ada implikasi keamanan |

---

### Detail Bug: VerifyOtpResponse Type Mismatch

**File:** `frontend/src/pages/auth/VerifikasiOtpPage.tsx`

**Backend response aktual** (dari `auth.controller.ts` baris 127-131):
```json
{ "success": true, "data": { "user": { "id": "...", "namaLengkap": "...", "role": "citizen" } }, "message": "..." }
```

**Frontend interface (salah):**
```typescript
interface VerifyOtpResponse {
  success: boolean
  data: AuthUser  // seharusnya: data: { user: AuthUser }
  message: string
}
```

**Kode yang bermasalah (baris 59):**
```typescript
setUser(response.data.data)
// TypeScript: setUser(AuthUser) — OK
// Runtime:   setUser({ user: { id, namaLengkap, role } }) — SALAH
```

**Perbaikan yang diperlukan** — ubah interface dan akses:
```typescript
interface VerifyOtpResponse {
  success: boolean
  data: { user: AuthUser }  // perbaikan
  message: string
}
// ...
setUser(response.data.data.user)  // perbaikan
```

**Bandingkan dengan LoginPage yang benar** (baris 54):
```typescript
const { user } = response.data.data  // LoginResponse.data = { user: AuthUser }
setUser(user)
```

---

### Human Verification Required

#### 1. Login tiga role di browser

**Test:** Login dengan tiga akun berbeda: (1) NIK + password citizen, (2) nomor HP + PIN kader, (3) email + password puskesmas.
**Expected:** Cookie access_token dan refresh_token di-set; redirect ke dashboard masing-masing.
**Why human:** Membutuhkan akun seed di DB dan browser session aktif.

#### 2. Cascade dropdown wilayah di browser

**Test:** Buka `/register/lokasi` (atau sementara disable ProtectedRoute). Klik dropdown Provinsi, pilih "DI Yogyakarta". Klik Kabupaten.
**Expected:** Kabupaten dropdown menampilkan 5 item termasuk "Kota Yogyakarta" dan "Kabupaten Sleman". Pilih kota → kecamatan muncul (misal Mergangsan untuk Kota Yogyakarta).
**Why human:** Ketergantungan pada data DB aktual yang tidak bisa diverifikasi via grep.

#### 3. Verifikasi jumlah record wilayah di DB

**Test:** `docker compose exec sispos-backend npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM wilayah"` atau query via Prisma Studio.
**Expected:** count >= 1500 (SUMMARY: 1508 records)
**Why human:** Tidak bisa query DB tanpa Docker container aktif.

#### 4. End-to-end registrasi citizen di browser

**Test:** Buka /register, isi NIK valid (16 digit), nama, HP, password identik. Submit. Navigasi ke /register/verifikasi. Masukkan 6-digit OTP dari WA.
**Expected:** Navigasi ke /register/lokasi, cascade dropdown tersedia, submit lokasi → /register/lokasi-selesai dengan countdown 5 detik → /citizen/dashboard.
**Why human:** Butuh server aktif + FONNTE_API_KEY, atau verifikasi manual BullMQ queue via `redis-cli LLEN bull:notification:wait`.

#### 5. Kader 10x PIN lockout di browser

**Test:** Coba login dengan HP kader + PIN salah sebanyak 10x berturut-turut.
**Expected:** Setelah percobaan ke-10: respons 403 + KaderLockScreen overlay dengan countdown MM:SS muncul. Verifikasi DB: `SELECT terkunci_sampai FROM kader WHERE nomor_ponsel = '...'` bernilai 30 menit ke depan.
**Why human:** Perlu akun kader seed + 10x interaksi + DB state check.

---

### Gaps Summary

Tidak ada BLOCKER gap yang ditemukan. Semua must-have artifacts ada, substantif (bukan stub), dan terhubung ke sumber data nyata. Ada dua WARNING dan satu UNCERTAIN yang memerlukan tindak lanjut:

**WARNING 1 — VerifyOtpResponse type mismatch** (bukan BLOCKER karena):
- Navigasi end-to-end tetap berjalan
- `isAuthenticated` di-set benar
- JWT cookie di-set benar oleh backend
- User dapat login ulang via LoginPage yang correct
- Fase 1 dashboard pages adalah stubs yang tidak menampilkan user data

**WARNING 2 — maskedPhone field name** (INFO level):
- OTP page menampilkan nomor tidak termasked sebagai fallback
- Tidak ada implikasi keamanan atau fungsional

**UNCERTAIN — Wilayah DB state**: seed script ada dan commit terkonfirmasi, tapi COUNT(*) aktual di DB tidak bisa diverifikasi secara statik.

---

_Verified: 2026-07-01T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
