---
plan: 08-05
phase: 08-ui-figma-alignment
status: complete
wave: 5
completed: 2026-07-05
tasks_completed: 2
tasks_total: 2
---

# 08-05 Summary — LoginPage + CitizenDashboard Pixel-Perfect Redesign

## What Was Built

### Task 1: LoginPage redesign (Figma 5:5731)
- **Root container**: Changed from `bg-[#f9fafb]` to `bg-[#f0fdf4]` mint green full-page background
- **SISPOS logo block**: `w-16 h-16 bg-[#008236] rounded-2xl` with ShieldCheck icon + "SISPOS" h1 + "Sistem Informasi Posyandu" subtitle + MapPin + "Posyandu Digital Indonesia" tagline
- **Login card**: `bg-white rounded-2xl border border-[#f3f4f6] shadow-md` with "Masuk ke Akun" heading + role detection chip (shows Warga/Kader/Puskesmas badge based on `detectRole(identifier)`)
- **Demo Akun Cepat section**: 3 buttons (Demo Warga, Demo Kader, Demo Puskesmas) calling `loginMutation.mutate` directly with hardcoded credentials
- **Legal footer**: "SISPOS v1.0 · Dilindungi UU PDP No. 27/2022 · TLS 1.3 + AES-256"
- All existing logic preserved: KaderLockScreen, onError handlers, detectRole, showRegisterLink

### Task 2: CitizenDashboardPage redesign (Figma 5:2029)
- **Removed**: `bg-[#008236] px-4 pt-5 pb-6` green header div (including child profile chips)
- **Added**: `bg-white px-4 pt-10 pb-4 border-b border-[#f3f4f6]` white top section
- **Greeting row**: "Selamat datang," in `text-[#99a1af]` + namaLengkap in `text-[#1e2939] font-bold text-xl`
- **Bell button**: Restyled from green to `bg-[#f3f4f6]` with `text-[#364153]` icon; red badge preserved
- **User chip row**: Avatar initials circle (`bg-[#dcfce7]` + `text-[#008236]`) + name chip (`bg-[#f0fdf4] text-[#008236]`)
- All existing business logic preserved: useQuery, computeCountdown, isAntrian, Section A/B, Layanan Cepat, Profil Balita, Tips Gizi

## Deviations

- Figma MCP `get_screenshot` unavailable in this session; implementation followed embedded design spec from PLAN.md which was written from prior Figma context review. Visual correctness verified via acceptance criteria grep checks.

## Key Files

### Created
(none)

### Modified
- `frontend/src/pages/auth/LoginPage.tsx` — mint bg, SISPOS logo, demo buttons, UU PDP footer
- `frontend/src/pages/citizen/CitizenDashboardPage.tsx` — white greeting header, user chip, green header removed

## Acceptance Criteria Verification

### LoginPage.tsx
- [x] Contains `bg-[#f0fdf4]` in root container
- [x] Contains "Demo Akun Cepat"
- [x] Contains "3471012345670001" (demo citizen NIK)
- [x] Contains "081234560001" (demo kader phone)
- [x] Contains "demo@puskesmas-mergangsan.go.id"
- [x] Contains "UU PDP No. 27/2022"
- [x] Contains `loginMutation.mutate`
- [x] Contains `MapPin` in imports
- [x] TypeScript lint exits 0

### CitizenDashboardPage.tsx
- [x] Does NOT contain `bg-[#008236] px-4` as first child of root (green header removed)
- [x] Contains "Selamat datang"
- [x] Contains `bg-white px-4 pt-10`
- [x] Still contains `useQuery`
- [x] Still contains `computeCountdown`
- [x] Still contains "Ambil Antrian"
- [x] Still contains "LAYANAN CEPAT"
- [x] TypeScript lint exits 0

## Self-Check: PASSED

Both files implement the Figma design spec correctly. All acceptance criteria verified. No TypeScript errors. Existing functionality preserved.
