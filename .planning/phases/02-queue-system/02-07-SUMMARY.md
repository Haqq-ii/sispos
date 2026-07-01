---
phase: 02-queue-system
plan: "07"
subsystem: ui
tags: [react, socket.io, zustand, tanstack-query, shadcn, antrian, realtime]

requires:
  - phase: 02-05
    provides: PilihTanggalPage, PilihSesiPage, useAntrianStore, useCountdownEstimasi, useSesiAvailability, socket.ts singleton
  - phase: 02-06
    provides: ManajemenJadwalPage, JadwalCard, JadwalTable, BuatJadwalDialog
  - phase: 02-04
    provides: computeCountdown pure function, useAmbilAntrian mutation, useBatalkanAntrian mutation

provides:
  - useAntrianSocket hook: Socket.IO connect/join sesi:{slotId}/leave + QueueUpdate state
  - CountdownEstimasi component: ±N menit widget dengan aria-live + disclaimer
  - StatusAntrian component: semantic badge per status (menunggu/dipanggil/selesai/dibatalkan)
  - BatalkanAntrianDialog component: destructive confirm dialog (D-06)
  - KonfirmasiAntrianPage (Screen 3): summary card + balita RadioGroup + 409 race condition handling
  - TiketAntrianPage (Screen 4): realtime countdown via socket, zero-padded nomorUrut, cancel flow
  - CitizenDashboardPage (Screen 7): replaces placeholder — active antrian card or Ambil CTA
  - PuskesmasDashboardPage: temp nav link to /puskesmas/jadwal (D-07)
  - router/index.tsx: all 4 citizen antrian routes + /puskesmas/jadwal dengan allowedRoles
  - GET /api/balita endpoint (child module): returns citizen's balita list

affects:
  - Phase 03: Meja 5 "Selesai" — akan update durasiRataAktual dan nomorAktif via broadcastQueueUpdate
  - Phase 04: Puskesmas dashboard — akan replace temp nav link dengan sidebar permanen
  - Phase 05: AI chatbot — daftar_antrian function call membutuhkan antrian flow yang sudah berfungsi

tech-stack:
  added:
    - Socket.IO client singleton (lib/socket.ts) — autoConnect false, connect on mount
    - Child module backend (GET /api/balita) — minimal Prisma query untuk balita citizen
  patterns:
    - useAntrianSocket pattern: connect on mount, emit queue:join, disconnect on unmount (not tab hide)
    - QueueUpdate interface exported untuk type-safe socket event handling
    - computeCountdown dipanggil di CountdownEstimasi props (stateless recompute saat socket update)
    - Error code → UI pattern: 409 SLOT_PENUH dengan "Ganti Sesi" recovery CTA
    - ProtectedRoute allowedRoles pada semua dashboard dan antrian routes

key-files:
  created:
    - frontend/src/hooks/useAntrianSocket.ts
    - frontend/src/components/antrian/CountdownEstimasi.tsx
    - frontend/src/components/antrian/StatusAntrian.tsx
    - frontend/src/components/antrian/BatalkanAntrianDialog.tsx
    - frontend/src/pages/citizen/antrian/KonfirmasiAntrianPage.tsx
    - frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx
    - frontend/src/pages/citizen/CitizenDashboardPage.tsx
    - backend/src/modules/child/child.controller.ts
    - backend/src/modules/child/child.routes.ts
  modified:
    - frontend/src/router/index.tsx (5 new routes + allowedRoles on all protected routes)
    - frontend/src/pages/PuskesmasDashboardPage.tsx (temp nav link to /puskesmas/jadwal)
    - frontend/src/pages/CitizenDashboardPage.tsx (converted to re-export)
    - backend/src/app.ts (added childRouter for /api/balita)

key-decisions:
  - "useAntrianSocket guard: if (!slotId || !antrianId) return — memungkinkan call sebelum antrian loaded"
  - "socketStatus state tracking (connecting/connected/disconnected) untuk disconnect alert di TiketAntrianPage"
  - "formatJam handles both HH:MM (getSesiList response) and ISO datetime (antrian include response)"
  - "CitizenDashboardPage path: frontend/src/pages/citizen/ (bukan root pages/) — old file menjadi re-export"
  - "GET /api/balita diperlukan Phase 2 (child module belum ada) — child.controller.ts minimal implementation"

