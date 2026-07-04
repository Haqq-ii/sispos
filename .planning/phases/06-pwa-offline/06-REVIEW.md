---
phase: 06-pwa-offline
status: fixed
critical: 5
warnings: 8
info: 3
reviewed_at: 2026-07-04T00:00:00Z
fixed_at: 2026-07-04T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - frontend/src/lib/offline-db.ts
  - frontend/src/hooks/useOfflineStatus.ts
  - frontend/src/hooks/useOfflineSync.ts
  - frontend/src/components/offline/OfflineBanner.tsx
  - frontend/src/components/offline/SyncPendingBadge.tsx
  - frontend/src/pages/kader/meja/Meja1Page.tsx
  - frontend/src/pages/kader/meja/Meja2Page.tsx
  - frontend/src/pages/kader/meja/Meja3Page.tsx
  - frontend/src/pages/kader/meja/Meja4Page.tsx
  - frontend/src/pages/kader/meja/Meja5Page.tsx
  - frontend/src/stores/usePwaStore.ts
  - frontend/src/App.tsx
  - frontend/src/pages/kader/KaderDashboardPage.tsx
---

# Phase 06: PWA Offline — Code Review Report

**Reviewed:** 2026-07-04T00:00:00Z
**Depth:** deep (cross-file call chain analysis)
**Files Reviewed:** 13
**Status:** findings

---

## Summary

The offline-first layer covers all five meja pages with IDB enqueue + auto-sync on reconnect. The
skeleton is architecturally sound: FIFO replay, per-item try/catch, 422/409 skip logic, and STT/AI
gating are all present. However five critical defects prevent the layer from working correctly in
production:

1. The IDB singleton is permanently poisoned after any open failure.
2. `SyncPendingBadge` instantiates its own `useOfflineSync()` in every meja page that already
   mounts the hook — causing two concurrent `syncAll()` runs every reconnect, which duplicates API
   writes and races on IDB deletes.
3. 422/409 items are logged but never deleted from IDB — they retry forever.
4. The `tempId → realId` map is local to each `syncAll()` call — patch operations permanently
   break if a network drop separates the 'create' sync from the 'patch' syncs.
5. The PWA install prompt is not cleared on 'dismissed' — the "Pasang Aplikasi" button keeps
   showing and calls `prompt()` on an already-consumed event.

---

## Critical Issues

### CR-01: IDB singleton promise not reset on rejection — offline queue permanently broken

**File:** `frontend/src/lib/offline-db.ts:73-103`
**Issue:** `dbPromise` is set once and never cleared. If `openDB()` rejects (private browsing mode,
quota exceeded, user-blocked storage, IDB not available), `dbPromise` holds a permanently rejected
Promise. Every subsequent call to `getOfflineDB()` immediately rejects with the same error.
All `enqueueOperation`, `countPending`, and `logSyncError` calls then silently fail.
The kader sees "Tersimpan lokal" toasts but nothing is actually stored.

**Fix:**
```typescript
export function getOfflineDB(): Promise<IDBPDatabase<SisposOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SisposOfflineDB>(DB_NAME, DB_VERSION, { upgrade(db) { /* ... */ } })
      .catch((err) => {
        dbPromise = null // Reset so the next call retries
        return Promise.reject(err)
      })
  }
  return dbPromise
}
```

---

### CR-02: SyncPendingBadge creates independent useOfflineSync instance — dual syncAll() on reconnect causes duplicate API writes

**Files:** `frontend/src/components/offline/SyncPendingBadge.tsx:11`,
`frontend/src/pages/kader/meja/Meja1Page.tsx:92`,
`frontend/src/pages/kader/meja/Meja2Page.tsx:139`,
`frontend/src/pages/kader/meja/Meja3Page.tsx:129`,
`frontend/src/pages/kader/meja/Meja4Page.tsx:135`,
`frontend/src/pages/kader/meja/Meja5Page.tsx:83`

**Issue:** Every `<SyncPendingBadge />` calls `useOfflineSync()` internally. Each call to
`useOfflineSync()` registers its own `window.addEventListener('online', handler)` that fires
`syncAll()`. Meja pages 1–5 each call `useOfflineSync()` directly AND render
`<SyncPendingBadge />`. When the device reconnects, the `'online'` event fires **two concurrent
`syncAll()` runs simultaneously** on every Meja page:

- Both runs fetch the same IDB items in the same pass.
- Both issue the same `POST /growth/pemeriksaan` — creating **duplicate pemeriksaan records**.
- Both call `db.delete('pemeriksaan_queue', item.id)` — the second delete may throw or silently
  no-op depending on IDB transaction state.
- Both call `setActivePemeriksaanId(realId)` with the (potentially different) server IDs from
  their duplicate POST responses.
- Both show a toast.

This is data-duplication at the backend level; there is no server-side idempotency guard to catch
it.

**Fix:** `SyncPendingBadge` must NOT own a `useOfflineSync()` instance. Pass `pendingCount` as a
prop, or read it from a dedicated lightweight hook that does not register sync listeners:

```typescript
// New hook: useOfflinePendingCount.ts
export function useOfflinePendingCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    countPending().then(setCount)
    const refresh = () => countPending().then(setCount)
    window.addEventListener('online', refresh)
    return () => window.removeEventListener('online', refresh)
  }, [])
  return count
}

// SyncPendingBadge.tsx
import { useOfflinePendingCount } from '@/hooks/useOfflinePendingCount'
export function SyncPendingBadge() {
  const pendingCount = useOfflinePendingCount()
  if (pendingCount === 0) return null
  return <span ...>{pendingCount} pending</span>
}
```

---

### CR-03: 422/409 error items never deleted from IDB — infinite retry loop

**File:** `frontend/src/hooks/useOfflineSync.ts:85-90, 116-120, 139-143`
**Issue:** After a 422 or 409 response, the code logs the error to `sync_errors` and increments
`skipCount`, but **does not call `db.delete()`** on the failed item. The item remains in the IDB
queue. Every subsequent `syncAll()` call (triggered each reconnect via `SyncPendingBadge` × 2 per
CR-02) retries the same item, gets another 422, logs another error entry, and loops. The pending
count never reaches zero, `sync_errors` grows unbounded, and `skipCount` is always nonzero so
kaders always see the destructive toast.

Present in all three queue processors — kehadiran, pemeriksaan, meja5.

**Fix (shown for kehadiran; apply identically to all three):**
```typescript
if (status === 422 || status === 409) {
  await logSyncError(item as unknown as Record<string, unknown>, status, message)
  await db.delete('kehadiran_queue', item.id) // Delete after logging — no retry for hard failures
  skipCount++
}
```

---

### CR-04: tempIdMap not persisted across syncAll() calls — patch operations permanently fail after partial sync

**File:** `frontend/src/hooks/useOfflineSync.ts:95`
**Issue:** `tempIdMap` is declared as a local variable inside `syncAll()` and is empty on every
invocation. The 'create' pemeriksaan item is processed first (FIFO), the server real ID is stored
in `tempIdMap`, then 'patch' items use `tempIdMap[item.tempPemeriksaanId] ?? item.tempPemeriksaanId`
to resolve the endpoint. This works within a single `syncAll()` call.

However, if the network drops again after the 'create' succeeds (and is deleted from IDB) but
before the 'patch' items are processed:
- Next `syncAll()`: 'create' item is gone; 'patch' items remain with `tempPemeriksaanId` = original
  tempId; `tempIdMap` is empty; resolved ID = tempId (not the real server UUID).
- `PATCH /growth/pemeriksaan/${tempId}` → server returns 404 or 422.
- With CR-03 fixed: item gets logged and deleted. Tanda klinis and catatan are permanently lost.
- Without CR-03 fix: infinite retry loop with a garbage endpoint.

**Fix:** Persist the tempId→realId mapping to IDB (or `localStorage`) as part of the 'create'
success path, and read it at the start of `syncAll()` for patch resolution:

