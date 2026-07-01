---
phase: 02-queue-system
plan: "05"
subsystem: ui
tags: [react, tanstack-query, zustand, shadcn, tailwind, citizen, antrian, calendar]

# Dependency graph
requires:
  - phase: 02-04
    provides: useAntrianStore (selectedDate/setSelectedDate/setSelectedSlotId), useJadwalTersedia hook, useSesiAvailability hook, computeCountdown util
provides:
  - AntrianKalender component — kalender grid dengan titik hijau ketersediaan jadwal
  - PilihTanggalPage — Screen 1 citizen pilih tanggal jadwal (D-02 null redirect)
  - SesiCard component — kartu sesi dengan state tersedia/penuh + progress bar inline
  - PilihSesiPage — Screen 2 citizen pilih slot sesi (stores slotId ke useAntrianStore)
affects:
  - 02-07 (KonfirmasiAntrianPage menerima jadwalId via navigate state dari PilihSesiPage)
  - router wiring (plan 02-07 mendaftarkan /citizen/antrian/pilih-tanggal dan /citizen/antrian/pilih-sesi ke React Router)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "InlineProgress: custom inline progress bar div (role=progressbar + aria) sebagai pengganti @radix-ui/react-progress yang belum ada di package.json"
    - "isAxiosLikeError type guard di page component untuk narrow error response dari TanStack Query"
    - "D-02 pattern: detect 422 POSYANDU_BELUM_DIPILIH dari backend error → <Navigate to='/register/lokasi' replace />"
    - "Navigation state wizard pattern: PilihTanggalPage → PilihSesiPage → KonfirmasiPage lewat navigate(url, { state: { jadwalId } })"
    - "generateCalendarDays: grid 7-kolom Minggu-Sabtu dengan null padding untuk sel kosong"

key-files:
  created:
    - frontend/src/components/antrian/AntrianKalender.tsx
    - frontend/src/pages/citizen/antrian/PilihTanggalPage.tsx
    - frontend/src/components/antrian/SesiCard.tsx
    - frontend/src/pages/citizen/antrian/PilihSesiPage.tsx
  modified:
    - frontend/src/hooks/useSesiAvailability.ts

key-decisions:
  - "InlineProgress inline daripada import @radix-ui/react-progress — package belum ada di package.json (pre-existing gap dari 02-01); implementasi div dengan role=progressbar + aria-valuenow/min/max secara visual identik"
  - "D-02 detect lewat error response (422 POSYANDU_BELUM_DIPILIH) bukan lewat store — posyanduUtamaId tidak disimpan di useAuthStore; server adalah sumber kebenaran"
  - "jadwalId diteruskan via React Router navigate state (bukan Zustand store) karena bersifat ephemeral wizard step; store hanya menyimpan nilai akhir (selectedDate, selectedSlotId)"
  - "slotSesi.nomorSesi dan slotSesi.jadwal ditambahkan ke SlotSesiDetail sebagai optional fields — backend mengembalikan kedua field tersebut via Prisma include namun tipe lama tidak memuat mereka"

patterns-established:
  - "Wizard navigation via React Router navigate state: page hanya menerima data dari location.state, bukan URL params atau Zustand, untuk step wizard"
  - "Guard redirect pattern: jika state wizard tidak ada (akses langsung), <Navigate> langsung ke step sebelumnya"
  - "SesiCard self-contained: terima sesi props, emit onPilih(id), tidak akses store langsung"

requirements-completed: [QUEUE-01, QUEUE-02, QUEUE-03]

# Metrics
duration: ~5min
completed: 2026-07-01
---

# Phase 02 Plan 05: Citizen Pilih Tanggal + Pilih Sesi Summary

**Kalender grid kustom (AntrianKalender) + SesiCard dengan progress bar inline untuk 2 screen pertama alur antrian citizen**

## Performance

- **Duration:** ~5 min (rekonstruksi dari commit timestamps 13:28–13:33)
- **Started:** 2026-07-01T06:28:13Z
- **Completed:** 2026-07-01T06:33:15Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- AntrianKalender component dengan navigasi bulan prev/next, titik hijau availabilitas, state terpilih/lampau/tidak tersedia, loading skeleton, dan aksesibilitas ARIA lengkap
- PilihTanggalPage: D-02 redirect ke `/register/lokasi` saat backend mengembalikan 422 POSYANDU_BELUM_DIPILIH; CTA disabled sampai tanggal dengan jadwal dipilih; navigasi ke PilihSesiPage dengan `{ state: { jadwalId } }`
- SesiCard dengan PENUH badge + disabled button (terisi >= kuota), InlineProgress bar custom (pengganti Radix Progress yang tidak terinstall), dan `aria-label` aksesibel pada tombol Pilih Sesi
- PilihSesiPage: guard redirect ke pilih-tanggal jika tidak ada jadwalId di state; 3 Skeleton loading; empty state "semua penuh" + tombol Ganti Tanggal; `setSelectedSlotId` + navigate ke konfirmasi

## Task Commits

