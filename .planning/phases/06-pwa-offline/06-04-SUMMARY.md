---
phase: 06-pwa-offline
plan: "04"
subsystem: frontend-offline
tags: [pwa, workbox, backgroundsync, zustand, offline-first, install-prompt]
dependency_graph:
  requires:
    - offline-db-schema      # from 06-01
    - useOfflineStatus       # from 06-01
    - useOfflineSync         # from 06-01
    - OfflineBanner          # from 06-01
    - SyncPendingBadge       # from 06-01
    - meja1-offline-intercept  # from 06-02
    - meja2-offline-intercept  # from 06-02
    - meja3-offline-intercept  # from 06-03
    - meja4-offline-intercept-catatan  # from 06-03
    - meja5-offline-intercept  # from 06-03
  provides:
    - workbox-backgroundsync-config
    - global-offline-banner-in-app
    - pwa-install-store
    - kader-dashboard-install-button
  affects:
    - All kader Meja pages (OfflineBanner now globally injected via App.tsx)
    - KaderDashboardPage (install button + SyncPendingBadge)

tech-stack:
  added: []
  patterns:
    - Workbox BackgroundSync shorthand in vite.config.ts runtimeCaching (NOT direct BackgroundSyncPlugin import — vite.config.ts is Node.js, BackgroundSyncPlugin is browser/SW)
    - First-wins pattern: specific BackgroundSync entries before catch-all /api/ (Pitfall 1 order)
    - Zustand UI store for browser event capture (BeforeInstallPromptEvent)
    - beforeinstallprompt capture with e.preventDefault() + stored as Zustand state
    - 40px h-10 spacer in normal flow to prevent content hiding under fixed OfflineBanner

key-files:
  created:
    - frontend/src/stores/usePwaStore.ts
  modified:
    - frontend/vite.config.ts
    - frontend/src/App.tsx
    - frontend/src/pages/kader/KaderDashboardPage.tsx

key-decisions:
  - "Do NOT import BackgroundSyncPlugin directly in vite.config.ts — use backgroundSync shorthand in runtimeCaching options (vite.config.ts is Node.js; BackgroundSyncPlugin is a browser/SW module per RESEARCH.md Pitfall 1)"
  - "BeforeInstallPromptEvent exported from usePwaStore so App.tsx can cast the raw Event safely in TypeScript strict mode"
  - "showInstall guard uses window.matchMedia('display-mode: standalone') — avoids redundant install prompt when app is already installed"
  - "SyncPendingBadge placed below role/name line in header left column; install button in right column flex-col alongside logout button"

patterns-established:
  - "Pattern: Zustand UI store for browser events (beforeinstallprompt)"
  - "Pattern: Workbox BackgroundSync specific-before-catch-all ordering"

requirements-completed:
  - PWA-01

duration: ~2 min
completed: "2026-07-04"
---

# Phase 06 Plan 04: Workbox BackgroundSync + App OfflineBanner + usePwaStore + KaderDashboard Install Button Summary

**Workbox BackgroundSync SW-layer retry for 4 API queue patterns, global OfflineBanner wired into App.tsx, Zustand usePwaStore capturing beforeinstallprompt, and "Pasang Aplikasi" install button in KaderDashboardPage — completes PWA-01 infrastructure layer.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-04T10:37:29Z
- **Completed:** 2026-07-04T10:39:37Z
- **Tasks:** 1 implementation task (Task 2 is human-verify checkpoint — awaiting approval)
- **Files modified:** 4

## Accomplishments

- `vite.config.ts`: 4 Workbox BackgroundSync runtimeCaching entries (kehadiran_queue × 2, pemeriksaan_queue, meja5_queue) ordered correctly BEFORE the catch-all `/api/` pattern (T-06-04-02 mitigation)
- `frontend/src/stores/usePwaStore.ts`: new Zustand store with `BeforeInstallPromptEvent` interface, `setDeferredPrompt`, and `triggerInstall()` with userChoice-based prompt clearing (D-16)
- `frontend/src/App.tsx`: global `<OfflineBanner />` rendered before `<AppRouter />`, `beforeinstallprompt` event captured via `useEffect`, 40px `h-10` spacer when offline prevents Meja content hidden under fixed banner (D-07)
- `frontend/src/pages/kader/KaderDashboardPage.tsx`: "Pasang Aplikasi" install button visible only when `deferredPrompt !== null && !standalone`, `SyncPendingBadge` in header below role line (D-09, D-16, D-17)
- TypeScript strict mode: `npx tsc --noEmit` exits 0 — no errors across all 4 files