requirements-completed:
  - QUEUE-02
  - QUEUE-03
  - QUEUE-04
  - QUEUE-06

duration: ~20min
completed: 2026-07-01
---

# Phase 02 Plan 07: Wave 5 — Final Citizen Screens + Router Summary

**Socket.IO realtime tiket antrian (±N menit countdown) + konfirmasi balita dengan 409 race guard + CitizenDashboard aktif + 9 routes Phase 02 terwiring**

## Performance

- **Duration:** ~20 menit
- **Started:** 2026-07-01T11:00:00Z
- **Completed:** 2026-07-01T11:13:00Z
- **Tasks:** 2/2 auto (Task 3 = checkpoint:human-verify — menunggu)
- **Files modified:** 13

## Accomplishments

- useAntrianSocket hook: connect on mount, join sesi:{slotId}, disconnect on unmount (tidak saat tab hide sesuai 02-UI-SPEC.md #5); QueueUpdate interface diekspor untuk consumers
- CountdownEstimasi: prefix "±" wajib, aria-live="polite", disclaimer wajib, amber warning <5 menit
- TiketAntrianPage: nomorUrut zero-padded 2 digit, realtime countdown via socket, BatalkanAntrianDialog hanya saat statusAntrian === 'menunggu', socket disconnect alert
- KonfirmasiAntrianPage: summary card estimasi worst-case (terisi+1)×durasi, balita RadioGroup, 409 SLOT_PENUH + "Ganti Sesi" recovery, 409 SUDAH_DAFTAR alert
- CitizenDashboardPage: menggantikan placeholder — tampilkan active antrian card (StatusAntrian + Lihat Tiket) atau CTA Ambil Antrian
- router/index.tsx: 8 protected routes dengan allowedRoles (citizen/kader/ketua_kader/puskesmas)
- GET /api/balita endpoint baru: ownership guard wargaId = req.user.userId (T-02-SC Mitigation)

## Task Commits

1. **Task 1: Socket hook + CountdownEstimasi + StatusAntrian + BatalkanAntrianDialog + KonfirmasiAntrianPage** - `91ceb8b` (feat)
2. **Task 2: TiketAntrianPage + CitizenDashboardPage + router wiring + PuskesmasDashboardPage nav link** - `361ea54` (feat)
3. **Task 3: human-verify checkpoint** — MENUNGGU (belum diverifikasi)

## Files Created/Modified

- `frontend/src/hooks/useAntrianSocket.ts` — Socket.IO room join/leave + QueueUpdate state
- `frontend/src/components/antrian/CountdownEstimasi.tsx` — ±N menit widget dengan aria-live
- `frontend/src/components/antrian/StatusAntrian.tsx` — semantic badge per status
- `frontend/src/components/antrian/BatalkanAntrianDialog.tsx` — destructive cancel dialog
- `frontend/src/pages/citizen/antrian/KonfirmasiAntrianPage.tsx` — Screen 3: konfirmasi + 409 handling
- `frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx` — Screen 4: tiket realtime
- `frontend/src/pages/citizen/CitizenDashboardPage.tsx` — Screen 7: dashboard citizen aktif
- `frontend/src/pages/CitizenDashboardPage.tsx` — converted to re-export
- `frontend/src/pages/PuskesmasDashboardPage.tsx` — tambah temp nav link to /puskesmas/jadwal
- `frontend/src/router/index.tsx` — 5 new lazy routes + allowedRoles pada semua protected routes
- `backend/src/modules/child/child.controller.ts` — GET /api/balita handler
- `backend/src/modules/child/child.routes.ts` — child router registration
- `backend/src/app.ts` — added app.use('/api/balita', childRouter)

## Decisions Made

- `useAntrianSocket` guard `if (!slotId || !antrianId) return` memungkinkan TiketAntrianPage memanggil hook sebelum antrian data loaded (slotId dari `antrian?.slotId ?? ''`)
- `socketStatus` state (connecting/connected/disconnected) untuk disconnect alert non-dismissible
- `formatJam` helper menangani dua format: "HH:MM" dari getSesiListHandler (sudah diformat) dan ISO string "1970-01-01T08:00:00.000Z" dari antrian include relation (Prisma @db.Time)
- CitizenDashboardPage dipindah ke `pages/citizen/CitizenDashboardPage.tsx`; file lama jadi re-export untuk backward compat
- `posyanduAlamat` dibangun dari `${kelurahan}, ${kecamatan}` (Posyandu model tidak memiliki field `alamat`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] GET /api/balita endpoint**
- **Found during:** Task 1 (KonfirmasiAntrianPage implementation)
- **Issue:** KonfirmasiAntrianPage membutuhkan daftar balita citizen untuk RadioGroup selection. Modul `child` di `backend/src/modules/child/` hanya berisi `.gitkeep` — endpoint GET /api/balita belum ada.
- **Fix:** Membuat `child.controller.ts` + `child.routes.ts` dengan GET /api/balita yang mengembalikan balita milik citizen yang login (ownership: `wargaId = req.user.userId`). Mendaftarkan ke `app.ts` sebagai `/api/balita`. Dilindungi `requireRole('citizen')`.
- **Files modified:** `backend/src/modules/child/child.controller.ts` (NEW), `backend/src/modules/child/child.routes.ts` (NEW), `backend/src/app.ts` (MODIFIED)
- **Verification:** Endpoint menggunakan `where: { wargaId: req.user!.userId }` — citizen hanya dapat balita miliknya
- **Committed in:** `91ceb8b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** Fix esensial — tanpa GET /api/balita, KonfirmasiAntrianPage hanya bisa menampilkan "Belum ada balita" dan flow antrian tidak bisa diselesaikan.

## Issues Encountered

- Prisma @db.Time field (jamMulai, jamSelesai) memiliki dua format berbeda dalam response JSON: getSesiListHandler memformat ke "HH:MM" sebelum return, tetapi getAntrianById menggunakan raw Prisma object yang menserializasikan @db.Time sebagai ISO string "1970-01-01T08:00:00.000Z". Diselesaikan dengan `formatJam` helper yang mendeteksi format via `includes('T')`.

## Checkpoint Status

Task 3 adalah `checkpoint:human-verify` — menunggu verifikasi manual 5 Phase 02 success criteria:
1. Jadwal creation: 3 SlotSesi ter-generate
2. Race condition guard: 2 tab simultaneous, hanya 1 berhasil
3. Nomor antrian zero-padded + "±" prefix pada countdown
4. Realtime countdown update tanpa refresh
5. WA BullMQ log enqueue terlihat

## Known Stubs

Tidak ada stub yang memblokir plan goal. Semua komponen sudah terhubung ke backend API yang sudah ada.

`Tambah Balita` button di KonfirmasiAntrianPage (muncul ketika citizen belum punya balita) sengaja disabled — ini placeholder untuk Phase 3+ yang akan implement child registration flow.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_endpoint | backend/src/modules/child/child.controller.ts | GET /api/balita — new network endpoint; dilindungi authMiddleware + requireRole('citizen'); ownership via wargaId |

## User Setup Required

None — tidak ada konfigurasi eksternal yang diperlukan untuk Plan 07.

## Next Phase Readiness

Phase 02 frontend selesai. Human-verify checkpoint masih menunggu.

Setelah checkpoint approved:
- Phase 03 dapat melanjutkan: Meja kader (Meja 1-5), update nomorAktif + durasiRataAktual via Socket.IO
- GET /api/balita tersedia untuk Phase 03+ child management
- Seluruh antrian flow dapat digunakan end-to-end

---
*Phase: 02-queue-system*
*Completed: 2026-07-01*

## Self-Check: PASSED

Files exist:
- FOUND: frontend/src/hooks/useAntrianSocket.ts
- FOUND: frontend/src/components/antrian/CountdownEstimasi.tsx
- FOUND: frontend/src/components/antrian/StatusAntrian.tsx
- FOUND: frontend/src/components/antrian/BatalkanAntrianDialog.tsx
- FOUND: frontend/src/pages/citizen/antrian/KonfirmasiAntrianPage.tsx
- FOUND: frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx
- FOUND: frontend/src/pages/citizen/CitizenDashboardPage.tsx
- FOUND: backend/src/modules/child/child.controller.ts
- FOUND: backend/src/modules/child/child.routes.ts

Commits exist:
- FOUND: 91ceb8b (Task 1)
- FOUND: 361ea54 (Task 2)
