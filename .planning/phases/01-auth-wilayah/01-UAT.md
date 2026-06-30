---
status: approved
phase: 01-auth-wilayah
source: [01-VERIFICATION.md]
started: 2026-06-30T18:23:39.890Z
updated: 2026-06-30T18:23:39.890Z
---

## Human Verification Items — Phase 01

### 1. Login tiga role di browser
**Test:** Buka http://localhost/login
- Login dengan NIK 16 digit + password → redirect ke /citizen/dashboard ✓?
- Login dengan No HP + PIN → redirect ke /kader/dashboard ✓?
- Login dengan email → redirect ke /puskesmas/dashboard ✓?

### 2. Cascade dropdown wilayah
**Test:** Buka http://localhost/register/lokasi (atau OnboardingLokasiPage)
- Pilih DI Yogyakarta → Kabupaten dropdown muncul 5 pilihan ✓?
- Pilih Kota Yogyakarta → Kecamatan muncul (termasuk Mergangsan) ✓?
- Pilih Mergangsan → Kelurahan muncul ✓?

### 3. COUNT wilayah di DB
```bash
docker compose exec sispos-backend npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM wilayah"
```
Expected: count >= 1500 ✓?

### 4. End-to-end registrasi citizen
**Test:** http://localhost/register
- Isi form → submit → navigasi ke /register/verifikasi ✓?
- Masukkan OTP → navigasi ke /register/lokasi ✓?
- Pilih wilayah + simpan → /register/lokasi-selesai dengan countdown 5s ✓?

### 5. Kader 10x PIN lockout
**Test:** Login dengan No HP kader + PIN salah 10x
- Respons 403 dengan AKUN_TERKUNCI ✓?
- KaderLockScreen overlay MM:SS countdown muncul di browser ✓?
- DB: terkunciSampai terisi ✓?

## Resume Signal
Type "approved" jika semua item pass, atau deskripsikan langkah mana yang gagal.
