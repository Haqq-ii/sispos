---
phase: 06-pwa-offline
plan: "01"
subsystem: frontend-offline
tags: [pwa, indexeddb, offline-first, sync-engine, react-hooks]
dependency_graph:
  requires: []
  provides:
    - offline-db-schema
    - useOfflineStatus
    - useOfflineSync
    - OfflineBanner
    - SyncPendingBadge
  affects:
    - frontend/src/pages/kader/meja/Meja1Page.tsx (consumed in 06-02)
    - frontend/src/pages/kader/meja/Meja2Page.tsx (consumed in 06-02)
    - frontend/src/pages/kader/meja/Meja3Page.tsx (consumed in 06-03)
    - frontend/src/pages/kader/meja/Meja4Page.tsx (consumed in 06-03)
    - frontend/src/pages/kader/meja/Meja5Page.tsx (consumed in 06-03)
    - frontend/src/App.tsx (OfflineBanner added in 06-04)
tech_stack:
  added:
    - idb@8.0.3 (jakearchibald/idb — IndexedDB typed wrapper)
  patterns:
    - IDB singleton pattern (cached Promise, upgrade guards)
    - Stable ref pattern for event listeners (avoids stale closure)
    - Per-item try/catch in sync loop (D-04 skip-on-422)
    - tempId→realId resolution for pemeriksaan chain
key_files:
  created:
    - frontend/src/lib/offline-db.ts
    - frontend/src/hooks/useOfflineStatus.ts
    - frontend/src/hooks/useOfflineSync.ts
    - frontend/src/components/offline/OfflineBanner.tsx
    - frontend/src/components/offline/SyncPendingBadge.tsx
  modified:
    - frontend/package.json (idb@8.0.3 added to dependencies)
    - frontend/package-lock.json
decisions:
  - "idb@8 approved via human-verify gate (Task 1) — cross-verified npm registry + jakearchibald/idb + web.dev attribution"
  - "generateTempId falls back from crypto.randomUUID() to timestamp+Math.random() for HTTP-only Docker context (A3)"
  - "syncAll per-item try/catch: non-4xx errors (network/5xx) leave item in queue for next sync attempt; only 422/409 written to sync_errors (D-04)"
  - "stable ref pattern for 'online' event: syncAllRef.current = syncAll in useEffect avoids stale closure without adding syncAll to dependency array of the registration useEffect"
metrics:
  duration: "~20 min (active execution; session limit reset added gap)"
  completed: "2026-07-04T10:13:12Z"
  tasks_completed: 3
  files_created: 5
  files_modified: 2
requirements_satisfied:
  - PWA-01
---

# Phase 06 Plan 01: IDB Foundation + Sync Engine + Offline UI Primitives Summary

**One-liner:** IndexedDB schema with 4 stores, `idb@8` singleton pattern, reactive `useOfflineStatus` hook, FIFO `useOfflineSync` engine with tempId→realId resolution, and orange OfflineBanner + SyncPendingBadge UI primitives.

## What Was Built

Five new files forming the complete offline infrastructure layer for the SISPOS kader 5-meja offline flow:

### `frontend/src/lib/offline-db.ts`
- `getOfflineDB()` singleton using cached `Promise<IDBPDatabase<SisposOfflineDB>>` — upgrade runs once per DB_VERSION bump, guards prevent duplicate store creation
- 4 stores: `kehadiran_queue` (Meja 1), `pemeriksaan_queue` (Meja 2/3/4), `meja5_queue` (Meja 5), `sync_errors`
- All stores indexed by `by_timestamp` for FIFO reads; `pemeriksaan_queue` adds `by_type` index
- `generateTempId()` — tries `crypto.randomUUID()` first; falls back to `'temp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9)` for HTTP-only Docker context
- `logSyncError()` — writes failed sync ops to `sync_errors` for kader rekap harian review
- `countPending()` — sums all 3 queue stores (NOT sync_errors) via `Promise.all`

### `frontend/src/hooks/useOfflineStatus.ts`
- Initializes from `navigator.onLine` (synchronous read at mount)
- `useEffect` registers `window 'online'/'offline'` listeners with cleanup
- Returns `boolean` — consumers re-render immediately on network change

### `frontend/src/hooks/useOfflineSync.ts`
- `pendingCount` state initialized from `countPending()` on mount
- `enqueueOperation(queueType, payload)` — writes to `${queueType}_queue` store, then refreshes count
- `syncAll()` — processes 3 queues in FIFO order (kehadiran → pemeriksaan → meja5):
  - kehadiran: PATCH `/antrian/:id/hadir|tangguhkan`
  - pemeriksaan: POST create → resolve tempId→realId → call `setActivePemeriksaanId(realId)`; PATCH patch-tanda-klinis/patch-catatan with resolved ID
  - meja5: POST `/immunization` or PATCH `/antrian/:id/selesai`
  - Per-item catch: 422/409 → `logSyncError` + skipCount++; non-4xx leaves item in queue
  - Toast: "Data berhasil disinkronkan" or "Gagal sinkronkan N data — lihat rekap harian"
  - Invalidates `['antrian', 'kader']` TanStack Query key
- `window 'online'` wired via stable ref (`syncAllRef`) — prevents stale closure bug

### `frontend/src/components/offline/OfflineBanner.tsx`
- Returns `null` when online — zero DOM footprint
- Fixed position `z-50 bg-orange-600` bar with `WifiOff` icon
- Exact copy: "Mode Offline — data tersimpan lokal" (no period, per UI-SPEC)

### `frontend/src/components/offline/SyncPendingBadge.tsx`
- Returns `null` when `pendingCount === 0`
- Orange pill badge: `bg-orange-500 rounded-full` showing "{N} pending"

## Deviations from Plan

None — plan executed exactly as specified. All architectural decisions (D-01 through D-14) respected. TypeScript strict mode clean throughout.

## Known Stubs

None — all exported functions are fully implemented. No hardcoded empty values or placeholder text in any new file.

## Threat Flags

No new security surface beyond the plan's threat model. All 5 threat IDs (T-06-01 through T-06-SC) from the plan are mitigated as specified:
- T-06-01 (IDB tampering): backend Zod + IDOR guards on sync
- T-06-02 (plaintext storage): JSDoc UU PDP note added in offline-db.ts
- T-06-03 (session expiry mid-sync): axios JWT interceptor handles 401 → refresh
- T-06-04 (retry flooding): skip-on-422 + logSyncError implemented in syncAll
- T-06-05 (crypto.randomUUID HTTP): generateTempId fallback implemented
- T-06-SC (idb package): human-verify gate Task 1 completed before install

## Self-Check: PASSED

| Item | Result |
|------|--------|
| frontend/src/lib/offline-db.ts | FOUND |
| frontend/src/hooks/useOfflineStatus.ts | FOUND |
| frontend/src/hooks/useOfflineSync.ts | FOUND |
| frontend/src/components/offline/OfflineBanner.tsx | FOUND |
| frontend/src/components/offline/SyncPendingBadge.tsx | FOUND |
| commit 2ed4d64 (Task 2) | FOUND |
| commit b3c6753 (Task 3) | FOUND |
| npx tsc --noEmit | PASSED (0 errors) |