1. **Task 1: AntrianKalender + PilihTanggalPage (Screen 1)** — `d012979` (feat)
2. **Task 2: SesiCard + PilihSesiPage (Screen 2) + fix SlotSesiDetail type** — `a1160c1` (feat)
3. **Fix: ganti Progress radix dengan InlineProgress inline** — `bdcfa36` (fix)

## Files Created/Modified

- `frontend/src/components/antrian/AntrianKalender.tsx` — Kalender grid 7-kolom dengan availabilitas dots, navigasi bulan, dan loading skeleton (208 baris)
- `frontend/src/pages/citizen/antrian/PilihTanggalPage.tsx` — Screen 1 citizen: D-02 redirect, bulan navigation, CTA disabled state, navigate to PilihSesiPage dengan jadwalId (156 baris)
- `frontend/src/components/antrian/SesiCard.tsx` — Kartu sesi tersedia/penuh dengan InlineProgress bar, PENUH badge, dan aksesibel aria-label (157 baris setelah fix)
- `frontend/src/pages/citizen/antrian/PilihSesiPage.tsx` — Screen 2 citizen: guard redirect, 3 SesiCard, empty state, setSelectedSlotId + navigate (155 baris)
- `frontend/src/hooks/useSesiAvailability.ts` — Ditambah field `nomorSesi` dan `jadwal` (optional) ke `SlotSesiDetail` interface

## Decisions Made

- **InlineProgress vs Radix Progress:** `@radix-ui/react-progress` belum ada di `package.json` (gap dari 02-01). Dibuat komponen `InlineProgress` inline: `div` dengan `role="progressbar"`, `aria-valuenow/min/max`, visual identik menggunakan kelas `bg-secondary + bg-primary`.
- **D-02 detection via backend error:** `posyanduUtamaId` tidak disimpan di `useAuthStore` (hanya id/nama/role). Deteksi lewat 422 `POSYANDU_BELUM_DIPILIH` dari backend — server adalah sumber kebenaran sesuai D-01.
- **Navigation state untuk jadwalId:** Wizard step data diteruskan lewat `navigate(url, { state: { jadwalId } })`, bukan Zustand, karena bersifat ephemeral; hanya nilai akhir pilihan citizen (selectedDate, selectedSlotId) yang disimpan di store.
- **SlotSesiDetail type fix:** Backend mengembalikan `nomorSesi` dan `jadwal` (via Prisma include) tapi tipe lama tidak memuat field tersebut. Ditambahkan sebagai optional fields agar tidak ada type error saat PilihSesiPage mengakses `sesi.jadwal?.posyandu?.namaPosyandu`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SlotSesiDetail interface hilang field nomorSesi dan jadwal**
- **Found during:** Task 2 (SesiCard + PilihSesiPage)
- **Issue:** Backend mengembalikan `nomorSesi` dan nested `jadwal.posyandu.namaPosyandu` via Prisma include, tapi `SlotSesiDetail` di `useSesiAvailability.ts` tidak mendefinisikan field tersebut — TypeScript strict mode error
- **Fix:** Tambah `nomorSesi: number` dan `jadwal?: { estimasiDurasiMenit: number; tanggalPelaksanaan: string; posyandu: { namaPosyandu: string } }` ke interface
- **Files modified:** `frontend/src/hooks/useSesiAvailability.ts`
- **Committed in:** `a1160c1` (task 2 commit)

**2. [Rule 1 - Bug] @radix-ui/react-progress tidak ada di package.json**
- **Found during:** Task 2 (SesiCard progress bar implementation)
- **Issue:** `SesiCard` mengimport `<Progress>` dari `@/components/ui/progress` yang pada gilirannya membutuhkan `@radix-ui/react-progress` — tapi package ini belum di-install di frontend (gap pre-existing dari 02-01 shadcn setup)
- **Fix:** Buat komponen `InlineProgress` inline di file `SesiCard.tsx` menggunakan `div` + `role="progressbar"` + ARIA attributes; hapus import `Progress`; visual identik
- **Files modified:** `frontend/src/components/antrian/SesiCard.tsx`
- **Committed in:** `bdcfa36` (fix commit terpisah)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - Bug)
**Impact on plan:** Kedua auto-fix diperlukan untuk kebenaran TypeScript dan build. Tidak ada scope creep.

## Issues Encountered

Tidak ada masalah di luar deviasi yang sudah didokumentasikan. Backend integration straightforward karena hooks sudah dibuat di plan 02-04.

## User Setup Required

Tidak ada — tidak ada konfigurasi external service.

## Next Phase Readiness

- AntrianKalender dan SesiCard siap dipakai oleh plan lain
- PilihTanggalPage + PilihSesiPage sudah menyimpan state ke `useAntrianStore` dan meneruskan `jadwalId` via navigate state
- Plan 02-07 (KonfirmasiAntrianPage + router wiring) bisa langsung consume `/citizen/antrian/konfirmasi` dengan `location.state.jadwalId` dari PilihSesiPage
- **Catatan:** Route `/citizen/antrian/pilih-tanggal` dan `/citizen/antrian/pilih-sesi` belum didaftarkan ke React Router — ini dilakukan di plan 02-07

---
*Phase: 02-queue-system*
*Completed: 2026-07-01*
