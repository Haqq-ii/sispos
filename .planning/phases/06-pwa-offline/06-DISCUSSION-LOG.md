# Phase 6: PWA & Offline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 6-pwa-offline
**Areas discussed:** IndexedDB & Sync Mechanism, Sync Conflict Resolution, Offline UI Indicators, Meja 4 AI/STT Fallback, PWA Install Prompt

> **Note:** User was away from keyboard during discussion. All decisions made by Claude using best-judgment defaults appropriate for a single-posyandu academic project with tight deadline.

---

## IndexedDB Library & Sync Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Raw IDB API | Native browser API, no dependencies | |
| `idb` library | Lightweight TypeScript wrapper | ✓ |
| Workbox BackgroundSync only | Handles failed requests via Service Worker | combined |

**Decision:** Use `idb` for IndexedDB access + Workbox BackgroundSync for HTTP retry. Triggered by `window 'online'` event.

---

## Sync Conflict Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Last-write-wins | Overwrite server data with local | ✓ |
| Skip on conflict | Log error, skip that record | ✓ (complement) |
| Manual conflict UI | Show kader which records conflicted | |

**Decision:** Last-write-wins as primary; if server returns conflict error, log and skip. Errors stored in `sync_errors` IDB store.

---

## Offline UI Indicators

| Option | Description | Selected |
|--------|-------------|----------|
| Silent degradation | No UI change, form still works | |
| Global offline banner | Red/orange banner across all kader pages | ✓ |
| Pending badge in header | Counter for unsynced items | ✓ |

**Decision:** Global banner + pending count badge + toast on offline submit.

---

## Meja 4 AI/STT Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Disable entire Meja 4 form | Block all input offline | |
| Disable only AI/STT buttons | Allow manual catatan only | ✓ |
| Skip offline silently | No visual change | |

**Decision:** Disable rekam + AI buttons with tooltip. Manual textarea remains active and queued.

---

## Claude's Discretion

- IndexedDB schema field names and indexes
- Workbox BackgroundSync retry window (24h default)
- FIFO sync order per meja store
- Install button position in navbar

## Deferred Ideas

- Web Push API notifications — already out-of-scope in PROJECT.md
- Background Periodic Sync API — too complex for academic context
- Conflict resolution UI for kaders — overkill for single-posyandu