```typescript
// In offline-db.ts — add a new store or use a key-value store:
const tempIdResolutions: Record<string, string> = {}

export async function persistTempIdResolution(tempId: string, realId: string): Promise<void> {
  // Write to IDB sync_errors store as a resolution entry, or a dedicated store
  localStorage.setItem(`tempId:${tempId}`, realId)
}
export function resolveTempId(tempId: string): string {
  return localStorage.getItem(`tempId:${tempId}`) ?? tempId
}

// In syncAll() 'create' path:
localStorage.setItem(`tempId:${item.tempPemeriksaanId}`, realId)

// In syncAll() 'patch' path:
const resolvedId = tempIdMap[item.tempPemeriksaanId]
  ?? localStorage.getItem(`tempId:${item.tempPemeriksaanId}`)
  ?? item.tempPemeriksaanId
```

---

### CR-05: triggerInstall doesn't clear deferredPrompt on 'dismissed' — button calls prompt() on consumed event

**File:** `frontend/src/stores/usePwaStore.ts:35-38`
**Issue:** Per the Web App Install API spec, calling `prompt()` on a `BeforeInstallPromptEvent`
consumes it regardless of the user's choice. After the promise resolves with `outcome: 'dismissed'`,
the event cannot be reused. The current code only calls `setDeferredPrompt(null)` on 'accepted':

```typescript
if (result.outcome === 'accepted') {
  setDeferredPrompt(null)
}
// dismissed: deferredPrompt stays set to the consumed event
```

The "Pasang Aplikasi" button remains visible. On the next click, `await deferredPrompt.prompt()`
is called on an exhausted event. Browsers silently ignore or throw `InvalidStateError`. The kader
sees a button that appears to do nothing.

**Fix:**
```typescript
async triggerInstall() {
  const { deferredPrompt, setDeferredPrompt } = get()
  if (!deferredPrompt) return
  try {
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
  } finally {
    setDeferredPrompt(null) // Always clear — event is consumed regardless of outcome
  }
},
```

---

## Warnings

### WR-01: generateTempId() Math.random() fallback can produce IDB key collisions

**File:** `frontend/src/lib/offline-db.ts:119`
**Issue:** The HTTP-only fallback `'temp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)` uses only 7 random base-36 characters (≈ 2.18 billion values). In a single offline session with rapid enqueue calls, `Date.now()` can be the same tick, leaving only ~1-in-2-billion uniqueness. If a collision occurs, `db.add()` throws a `ConstraintError` (IDB keyPath collision), the enqueue silently fails (see WR-03), and the item is lost.

