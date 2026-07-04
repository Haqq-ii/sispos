---
phase: 06-pwa-offline
plan: "03"
subsystem: frontend-offline
tags: [pwa, offline-first, meja-intercept, indexeddb, tooltip, react-hooks]
dependency_graph:
  requires:
    - offline-db-schema      # from 06-01
    - useOfflineStatus       # from 06-01
    - useOfflineSync         # from 06-01
    - SyncPendingBadge       # from 06-01
    - meja2-offline-intercept  # from 06-02 (tempId chain source)
  provides:
    - meja3-offline-intercept
    - meja4-offline-intercept-catatan
    - meja4-stt-ai-disable-offline
    - meja5-offline-intercept
  affects:
    - frontend/src/pages/kader/meja/Meja3Page.tsx
    - frontend/src/pages/kader/meja/Meja4Page.tsx
    - frontend/src/pages/kader/meja/Meja5Page.tsx
tech_stack:
  added: []
  patterns:
    - Offline mutation intercept at call site (handleSubmit, handleSimpanCatatan, handleTambahImunisasi, handleSelesai)
    - TooltipProvider + Tooltip + TooltipTrigger from shadcn/ui for disabled-button affordance (D-11, D-12)
    - Offline store-reset mirror in handleSelesai (setLocked/setActiveMeja/setActivePemeriksaanId before navigate)
    - D-08 compliance: all submit buttons stay active offline; submit to IDB instead of API
    - D-09 compliance: SyncPendingBadge in Meja 3, 4, and 5 headers
key_files:
  created: []
  modified:
    - frontend/src/pages/kader/meja/Meja3Page.tsx
    - frontend/src/pages/kader/meja/Meja4Page.tsx
    - frontend/src/pages/kader/meja/Meja5Page.tsx
decisions:
  - "SyncPendingBadge placed inside a flex gap-2 div alongside Tukar Meja button — same consistent pattern as Meja 1/2"
  - "handleSelesai offline branch mirrors selesaiMutation.onSuccess store resets directly (setLocked/setActiveMeja/setActivePemeriksaanId) — actual PATCH /antrian/:id/selesai deferred to sync, which delivers durasiRataAktual update and Socket.IO broadcast"
  - "TooltipContent only rendered when !isOnline — avoids tooltip DOM node when online, zero visual footprint"
  - "Meja 4 catatan offline branch navigates to Meja 5 immediately after enqueue — mirrors handleSimpanCatatan online flow where save is optional before proceeding"
metrics:
  duration: "~5 min"
  completed: "2026-07-04T10:33:50Z"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
requirements_satisfied:
  - PWA-01
---

# Phase 06 Plan 03: Meja 3/4/5 Offline Intercept Summary

**One-liner:** Offline mutation intercepts for Meja 3 (tanda klinis patch queue), Meja 4 (STT/AI disabled with Tooltip + catatan queue with null AI fields), and Meja 5 (imunisasi + selesai queue with store-reset mirror), completing full 5-meja offline coverage.

## What Was Built

### `frontend/src/pages/kader/meja/Meja3Page.tsx` — Task 1

**Imports added:** `useOfflineStatus`, `useOfflineSync`, `SyncPendingBadge`, `generateTempId`

**Hooks added in `Meja3Content`:** `isOnline = useOfflineStatus()`, `enqueueOperation = useOfflineSync()`

**`handleSubmit` offline branch** (added before `patchMutation.mutate`):
- When `!isOnline`: calls `enqueueOperation('pemeriksaan', { id: generateTempId(), tempPemeriksaanId: pemeriksaanId, type: 'patch-tanda-klinis', data: { rambutKemerahan, perutBuncit, edema, pucat, lainnya, statusGiziOverride }, timestamp })`
- Toasts "Tersimpan lokal, akan sync saat online"
- Navigates to Meja 4 with full state (antrianId, balitaId, namaBalita, pemeriksaanId, tandaKlinis, statusGizi)
- Returns early, skipping online PATCH mutation

**SyncPendingBadge** placed inside `flex gap-2` div alongside Tukar Meja button in the `bg-[#008236]` header.

**"Lewati" button:** unchanged — navigates without saving, correct behavior both online and offline.

### `frontend/src/pages/kader/meja/Meja4Page.tsx` — Task 1

**Imports added:** `useOfflineStatus`, `useOfflineSync`, `SyncPendingBadge`, `generateTempId`, `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` from `@/components/ui/tooltip`

**Hooks added in `Meja4Content`:** `isOnline = useOfflineStatus()`, `enqueueOperation = useOfflineSync()`

**STT "Mulai Rekam" button (D-11)** wrapped in `<TooltipProvider><Tooltip>`:
- `disabled={!isOnline || transcribeMutation.isPending}` — both offline and pending-transcription disable it
- `className` adds `opacity-50 cursor-not-allowed` when `!isOnline`
- `<TooltipContent side="top">` with `<p>Tidak tersedia offline</p>` only rendered when `!isOnline`

