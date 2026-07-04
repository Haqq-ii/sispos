---
phase: 06-pwa-offline
plan: "02"
subsystem: frontend-offline
tags: [pwa, offline-first, meja-intercept, indexeddb, react-hooks]
dependency_graph:
  requires:
    - offline-db-schema      # from 06-01
    - useOfflineStatus       # from 06-01
    - useOfflineSync         # from 06-01
    - SyncPendingBadge       # from 06-01
  provides:
    - meja1-offline-intercept
    - meja2-offline-intercept
    - tempId-chain
  affects:
    - frontend/src/pages/kader/meja/Meja3Page.tsx (consumes tempId via location.state — 06-03)
    - frontend/src/pages/kader/meja/Meja4Page.tsx (consumes tempId via store — 06-03)
tech_stack:
  added: []
  patterns:
    - Offline mutation intercept at call site (handleHadir, handleTangguhkan, doSubmit)
    - tempId chain for pemeriksaanId across Meja 2 → Meja 3 → Meja 4
    - D-08 compliance: buttons stay active offline; submit to IDB instead of API
    - D-09 compliance: SyncPendingBadge in both Meja 1 and Meja 2 headers
key_files:
  created: []
  modified:
    - frontend/src/pages/kader/meja/Meja1Page.tsx
    - frontend/src/pages/kader/meja/Meja2Page.tsx
decisions:
  - "handleHadir and handleTangguhkan are named functions (not inline lambdas) to keep the !isOnline branch testable and readable"
  - "Tangguhkan button added to isBelum antrian card — tangguhkanMutation was already defined but had no call site; wiring it is required for enqueueOperation >= 2 verification and is the correct UX"
  - "Two generateTempId() calls in doSubmit offline branch: one for queue entry id, one for tempPemeriksaanId — intentionally different UUIDs per plan spec"
  - "setShowKonfirmasi(false) called in offline branch to dismiss Dialog if biologic confirmation was open when user tapped Simpan"
metrics:
  duration: "~5 min"
  completed: "2026-07-04T10:25:06Z"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
requirements_satisfied:
  - PWA-01
---

# Phase 06 Plan 02: Meja 1 & Meja 2 Offline Intercept Summary

**One-liner:** Offline mutation intercepts at Meja 1 (hadir/tangguhkan) and Meja 2 (doSubmit BB/TB) with IDB queue fallback, tempId chain for pemeriksaanId, and SyncPendingBadge added to both headers.

## What Was Built

### `frontend/src/pages/kader/meja/Meja1Page.tsx` — Task 1

**New functions inside `Meja1Content`:**

- `handleHadir(payload)` — wraps `hadirMutation.mutate`. Offline path: calls `enqueueOperation('kehadiran', {...action:'hadir'})`, toasts "Tersimpan lokal, akan sync saat online", calls `setActiveAntrian`, then navigates to `/kader/meja/2` immediately. Online path: delegates to `hadirMutation.mutate(payload)` unchanged.
- `handleTangguhkan(antrianId)` — wraps `tangguhkanMutation.mutate`. Offline path: calls `enqueueOperation('kehadiran', {...action:'tangguhkan'})`, toasts. Online path: delegates to `tangguhkanMutation.mutate(antrianId)`.

**Hadir button** now calls `handleHadir({...})` instead of `hadirMutation.mutate({...})` directly.

**Tangguhkan button** added to the `isBelum` antrian card alongside the Hadir button. `tangguhkanMutation` was already defined but had no call site — this plan wires it correctly.

**SyncPendingBadge** rendered inside the `div.bg-[#008236]` green header, after the progress bar section.

**D-08 compliance:** Neither Hadir nor Tangguhkan button has `disabled` condition that includes `!isOnline`.

### `frontend/src/pages/kader/meja/Meja2Page.tsx` — Task 2

**`doSubmit(konfirmasiBiologis)` modified** — offline branch added as the second guard (after `!balitaId` check):