**Fix:** Use a counter suffix guaranteed to be monotonically unique per session:
```typescript
let _seq = 0
export function generateTempId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `temp-${Date.now().toString(36)}-${(++_seq).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
```

---

### WR-02: logSyncError() can throw inside catch block — aborts remaining sync loop items

**File:** `frontend/src/hooks/useOfflineSync.ts:86, 117, 140`
**Issue:** `logSyncError` is awaited inside the `catch` block. If `db.add('sync_errors', ...)` fails
(IDB quota exceeded, IDB closed, key collision from WR-01), the exception from `logSyncError`
propagates out of the `catch` block and is uncaught. This throws out of the `for...of` loop body,
aborting all remaining items in the current queue pass.

**Fix:** Wrap `logSyncError` in its own nested try/catch:
```typescript
} catch (err: unknown) {
  const status = (err as { response?: { status?: number } }).response?.status ?? 0
  const message = (err as Error).message ?? 'Unknown error'
  if (status === 422 || status === 409) {
    try {
      await logSyncError(item as unknown as Record<string, unknown>, status, message)
      await db.delete('kehadiran_queue', item.id) // CR-03 fix also here
    } catch {
      // IDB write failed — log to console at minimum
      console.warn('[syncAll] Failed to write sync_error for item', item.id)
    }
    skipCount++
  }
}
```

---

### WR-03: enqueueOperation() calls are void/fire-and-forget — IDB failures silently lost, user navigates with missing data

**Files:** `frontend/src/pages/kader/meja/Meja1Page.tsx:166`,
`frontend/src/pages/kader/meja/Meja2Page.tsx:213`,
`frontend/src/pages/kader/meja/Meja3Page.tsx:175`,
`frontend/src/pages/kader/meja/Meja4Page.tsx:218`,
`frontend/src/pages/kader/meja/Meja5Page.tsx:160`

**Issue:** All offline branches follow this pattern:
```typescript
void enqueueOperation('kehadiran', { ... }) // fire and forget
toast({ description: 'Tersimpan lokal, akan sync saat online' })
navigate('/kader/meja/2', { ... })
```
If `enqueueOperation` throws (IDB unavailable, CR-01, key collision, quota), the error is
discarded by `void`. The toast says "Tersimpan lokal" but nothing was saved. The user proceeds to
the next meja believing their data is safe.

**Fix:** `await` the enqueue and handle failure before navigating:
```typescript
try {
  await enqueueOperation('kehadiran', { ... })
  toast({ description: 'Tersimpan lokal, akan sync saat online' })
  navigate('/kader/meja/2', { ... })
} catch {
  toast({ description: 'Gagal menyimpan lokal. Periksa penyimpanan perangkat.', variant: 'destructive' })
}
```
This requires the calling functions to be `async`.

---

### WR-04: Meja4 online catatan save does not navigate to Meja5; offline path does — divergent kader flow

**File:** `frontend/src/pages/kader/meja/Meja4Page.tsx:228-249`
**Issue:** When **offline**, `handleSimpanCatatan` enqueues the catatan and immediately navigates
to `/kader/meja/5`. When **online**, `saveCatatanMutation.mutate` saves successfully but the
`onSuccess` callback only shows a toast — no navigation. The kader must separately click
"Lanjut ke Meja 5".

This means kaders trained in offline mode will expect auto-advance and may be confused when online.
More critically, a kader may click "Selesai Meja 4" (exit to dashboard) after saving catatan
online without realising they need to click "Lanjut ke Meja 5" first — bypassing Meja 5 entirely.

**Fix:** Align the online `onSuccess` callback with the offline path:
```typescript
saveCatatanMutation.mutate(
  { id: pemeriksaanId, catatanKonsultasi: catatanValue },
  {
    onSuccess: () => {
      toast({ description: 'Catatan konsultasi berhasil disimpan.' })
      navigate('/kader/meja/5', {
        state: { antrianId, balitaId, namaBalita, pemeriksaanId },
      })
    },
    ...
  }
)
```

---

### WR-05: Meja5 balitaId typed as `string | null` — null propagates unguarded to immunization API and offline queue

**File:** `frontend/src/pages/kader/meja/Meja5Page.tsx:93, 120-126, 159-170`
**Issue:**
```typescript
const balitaId = state?.balitaId ?? activeBalitaId ?? null
```
If `balitaId` is null:
- `tambahMutation` sends `{ balitaId: null, ... }` to `POST /immunization` — backend 422.
- `handleTambahImunisasi` (offline) enqueues `{ data: { balitaId: null, ... } }` — permanent 422
  on sync (and with CR-03 unfixed, loops forever).
- The "Tambahkan" button is only guarded by `!namaVaksin`, not `!balitaId`.

The riwayat query is correctly guarded (`enabled: !!balitaId`), but the form submit paths are not.

**Fix:** Add a guard before the submit actions:
```typescript
function handleTambahImunisasi() {
  if (!balitaId) {
    toast({ description: 'Data balita tidak tersedia. Kembali ke Meja 1.', variant: 'destructive' })
    return
  }
  // ... rest of handler
}
```
Also add `disabled={!namaVaksin || !balitaId || tambahMutation.isPending}` on the Tambahkan button.

---

### WR-06: triggerInstall() does not handle prompt() rejection — silent button failure

**File:** `frontend/src/stores/usePwaStore.ts:34`
**Issue:** `await deferredPrompt.prompt()` can throw (e.g., called without a user gesture in some
browsers, or called on a consumed event before CR-05 is fixed). The error propagates out of
`triggerInstall()`. All call sites use `void triggerInstall()`, so the rejection is silently
swallowed — the button appears to do nothing.

**Fix:** Add error handling inside `triggerInstall` (combined with CR-05 fix shown above using
`try/finally`). Callers should also handle rejection if user-visible feedback is needed.

---

### WR-07: Empty catch blocks violate CLAUDE.md TypeScript strict rules

**Files:** `frontend/src/pages/kader/KaderDashboardPage.tsx:61`,
`frontend/src/pages/kader/meja/Meja5Page.tsx:144`

**Issue:** Two empty catch blocks with no logging or user feedback:
```typescript
// KaderDashboardPage.tsx
try { await apiClient.post('/auth/logout') } catch {}