## Task Commits

Each task was committed atomically:

1. **Task 1: Workbox BackgroundSync + App.tsx OfflineBanner + usePwaStore + KaderDashboard install button** - `958ea18` (feat)

**Plan metadata:** Pending (after human-verify)

## Files Created/Modified

- `frontend/src/stores/usePwaStore.ts` — New: Zustand store for PWA install prompt state (BeforeInstallPromptEvent, setDeferredPrompt, triggerInstall)
- `frontend/vite.config.ts` — Modified: 4 BackgroundSync entries (kehadiran × 2, pemeriksaan, meja5) inserted before catch-all /api/ pattern; 5 runtimeCaching entries total
- `frontend/src/App.tsx` — Modified: OfflineBanner global + beforeinstallprompt useEffect + h-10 spacer; BrowserRouter wraps all three
- `frontend/src/pages/kader/KaderDashboardPage.tsx` — Modified: imports usePwaStore + SyncPendingBadge + Download; showInstall guard; "Pasang Aplikasi" button; SyncPendingBadge in header

## Decisions Made

- BeforeInstallPromptEvent exported from usePwaStore (not defined locally in App.tsx) so both files share a single type definition — avoids duplication in TypeScript strict mode
- showInstall computed inline in KaderDashboardPage (not in usePwaStore) because `window.matchMedia` is a side effect — kept in component scope
- Install button and logout button grouped in a `flex-col items-end gap-2` container on the right side of the header — preserves original layout while accommodating conditional install button
- SyncPendingBadge placed in the left column below role/name because it's informational context, not an action — keeps action buttons (install, logout) grouped separately

## Deviations from Plan

None — plan executed exactly as written. All architectural decisions (D-07, D-09, D-16, D-17) respected. RESEARCH.md Pitfall 1 (BackgroundSync order) enforced. TypeScript strict mode clean throughout.

## Known Stubs

None — all implemented functionality is fully wired. No hardcoded empty values or placeholder text.

## Threat Flags

No new security surface beyond the plan's threat model:
- T-06-04-01 (beforeinstallprompt privilege escalation): accepted — e.preventDefault() + Zustand state storage grants no elevated permissions
- T-06-04-02 (BackgroundSync order): mitigated — specific patterns BEFORE catch-all verified via `grep -c backgroundSync vite.config.ts` = 4
- T-06-04-03 (OfflineBanner information disclosure): accepted — navigator.onLine is publicly readable by any script
- T-06-04-04 (SW BackgroundSync retry after session expiry): mitigated — JWT cookie sent automatically; 401 stops retry; maxRetentionTime=24h limits window

## Self-Check: PASSED

| Item | Result |
|------|--------|
| frontend/src/stores/usePwaStore.ts | FOUND |
| frontend/vite.config.ts (backgroundSync × 4) | PASS (grep -c = 4) |
| frontend/src/App.tsx (OfflineBanner × 3) | PASS (grep -c = 3) |
| frontend/src/App.tsx (beforeinstallprompt × 2) | PASS (grep -c = 2) |
| frontend/src/pages/kader/KaderDashboardPage.tsx (Pasang Aplikasi × 1) | PASS |
| commit 958ea18 | FOUND |
| npx tsc --noEmit | PASSED (0 errors) |

## Next Phase Readiness

Phase 06 PWA-01 implementation complete — awaiting human-verify checkpoint (Task 2) to confirm end-to-end offline flow works in browser (Tests A-D: OfflineBanner, Meja 2 queue, auto-sync on reconnect, Meja 4 offline disable).

---
*Phase: 06-pwa-offline*
*Completed: 2026-07-04*