```
if (!isOnline) {
  const tempPemeriksaanId = generateTempId()   // for Meja 3/4 chain
  void enqueueOperation('pemeriksaan', {
    id: generateTempId(),                        // separate UUID for queue entry
    tempPemeriksaanId,
    type: 'create',
    data: { balitaId, antrianId, beratBadan, tinggiBadan, konfirmasiBiologis },
    timestamp: Date.now(),
  })
  setActivePemeriksaanId(tempPemeriksaanId)     // Pitfall 2: store carries tempId
  toast({ description: 'Tersimpan lokal, akan sync saat online' })
  setShowKonfirmasi(false)                       // dismiss Dialog if open
  navigate('/kader/meja/3', {
    state: { antrianId, balitaId, namaBalita, pemeriksaanId: tempPemeriksaanId },
  })
  return
}
// existing online flow (createPemeriksaan.mutate) unchanged
```

**Pitfall 2 resolved:** `setActivePemeriksaanId(tempPemeriksaanId)` stores the temp ID in Zustand so Meja 3 and Meja 4 have a non-null `activePemeriksaanId` even before sync resolves it to a real server ID.

**Pitfall 3 resolved:** Offline path bypasses the Z-Score result screen entirely and navigates directly to Meja 3.

**SyncPendingBadge** rendered inside the `div.bg-[#00a63e]` header, after the flex row containing the back button and title.

**D-08 compliance:** "Simpan Data" button `disabled={!isBbFilled || isSaving}` — no `!isOnline` added.

## Deviations from Plan

### Auto-added Missing Feature

**[Rule 2 - Missing Functionality] Tangguhkan button wired in Meja1Page antrian card**
- **Found during:** Task 1 — reading Meja1Page.tsx revealed `tangguhkanMutation` was defined but had no call site in the render
- **Issue:** The offline intercept plan requires `enqueueOperation` called 2+ times (hadir + tangguhkan). Without a Tangguhkan button, handleTangguhkan would be dead code with no way to trigger its offline path.
- **Fix:** Added "Tangguhkan" button to the `isBelum` antrian card (orange styling, `bg-[#fff7ed]` consistent with Posyandu UI palette) alongside the existing Hadir button. Both buttons use named handler wrappers.
- **Files modified:** `frontend/src/pages/kader/meja/Meja1Page.tsx`
- **Commit:** 6785add

## Known Stubs

None — all offline branches are fully implemented. No hardcoded empty values or placeholder text.

## Threat Flags

No new security surface beyond the plan's threat model. The three planned threats (T-06-02-01 through T-06-02-03) are addressed:
- T-06-02-01 (kehadiran_queue tampering): antrianId sourced from TanStack Query server-fetched list; backend IDOR guard validates kader ownership
- T-06-02-02 (tempId chain): tempId is client-local UUID; backend never receives it directly — sync resolves via POST first; mismatched PATCH → 404 → logSyncError
- T-06-02-03 (Z-Score skip offline): Z-Score is informational display only; backend computes independently during sync

## Self-Check: PASSED

| Item | Result |
|------|--------|
| frontend/src/pages/kader/meja/Meja1Page.tsx | FOUND |
| frontend/src/pages/kader/meja/Meja2Page.tsx | FOUND |
| commit 6785add (Task 1 — Meja1Page) | FOUND |
| commit c759b71 (Task 2 — Meja2Page) | FOUND |
| npx tsc --noEmit | PASSED (0 errors) |
| grep enqueueOperation Meja1Page.tsx (>=2) | 3 — PASS |
| grep tempPemeriksaanId Meja2Page.tsx (>=2) | 4 — PASS |
| grep SyncPendingBadge Meja1Page.tsx (>=1) | 2 — PASS |
| grep SyncPendingBadge Meja2Page.tsx (>=1) | 2 — PASS |
| Simpan Data disabled without !isOnline | PASS |