// Meja5Page.tsx
try { await apiClient.delete('/kader/active-meja') } catch {}
```
Both are intentionally fire-and-forget (logout/cleanup best-effort), but CLAUDE.md mandates
TypeScript strict mode which flags bare empty catches. Silent swallowing also hides unexpected
server errors during development.

**Fix:**
```typescript
try { await apiClient.post('/auth/logout') } catch (e) {
  // Best-effort logout — intentionally ignored; local auth cleared regardless
  if (import.meta.env.DEV) console.warn('Logout API failed:', e)
}
```

---

### WR-08: window.matchMedia() called without null-safety in KaderDashboardPage

**File:** `frontend/src/pages/kader/KaderDashboardPage.tsx:39`
**Issue:**
```typescript
const showInstall = deferredPrompt !== null && !window.matchMedia('(display-mode: standalone)').matches
```
`window.matchMedia` is undefined in JSDOM (Vitest/jest) and in some legacy browsers. Calling it
unconditionally throws `TypeError: window.matchMedia is not a function` — crashing the component
in test environments and potentially in production on unusual browsers.

**Fix:**
```typescript
const showInstall =
  deferredPrompt !== null &&
  !(window.matchMedia?.('(display-mode: standalone)')?.matches ?? false)
```

---

## Info

### IN-01: syncAll() always shows success toast when queue is empty — noise on every reconnect

**File:** `frontend/src/hooks/useOfflineSync.ts:148-155`
**Issue:** `syncAll()` fires on every `'online'` event (including normal reconnects with zero pending
items). When all queues are empty it still shows "Data berhasil disinkronkan". Kaders see this
toast constantly during normal sessions, desensitising them to it.

**Fix:** Guard the toast behind a `synced > 0` check:
```typescript
const syncedCount = kehadiranItems.length + pemeriksaanItems.length + meja5Items.length - skipCount
if (synced > 0 && skipCount === 0) {
  toast({ description: 'Data berhasil disinkronkan' })
} else if (skipCount > 0) {
  toast({ description: `Gagal sinkronkan ${skipCount} data — lihat rekap harian`, variant: 'destructive' })
}
// No toast if queue was empty
```

---

### IN-02: useOfflineStatus() instantiated twice in App.tsx — redundant event listeners

**Files:** `frontend/src/App.tsx:11`, `frontend/src/components/offline/OfflineBanner.tsx:14`
**Issue:** `App.tsx` calls `useOfflineStatus()` solely to render the 40px spacer. `OfflineBanner`
also calls `useOfflineStatus()` internally. Two listeners register for the same `online`/`offline`
events. Functionally harmless (each removes its own listener on unmount), but redundant.

**Fix:** Accept `isOnline` as a prop in `OfflineBanner`:
```typescript
// OfflineBanner.tsx
export function OfflineBanner({ isOnline }: { isOnline: boolean }) { ... }

// App.tsx — single useOfflineStatus() feeds both:
const isOnline = useOfflineStatus()
return (
  <BrowserRouter>
    <OfflineBanner isOnline={isOnline} />
    {!isOnline && <div className="h-10" aria-hidden="true" />}
    ...
  </BrowserRouter>
)
```

---

### IN-03: transcribeMutation missing from useEffect dependency array in Meja4Page

**File:** `frontend/src/pages/kader/meja/Meja4Page.tsx:167-172`
**Issue:**
```typescript
useEffect(() => {
  if (audioBlob) {
    transcribeMutation.mutate(audioBlob)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [audioBlob])
```
`transcribeMutation` is captured at effect creation time and excluded with an eslint-disable. While
TanStack Query's `mutate` function is stable by reference, the eslint-disable suppresses a lint
rule for a reason that should be documented. The disable comment predisposes future developers to
trust it uncritically.

**Fix:** Either include `transcribeMutation.mutate` in the dependency array (it is stable), or use
a ref pattern:
```typescript
const mutateRef = useRef(transcribeMutation.mutate)
useEffect(() => { mutateRef.current = transcribeMutation.mutate }, [transcribeMutation.mutate])

useEffect(() => {
  if (audioBlob) mutateRef.current(audioBlob)
}, [audioBlob])
```

---

_Reviewed: 2026-07-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