**AI "Generate AI Early Warning" button (D-12)** wrapped in `<TooltipProvider><Tooltip>`:
- `disabled={!isOnline || earlyWarningMutation.isPending}`
- Same `opacity-50 cursor-not-allowed` pattern
- Same tooltip text "Tidak tersedia offline"

**Catatan textarea (D-13):** unchanged — remains fully active offline.

**`handleSimpanCatatan` offline branch (D-14)** (added after empty-check, before `saveCatatanMutation.mutate`):
- When `!isOnline`: calls `enqueueOperation('pemeriksaan', { id: generateTempId(), tempPemeriksaanId: pemeriksaanId, type: 'patch-catatan', data: { catatanKonsultasi: catatanValue, rekomendasiAi: null, catatanSTT: null }, timestamp })`
- Toasts "Tersimpan lokal, akan sync saat online"
- Navigates to Meja 5 immediately

**SyncPendingBadge** in `bg-[#008236]` header, same pattern as Meja 3.

### `frontend/src/pages/kader/meja/Meja5Page.tsx` — Task 2

**Imports added:** `useOfflineStatus`, `useOfflineSync`, `SyncPendingBadge`, `generateTempId`

**Hooks added:** `isOnline = useOfflineStatus()`, `enqueueOperation = useOfflineSync()`

**`handleTambahImunisasi()` function:**
- Offline path: `enqueueOperation('meja5', { id: generateTempId(), type: 'immunization', data: { balitaId, namaVaksin, dosisKe: parseInt(dosisKe, 10), tanggalInjeksi: new Date().toISOString() }, timestamp })`
- Toasts, resets form (`setShowForm(false)`, `setNamaVaksin('')`, `setDosisKe('1')`), returns early
- Online path: delegates to `tambahMutation.mutate()` unchanged

**`handleSelesai()` function:**
- Offline path: `enqueueOperation('meja5', { id: generateTempId(), type: 'selesai', data: { antrianId, slotId: activeSlotId }, timestamp })`
- Toasts, then mirrors online success flow: `setLocked(false)`, `setActiveMeja(null, null)`, `setActivePemeriksaanId(null)`, `navigate('/kader/rekap', ...)`
- Online path: delegates to `selesaiMutation.mutate()` unchanged

**D-08 compliance:** Neither Tambahkan nor Selesai Meja 5 button has `!isOnline` in disabled condition.

**SyncPendingBadge** placed inside `flex gap-2` div alongside Tukar Meja button in the `bg-[#e17100]` orange header.

## Deviations from Plan

None — plan executed exactly as written. All D-xx decisions honored. TypeScript strict mode clean throughout.

## Known Stubs

None — all offline branches are fully implemented. No hardcoded empty values or placeholder text.

## Threat Flags

No new security surface beyond the plan's threat model. All four threat IDs from the plan are addressed:
- T-06-03-01 (catatanKonsultasi plaintext in pemeriksaan_queue): accepted per D-13; UU PDP note carried from offline-db.ts JSDoc; backend encrypts on sync
- T-06-03-02 (Meja 4 AI/STT disable removal): STT and AI server endpoints still validate JWT + IDOR; no server-side data change from client-side disable
- T-06-03-03 (selesai offline skips durasiRataAktual): moving average update deferred to sync; sync PATCH delivers the update when online
- T-06-03-04 (tempId chain): handled by useOfflineSync.syncAll() — tempId→realId resolution via POST-first pattern from 06-01; failed resolutions logged to sync_errors

## Self-Check: PASSED

| Item | Result |
|------|--------|
| frontend/src/pages/kader/meja/Meja3Page.tsx | FOUND |
| frontend/src/pages/kader/meja/Meja4Page.tsx | FOUND |
| frontend/src/pages/kader/meja/Meja5Page.tsx | FOUND |
| commit 426cdb9 (Task 1 — Meja3+Meja4) | FOUND |
| commit 78a44cf (Task 2 — Meja5) | FOUND |
| npx tsc --noEmit | PASSED (0 errors) |
| grep patch-tanda-klinis Meja3Page.tsx | 1 — PASS |
| grep "Tidak tersedia offline" Meja4Page.tsx | 2 — PASS |
| grep patch-catatan Meja4Page.tsx | 1 — PASS |
| grep "rekomendasiAi: null" Meja4Page.tsx | 1 — PASS |
| grep "type: 'selesai'" Meja5Page.tsx | 1 — PASS |
| grep SyncPendingBadge Meja3Page.tsx | 2 — PASS |
| grep SyncPendingBadge Meja4Page.tsx | 2 — PASS |
| grep SyncPendingBadge Meja5Page.tsx | 2 — PASS |
