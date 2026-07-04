# Phase 6: PWA & Offline — Research

**Researched:** 2026-07-04
**Domain:** Progressive Web App — IndexedDB offline queue + Workbox BackgroundSync + navigator.onLine detection
**Confidence:** HIGH (primary stack fully verified against npm registry + codebase; idb package cross-verified via official homepage)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Gunakan library `idb` (wrapper tipis atas native IDB API) — sudah tersedia via npm, TypeScript-friendly, tidak butuh install berat
- **D-02:** Sync queue triggered oleh `window 'online'` event + Workbox BackgroundSync plugin untuk retry HTTP request yang gagal
- **D-03:** IndexedDB stores: `pemeriksaan_queue`, `kehadiran_queue`, `meja5_queue` — masing-masing per operasi kritis
- **D-04:** Last-write-wins saat sync — jika server return conflict atau 422, log error dan skip record tersebut (jangan gagalkan seluruh batch)
- **D-05:** Ini adalah proyek single-posyandu (satu Puskesmas), multi-device collision sangat jarang → simplicity > complexity untuk konteks akademik
- **D-06:** Sync error disimpan di IndexedDB store `sync_errors` — kader bisa lihat di rekap harian jika ada
- **D-07:** Tampilkan banner merah/oranye di atas halaman saat `navigator.onLine === false`: "Mode Offline — data tersimpan lokal"
- **D-08:** Tombol submit di Meja 1-5 tetap aktif saat offline (tidak di-disable) — submit ke IndexedDB, tampilkan toast "Tersimpan lokal, akan sync saat online"
- **D-09:** Badge counter "N pending" di header kader saat ada antrian sync belum terkirim
- **D-10:** Saat sync selesai, tampilkan toast "Data berhasil disinkronkan"
- **D-11:** Saat offline, tombol "Rekam Suara" (Google STT) di-disable dengan tooltip "Tidak tersedia offline"
- **D-12:** Saat offline, tombol "Analisis AI" (OpenAI early warning) di-disable dengan tooltip "Tidak tersedia offline"
- **D-13:** Form textarea `catatanKlinis` tetap aktif saat offline — kader bisa input catatan manual, tersimpan ke IndexedDB
- **D-14:** Form data Meja 4 yang tersimpan offline (tanpa AI/STT) di-sync ke backend saat online; field `rekomendasiAi` dan `catatanSTT` dikosongkan/null
- **D-15:** `manifest.json` sudah valid — PWA installable sudah terpenuhi dari Phase 0
- **D-16:** Tambahkan `beforeinstallprompt` handler sederhana di `App.tsx` untuk menyimpan event dan show install button di header (hanya muncul kalau belum di-install)
- **D-17:** Tidak perlu custom install page — cukup button kecil di navbar atau toast

### Claude's Discretion
- Implementasi detail IndexedDB schema (field names, indexes) — sesuaikan dengan struktur API request yang ada
- Timing retry: Workbox BackgroundSync default (24 jam window) sudah cukup untuk konteks Posyandu harian
- Order sync queue: FIFO (first-in first-out) per meja — tidak ada dependency antar meja yang perlu dikelola

### Deferred Ideas (OUT OF SCOPE)
- Push notification (Web Push API) — sudah di-out-of-scope di PROJECT.md; WA notif via BullMQ sudah cukup
- Background periodic sync API — terlalu kompleks untuk konteks akademik; `window 'online'` event cukup
- Conflict UI (tampilkan ke kader mana record yang conflict) — overkill untuk single-posyandu akademik
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PWA-01 | Service Worker via Workbox; input Meja 1-5 tersimpan ke IndexedDB saat offline; auto-sync ke server saat koneksi kembali; matikan internet → input Meja 2 → IndexedDB, online → tersync ke DB | Covered by: idb v8 schema design, useOfflineSync hook pattern, VitePWA BackgroundSync config, window 'online' event handler |
</phase_requirements>

---

## Summary

Phase 6 adds offline-first capability to the existing Kader 5-Meja flow. No new screens are created — all changes are modifications to existing components plus four new utility files (idb schema, offline status hook, sync hook, two new UI components). The foundation is already in place: VitePWA v0.20.5 is installed and configured with a working service worker, `manifest.json` is valid, and all Meja mutations use the same `apiClient` (axios) pattern — making consistent offline interception straightforward.

The primary implementation consists of three layers: (1) an IndexedDB schema using the `idb` library (not yet installed — needs `npm install idb`) with four stores matching D-03/D-06; (2) a React-layer `useOfflineSync` hook that listens for the `window 'online'` event and replays queued operations in FIFO order; (3) mutation-level offline detection in each of the five Meja pages that writes to IndexedDB instead of calling the API when `navigator.onLine === false`.

The most critical non-trivial design challenge is the **pemeriksaanId chain**: Meja 2 creates a `Pemeriksaan` record via POST and receives a server-generated UUID; Meja 3 and Meja 4 PATCH that same record. When offline, the POST cannot receive a real ID. The resolution is to generate a client-side `tempPemeriksaanId = crypto.randomUUID()` at Meja 2, pass it in navigation state to Meja 3/4, queue all operations with a `tempId` field, and resolve the mapping during sync (POST first → get real ID → substitute in subsequent PATCHes before sending them).

**Primary recommendation:** Implement offline support as a React-layer intercept at each Meja mutation (not an axios interceptor on all requests), using `idb` v8 for queue storage, `window 'online'` event for triggering sync, and Workbox BackgroundSync as a secondary SW-layer fallback in `vite.config.ts`. The `useOfflineSync` hook should expose `enqueueOperation()` and `syncAll()` as the uniform interface for all Meja pages.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Offline detection (`navigator.onLine`) | Browser / Client | — | Browser API — no server involvement; checked at mutation call site |
| IndexedDB queue storage | Browser / Client | — | Local persistence; idb abstracts IndexedDB API |
| Offline sync on reconnect | Browser / Client | Service Worker | 'online' event in React layer; Workbox BackgroundSync as SW fallback |
| Service Worker / Workbox config | Frontend Server (SSR/Build) | Service Worker | VitePWA generates SW at build time via vite.config.ts |
| beforeinstallprompt handling | Browser / Client | — | Browser event, stored in React state in App.tsx |
| Offline banner / badge UI | Browser / Client | — | React components, purely presentational |
| Meja 4 STT/AI feature disable | Browser / Client | — | Conditional render based on `navigator.onLine` state |
| Sync conflict/error logging | Browser / Client | — | Write to `sync_errors` IDB store; backend not involved in error recording |
| Server-side IDOR validation | API / Backend | — | Backend validates every synced request (JWT cookie still present during sync) |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | 8.0.3 | TypeScript-friendly wrapper for native IndexedDB API | D-01 locked; by Jake Archibald (Google Chrome team); used in Google's official web.dev PWA tutorials; ~5M weekly downloads |
| `vite-plugin-pwa` | 0.20.5 | Generates Workbox service worker at build; VitePWA plugin | Already installed in devDependencies; existing `vite.config.ts` uses it |
| `workbox-background-sync` | 7.4.1 | Background retry of failed network requests via SW | Available as part of Workbox suite (from Google Chrome team); referenced in VitePWA runtime caching config |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomUUID()` | Browser built-in | Generate temp IDs for offline pemeriksaan records | Meja 2 offline: create tempPemeriksaanId before POST |
| `navigator.onLine` | Browser API | Synchronous online status check | At mutation call site to decide: queue vs. send |
| `window.addEventListener('online'/'offline')` | Browser API | Reactive online status | In `useOfflineStatus` hook to drive re-render |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `idb` | Dexie.js | Dexie is more full-featured but heavier; idb is locked by D-01 |
| `idb` | Native IndexedDB API | Native API is verbose and error-prone; idb is locked by D-01 |
| Window 'online' event | Background Periodic Sync API | Deferred by user; not supported on iOS Safari |

**Installation:**
```bash
cd frontend && npm install idb@8
```

**Version verification:** `npm view idb version` → `8.0.3` [VERIFIED: npm registry]

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time — all packages tagged per graceful degradation rule.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `idb` | npm | ~9 yrs | ~5M/wk | [github.com/jakearchibald/idb](https://github.com/jakearchibald/idb) | N/A — slopcheck unavailable | Approved — cross-verified via npm view + official homepage + Google web.dev attribution |
| `vite-plugin-pwa` | npm | ~4 yrs | ~600K/wk | [github.com/vite-pwa/vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | N/A | Already installed v0.20.5 |
| `workbox-background-sync` | npm | ~8 yrs | ~3M/wk | [github.com/GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) | N/A | Available via workbox suite from Google Chrome team |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. `idb` is tagged `[ASSUMED]` for slopcheck status. However, it is cross-verified via `npm view idb` returning the correct homepage (`github.com/jakearchibald/idb`) and is documented on [web.dev/articles/indexeddb](https://web.dev/articles/indexeddb) as the recommended IDB wrapper. The planner should run `npm audit` after install as standard practice. No checkpoint:human-verify task required given the strong provenance chain.*

---

## Architecture Patterns

### System Architecture Diagram

```
Kader Action (submit form in Meja 1-5)
        │
        ▼
useOfflineStatus: navigator.onLine?
   ├─ YES (online) ──────────────────────────► apiClient.post/patch (axios)
   │                                                  │
   │                                          TanStack Query mutation
   │                                                  │
   │                                          Backend API response
   │                                                  │
   │                                          onSuccess: toast + navigate
   │
   └─ NO (offline) ─────────────────────────► enqueueOperation(type, payload)
                                                      │
                                              idb: write to kehadiran_queue
                                                    / pemeriksaan_queue
                                                    / meja5_queue
                                                      │
                                              toast: "Tersimpan lokal..."
                                                      │
                                              SyncPendingBadge.count++
                                                      │
                                              navigate forward normally
                                              (with tempPemeriksaanId if Meja 2)

        ┌──── window 'online' event fires ───────────────────────────────┐
        │                                                                 │
        ▼                                                                 │
useOfflineSync.syncAll()                                                  │
        │                                                                 │
        ├─ Read kehadiran_queue (FIFO)                                    │
        │    └─ PATCH /antrian/:id/hadir | tangguhkan                    │
        │                                                                 │
        ├─ Read pemeriksaan_queue (FIFO)                                  │
        │    ├─ Item type='create': POST /growth/pemeriksaan              │
        │    │    └─ resolve tempId → realId → update queue              │
        │    ├─ Item type='patch-tanda-klinis': PATCH /growth/...        │
        │    └─ Item type='patch-catatan': PATCH /growth/...             │
        │                                                                 │
        ├─ Read meja5_queue (FIFO)                                       │
        │    ├─ type='immunization': POST /immunization                   │
        │    └─ type='selesai': PATCH /antrian/:id/selesai               │
        │                                                                 │
        ├─ 422 response: log to sync_errors, skip (D-04)                 │
        └─ All done: toast "Data berhasil disinkronkan"                  │
                  OR "Gagal sinkronkan N data — lihat rekap harian"      │
                                                                          │
Service Worker layer (secondary — Workbox BackgroundSync):               │
  ├─ Intercepts specific API patterns if SW context is active            │
  └─ Only effective in Chrome/Edge; iOS Safari fallback = 'online' event─┘

App.tsx (global):
  ├─ <OfflineBanner> — fixed top, shows when !navigator.onLine
  ├─ beforeinstallprompt capture → install button state
  └─ PWA install button in KaderDashboard header
```

### Recommended Project Structure

```
frontend/src/
├── lib/
│   ├── axios.ts              # Existing — no changes needed
│   └── offline-db.ts         # NEW: idb schema + CRUD operations for all 4 stores
├── hooks/
│   ├── useOfflineStatus.ts   # NEW: navigator.onLine + 'online'/'offline' events
│   └── useOfflineSync.ts     # NEW: syncAll() + enqueueOperation() + pending count
├── components/
│   └── offline/
│       ├── OfflineBanner.tsx      # NEW: fixed orange banner when offline
│       └── SyncPendingBadge.tsx   # NEW: "N pending" badge for Meja headers
├── pages/kader/meja/
│   ├── Meja1Page.tsx         # MODIFY: wrap hadirMutation + tangguhkanMutation offline
│   ├── Meja2Page.tsx         # MODIFY: wrap createPemeriksaan offline + bypass Z-Score on offline
│   ├── Meja3Page.tsx         # MODIFY: wrap patchPemeriksaan offline
│   ├── Meja4Page.tsx         # MODIFY: disable STT/AI, wrap patchPemeriksaan offline
│   └── Meja5Page.tsx         # MODIFY: wrap tambahMutation + selesaiMutation offline
└── App.tsx                   # MODIFY: add <OfflineBanner> + beforeinstallprompt handler
```

### Pattern 1: idb v8 Store Schema

**What:** Open IndexedDB with 4 stores and typed interface
**When to use:** In `offline-db.ts`, called once then cached as a Promise

```typescript
// Source: https://github.com/jakearchibald/idb#readme (official) [ASSUMED — idb v8 API]
import { openDB, type IDBPDatabase } from 'idb'

interface SisposOfflineDB {
  kehadiran_queue: {
    key: string
    value: {
      id: string
      antrianId: string
      action: 'hadir' | 'tangguhkan'
      slotId: string
      balitaId?: string
      namaBalita?: string
      timestamp: number
    }
    indexes: { by_timestamp: number }
  }
  pemeriksaan_queue: {
    key: string
    value: {
      id: string
      tempPemeriksaanId: string // client-generated UUID; resolved to real ID on sync
      type: 'create' | 'patch-tanda-klinis' | 'patch-catatan'
      data: Record<string, unknown>
      timestamp: number
    }
    indexes: { by_timestamp: number; by_type: string }
  }
  meja5_queue: {
    key: string
    value: {
      id: string
      type: 'immunization' | 'selesai'
      data: Record<string, unknown>
      timestamp: number
    }
    indexes: { by_timestamp: number }
  }
  sync_errors: {
    key: string
    value: {
      id: string
      originalOperation: Record<string, unknown>
      error: string
      statusCode: number
      timestamp: number
    }
    indexes: { by_timestamp: number }
  }
}

const DB_NAME = 'sispos-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<SisposOfflineDB>> | null = null

export function getOfflineDB(): Promise<IDBPDatabase<SisposOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SisposOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('kehadiran_queue')) {
          const s = db.createObjectStore('kehadiran_queue', { keyPath: 'id' })
          s.createIndex('by_timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('pemeriksaan_queue')) {
          const s = db.createObjectStore('pemeriksaan_queue', { keyPath: 'id' })
          s.createIndex('by_timestamp', 'timestamp')
          s.createIndex('by_type', 'type')
        }
        if (!db.objectStoreNames.contains('meja5_queue')) {
          const s = db.createObjectStore('meja5_queue', { keyPath: 'id' })
          s.createIndex('by_timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('sync_errors')) {
          const s = db.createObjectStore('sync_errors', { keyPath: 'id' })
          s.createIndex('by_timestamp', 'timestamp')
        }
      },
    })
  }
  return dbPromise
}
```

### Pattern 2: useOfflineStatus Hook

**What:** Reactive hook that tracks `navigator.onLine` and re-renders consumers on change
**When to use:** In each Meja page and OfflineBanner component

```typescript
// Source: MDN Web Docs — Navigator.onLine, window 'online'/'offline' events [ASSUMED]
import { useState, useEffect } from 'react'

export function useOfflineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

### Pattern 3: Meja Mutation Offline Intercept

**What:** Check `isOnline` before firing mutation; if offline, write to IDB and show toast
**When to use:** In every Meja page at each critical mutation call site

```typescript
// Pattern applied in Meja 1 hadirMutation (replicate for tangguhkan, and all other meja pages)
const isOnline = useOfflineStatus()
const { enqueueOperation, pendingCount } = useOfflineSync()

// Before calling mutation:
function handleHadir(payload: { antrianId: string; balitaId: string; namaBalita: string }) {
  if (!isOnline) {
    void enqueueOperation('kehadiran', {
      id: crypto.randomUUID(),
      antrianId: payload.antrianId,
      action: 'hadir' as const,
      slotId: activeSlotId,
      balitaId: payload.balitaId,
      namaBalita: payload.namaBalita,
      timestamp: Date.now(),
    })
    toast({ description: 'Tersimpan lokal, akan sync saat online' })
    setActiveAntrian(payload.antrianId, payload.balitaId, payload.namaBalita)
    navigate('/kader/meja/2', { state: { ...payload } })
    return
  }
  hadirMutation.mutate(payload)
}
```

### Pattern 4: Meja 2 Offline Bypass (Z-Score Skip)

**What:** When offline, skip Z-Score display and navigate directly to Meja 3
**When to use:** In Meja2Page `doSubmit` when `!isOnline`

```typescript
function doSubmit(konfirmasiBiologis: boolean) {
  if (!isOnline) {
    const tempPemeriksaanId = crypto.randomUUID()
    void enqueueOperation('pemeriksaan', {
      id: crypto.randomUUID(),
      tempPemeriksaanId,
      type: 'create' as const,
      data: {
        balitaId,
        antrianId,
        beratBadan: bbValue,
        tinggiBadan: tbStr !== '' && tbValue > 0 ? tbValue : undefined,
        konfirmasiBiologis,
      },
      timestamp: Date.now(),
    })
    setActivePemeriksaanId(tempPemeriksaanId) // temporary ID in store
    toast({ description: 'Tersimpan lokal, akan sync saat online' })
    navigate('/kader/meja/3', {
      state: { antrianId, balitaId, namaBalita, pemeriksaanId: tempPemeriksaanId },
    })
    return
  }
  // ... existing online flow unchanged
}
```

### Pattern 5: VitePWA BackgroundSync Config

**What:** Add Workbox BackgroundSync plugin to specific Meja endpoint patterns
**When to use:** In `vite.config.ts` workbox.runtimeCaching, BEFORE the catch-all `/^\/api\//`

```typescript
// Source: workbox-build docs — RuntimeCachingEntry.backgroundSync [ASSUMED]
// In vite.config.ts workbox.runtimeCaching array (ORDER MATTERS — specific before catch-all):
{
  urlPattern: /^\/api\/antrian\/[^/]+\/hadir$/,
  handler: 'NetworkOnly' as const,
  options: {
    backgroundSync: {
      name: 'kehadiran_queue',
      options: { maxRetentionTime: 24 * 60 }, // 24h in minutes
    },
  },
},
{
  urlPattern: /^\/api\/antrian\/[^/]+\/tangguhkan$/,
  handler: 'NetworkOnly' as const,
  options: {
    backgroundSync: {
      name: 'kehadiran_queue',
      options: { maxRetentionTime: 24 * 60 },
    },
  },
},
{
  urlPattern: /^\/api\/growth\/pemeriksaan/,
  handler: 'NetworkOnly' as const,
  options: {
    backgroundSync: {
      name: 'pemeriksaan_queue',
      options: { maxRetentionTime: 24 * 60 },
    },
  },
},
{
  urlPattern: /^\/api\/immunization/,
  handler: 'NetworkOnly' as const,
  options: {
    backgroundSync: {
      name: 'meja5_queue',
      options: { maxRetentionTime: 24 * 60 },
    },
  },
},
// Existing catch-all MUST remain last:
{
  urlPattern: /^\/api\//,
  handler: 'NetworkOnly' as const,
  options: { cacheName: 'api-network-only' },
},
```

### Pattern 6: beforeinstallprompt Handler in App.tsx

**What:** Capture install prompt and expose install button state
**When to use:** In App.tsx + pass state down to KaderDashboard header via props or context

```typescript
// In App.tsx (currently 12 lines — simple addition):
import { useState, useEffect } from 'react'
import { OfflineBanner } from '@/components/offline/OfflineBanner'

// Browser-typed install prompt event:
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  return (
    <BrowserRouter>
      <OfflineBanner />
      <AppRouter installHandler={handleInstall} showInstall={deferredPrompt !== null} />
      <Toaster />
    </BrowserRouter>
  )
}
```

### Anti-Patterns to Avoid

- **Global axios interceptor for offline queuing:** Tempting but wrong. An axios request interceptor fires before every API call — GET requests, auth calls, STT/AI calls would all get queued. Only critical Meja mutation write operations should be queued. Use mutation-level interception instead.
- **Disable submit buttons when offline (D-08 violation):** The user decisions explicitly state buttons must remain active; pressing submit offline should queue the operation, not block it.
- **Single catch-all BackgroundSync pattern:** If `/^\/api\//` is matched by one BackgroundSync plugin, ALL API failures (including reads and auth) get queued for retry — this will corrupt state. Use specific endpoint patterns.
- **Import BackgroundSyncPlugin directly in vite.config.ts:** `vite.config.ts` runs in Node.js; `BackgroundSyncPlugin` from `workbox-background-sync` is a browser/SW module. Use the `backgroundSync` shorthand in runtimeCaching options instead; VitePWA injects the plugin in the generated SW.
- **Store pemeriksaanId from server as null when offline:** Meja 3 and 4 need a pemeriksaanId to PATCH. Always generate `crypto.randomUUID()` as tempId when offline and pass it in navigation state so the meja chain can continue.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB schema + typed CRUD | Custom IDB wrapper | `idb` v8 | IDB native API requires nested callbacks, lacks TypeScript generics; `idb` provides promise-based, typed stores — D-01 locked |
| Workbox service worker | Custom SW code | VitePWA `workbox.runtimeCaching` | VitePWA generates optimal Workbox SW at build; custom SW must be manually maintained and injected into build pipeline |
| UUID generation | Custom random ID | `crypto.randomUUID()` | Browser-native, cryptographically secure, zero dependencies |
| Online status detection | Polling `navigator.onLine` | `window 'online'/'offline'` events | Events are push-based (instant) vs. polling overhead; MDN-recommended pattern |

**Key insight:** IndexedDB's native API is one of the most error-prone browser APIs — async callbacks, versioning, transaction scoping all have subtle traps. `idb` eliminates all of them with a clean Promise + TypeScript API.

---

## Common Pitfalls

### Pitfall 1: BackgroundSync Entry Order in vite.config.ts

**What goes wrong:** The catch-all `/^\/api\//` pattern is already in `runtimeCaching`. If new BackgroundSync entries are added AFTER it, they never match — the catch-all consumes all `/api/*` requests first.

**Why it happens:** Workbox evaluates `runtimeCaching` entries in array order; first match wins.

**How to avoid:** Always insert specific BackgroundSync URL patterns BEFORE the existing `/^\/api\//` catch-all entry.

**Warning signs:** BackgroundSync queues never receive entries even when offline requests are made.

---

### Pitfall 2: pemeriksaanId Chain Break When Offline at Meja 2

**What goes wrong:** Meja 2 creates `Pemeriksaan` via POST → receives real UUID from server. Meja 3/4 PATCH that UUID. Offline at Meja 2: no server response → no real UUID → `setActivePemeriksaanId(null)` → Meja 3 falls back to `activePemeriksaanId` from store which is null → PATCH fails.

**Why it happens:** `activePemeriksaanId` in `useKaderMejaStore` is NOT persisted to localStorage (by design — only `isLocked` is persisted). It's expected to be set by Meja 2 after the API call succeeds.

**How to avoid:** When offline at Meja 2: `const tempId = crypto.randomUUID()` → store it via `setActivePemeriksaanId(tempId)` → pass it in navigation state → Meja 3/4 receive it in `location.state.pemeriksaanId` as fallback. During sync, the `pemeriksaan_queue` records carry `tempPemeriksaanId`; sync service resolves POST response → real ID → substitutes in subsequent PATCH records before sending.

**Warning signs:** Meja 3/4 show "pemeriksaan ID tidak tersedia" guard state after navigating from Meja 2 offline.

---

### Pitfall 3: Meja 2 Z-Score Result Blocks Navigation When Offline

**What goes wrong:** `Meja2Page.tsx` renders the Z-Score result card when `pemResult !== null`, and the "Lanjut ke Meja 3" button only appears in the result card. Offline: `pemResult` is never set (no API response) → user is stuck on the input form with no way to proceed.

**Why it happens:** Current flow: submit → API success → `setPemResult(result)` → render result card → user clicks "Lanjut". Offline: API never responds.

**How to avoid:** In `doSubmit`, add the offline branch BEFORE `createPemeriksaan.mutate()`. When offline: enqueue to IDB, set `tempPemeriksaanId`, show toast, and call `navigate('/kader/meja/3', ...)` directly — bypassing the Z-Score display entirely. This is consistent with D-08 ("navigates forward normally").

**Warning signs:** User submits Meja 2 offline, sees toast, but stays on Meja 2 input form indefinitely.

---

### Pitfall 4: BackgroundSync API Not Supported on iOS Safari

**What goes wrong:** `workbox-background-sync` uses the `Background Sync API` (not the `window 'online'` event). iOS Safari 17 does not support the Background Sync API. The SW-registered BackgroundSync queues will never trigger on iOS.

**Why it happens:** Background Sync API is a Chrome/Edge-only feature as of mid-2026.

**How to avoid:** The React-layer `window 'online'` event approach (D-02 primary mechanism) works on all browsers. The Workbox BackgroundSync in `vite.config.ts` is a secondary mechanism for background retry when the app is closed — treat it as enhancement, not requirement. The primary offline contract (D-08) is fulfilled by the React-layer interception alone.

**Warning signs:** Offline queue not syncing on iOS devices — this is expected; 'online' event handles it when the app is open.

---

### Pitfall 5: Stale `navigator.onLine` Value During Flaky Connections

**What goes wrong:** `navigator.onLine === true` but requests still fail (server unreachable, timeout). The offline check passes, mutation fires, axiosi returns a network error — which currently triggers the `onError` toast.

**Why it happens:** `navigator.onLine` only detects if the device has any network connection — not whether the specific API server is reachable.

**How to avoid:** In `onError` callback of each mutation, check if the error is a network error (`axios.isAxiosError(err) && err.code === 'ERR_NETWORK'`). If so, enqueue to IDB and show the "Tersimpan lokal" toast — same as the offline path. This ensures both hard offline (navigator.onLine=false) and soft offline (connected but server unreachable) are handled.

**Warning signs:** In tunnel/low-signal environments, mutations show error toast instead of queueing.

---

### Pitfall 6: IDB Store not Opened Before Sync Triggers

**What goes wrong:** `syncAll()` is called from the 'online' event handler, but `getOfflineDB()` returns a Promise. If the DB upgrade hasn't completed (first-ever app load), sync fires before stores exist.

**Why it happens:** IndexedDB `openDB` with `upgrade` is async; calling methods on stores before `openDB` resolves throws `DOMException: IDBDatabase is closed`.

**How to avoid:** Always `await getOfflineDB()` before any read/write. The singleton pattern (cached Promise) in `offline-db.ts` ensures upgrade only runs once. Initialize the DB eagerly at app startup (e.g., in `main.tsx` or a `useEffect` on mount) so it's ready before any 'online' event.

**Warning signs:** `DOMException: The database is not running a version change transaction` or `IDBDatabase is closed` errors on first offline-to-online transition.

---

## Runtime State Inventory

> This phase does not rename or migrate existing data. Not applicable. Omitted per instructions.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | `npm install idb` | ✓ | (in Docker container) | — |
| `idb` npm package | offline-db.ts | Needs install | 8.0.3 | — (locked by D-01) |
| `vite-plugin-pwa` | vite.config.ts | ✓ | 0.20.5 | — (already installed) |
| IndexedDB browser API | offline-db.ts | ✓ in all target browsers | — | No fallback — not needed; Posyandu uses modern Android/iOS |
| `crypto.randomUUID()` | offline-db.ts, Meja2Page | ✓ | Browser built-in (HTTPS required) | `uuid` npm package as fallback |
| Background Sync API | vite.config.ts BackgroundSync | Partial (Chrome/Edge only; not Safari) | — | `window 'online'` event (primary mechanism) |
| `navigator.onLine` | useOfflineStatus | ✓ | Browser built-in | — |

**Missing dependencies with no fallback:**
- `idb` package — not in `frontend/package.json`; must install before any offline-db.ts code runs

**Missing dependencies with fallback:**
- Background Sync API (iOS Safari) — fallback is the React-layer 'online' event approach which is D-02's primary mechanism anyway

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (backend only) |
| Config file | `backend/vitest.config.ts` |
| Quick run command | `cd backend && npx vitest run --reporter=verbose` |
| Full suite command | `cd backend && npx vitest run` |

**Frontend tests:** No frontend test framework is configured. Phase 6 frontend work (IndexedDB, service worker, navigator.onLine) is inherently environment-specific and must be validated manually in the browser. The PWA-01 acceptance criterion requires a real browser with DevTools to simulate offline mode.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PWA-01 | Offline: input Meja 2 → data in IndexedDB | manual | DevTools → Network tab → Offline → submit BB/TB → Application → IndexedDB | N/A |
| PWA-01 | Online restore: IndexedDB queue syncs to backend | manual | DevTools → Network tab → Online → observe network POST | N/A |
| PWA-01 | Backend accepts sync'd pemeriksaan payload | manual-smoke | `curl -X POST /api/growth/pemeriksaan` with valid JWT | N/A |

### Sampling Rate

- **Per task commit:** TypeScript type check — `cd frontend && npx tsc --noEmit`
- **Per wave merge:** TypeScript clean + manual browser smoke test (offline banner visible, submit queues to IDB, sync fires on reconnect)
- **Phase gate:** Full manual flow — Meja 1 → 5 completed entirely offline → reconnect → all data in PostgreSQL

### Wave 0 Gaps

- No new test files needed for this phase (frontend-only changes; no backend logic changes)
- Backend already has Vitest infrastructure — no new gaps

*(No Wave 0 test file gaps — existing infrastructure sufficient for what can be automated)*

---

## Security Domain

> `security_enforcement: true` in config.json; `security_asvs_level: 1` (ASVS Level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes; JWT cookie still sent with sync requests |
| V3 Session Management | no | Session unchanged; offline queue replays on existing session |
| V4 Access Control | yes | Backend IDOR guards still active during sync (server validates kader owns antrian/pemeriksaan) |
| V5 Input Validation | yes | Queued payloads must match API schema — backend Zod validation still runs on sync |
| V6 Cryptography | partial | `catatanKlinis` stored plaintext in IndexedDB (device-local); encrypted at backend on sync — acceptable per D-13 |

### Known Threat Patterns for PWA Offline Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered IndexedDB payload (attacker modifies IDB records before sync) | Tampering | Backend Zod validation + IDOR checks reject malformed payloads; no additional mitigation needed for ASVS Level 1 |
| `catatanKlinis` plaintext in IDB | Information Disclosure | Acceptable by design (D-13); device lock is the physical security layer; document in code comment per UU PDP awareness |
| Malicious `beforeinstallprompt` prompt hijack | Elevation of Privilege | `e.preventDefault()` prevents browser default; only our handler fires; no elevated permissions granted by PWA install |
| Sync request replay after session expiry | Repudiation | JWT refresh interceptor in `axios.ts` already handles 401 → refresh → retry; if refresh fails, sync item stays in queue until next session |
| Excessive sync retry flooding server (malformed IDB data) | DoS | D-04 last-write-wins + D-06 skip-on-422 prevents infinite retry; Workbox BackgroundSync maxRetentionTime=24h bounds retry window |

**UU PDP Note:** `catatanKlinis` stored in IndexedDB is plaintext on the kader's device. This is a design concession for offline usability (D-13). Backend encryption still applies when synced. Recommend adding a JSDoc comment in `offline-db.ts` noting this storage is unencrypted for audit trail purposes.

---

## Code Examples

### Reading All Queued Items (FIFO by timestamp)

```typescript
// Source: idb v8 official README [ASSUMED — idb v8 API, consistent with npm homepage]
const db = await getOfflineDB()
const items = await db.getAllFromIndex('kehadiran_queue', 'by_timestamp')
// items are sorted ascending by timestamp — FIFO order
```

### Deleting a Synced Item from Queue

```typescript
const db = await getOfflineDB()
await db.delete('kehadiran_queue', item.id)
```

### Writing to sync_errors on 422

```typescript
async function logSyncError(operation: Record<string, unknown>, statusCode: number, error: string) {
  const db = await getOfflineDB()
  await db.add('sync_errors', {
    id: crypto.randomUUID(),
    originalOperation: operation,
    error,
    statusCode,
    timestamp: Date.now(),
  })
}
```

### Counting All Pending Items (for SyncPendingBadge)

```typescript
async function countPending(): Promise<number> {
  const db = await getOfflineDB()
  const [k, p, m] = await Promise.all([
    db.count('kehadiran_queue'),
    db.count('pemeriksaan_queue'),
    db.count('meja5_queue'),
  ])
  return k + p + m
}
```

### OfflineBanner Component Skeleton

```typescript
// File: frontend/src/components/offline/OfflineBanner.tsx
// Visual spec from 06-UI-SPEC.md: fixed top, bg-orange-600, WifiOff icon, "Mode Offline — data tersimpan lokal"
import { WifiOff } from 'lucide-react'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'

export function OfflineBanner() {
  const isOnline = useOfflineStatus()
  if (isOnline) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-600 text-white py-3 px-4 flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4 text-orange-200" />
      <span className="text-xs font-bold">Mode Offline — data tersimpan lokal</span>
    </div>
  )
}
// Note: When banner is visible, parent pages need pt-[40px] to avoid content hidden under banner.
// Apply this in App.tsx wrapper or in each kader layout.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `workbox-window` manual SW registration | VitePWA `registerType: 'autoUpdate'` handles registration | ~2022 | No manual `sw.register()` needed in `main.tsx` |
| `localforage` / `dexie` for offline IDB | `idb` v8 (lighter, typed) | ~2021 | Simpler API, smaller bundle |
| Background Sync API (native) | `window 'online'` + custom queue | Still preferred for universal support | Better iOS Safari compatibility |
| Custom typed IDB v5 `openDB` | Same idb v8 `openDB` with generics | idb v8 (2023) | TypeScript generics over the DB schema is now first-class |

**Deprecated/outdated:**
- `idb` v7 and below: Pre-generics API (`db.transaction(['store'], 'readwrite').objectStore('store')`). idb v8 adds schema generics — all type safety comes from the `SisposOfflineDB` interface above.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `idb` v8 `openDB<Schema>()` generic API shape (keyPath, createIndex, getAllFromIndex) | Code Examples, Architecture Patterns | If idb v8 changed API between training cutoff and now, offline-db.ts type errors at build. Mitigation: `npm install idb@8` then run `tsc --noEmit`. |
| A2 | VitePWA runtimeCaching `backgroundSync` shorthand is supported in workbox-build v7 | Architecture Patterns Pattern 5 | If shorthand was removed or renamed, vite.config.ts needs the explicit plugin import workaround. Mitigation: check workbox-build v7 TypeScript types after install. |
| A3 | `crypto.randomUUID()` is available in the Docker container's Chromium (running over HTTPS via Nginx) | Code Examples | If app is served over HTTP (not HTTPS), `crypto.randomUUID()` is unavailable. Nginx config (Phase 0) serves HTTP on port 80, not HTTPS. Fallback: `Math.random().toString(36).substr(2,9)` or install `uuid` npm package. |
| A4 | `idb` package npm page — slopcheck status OK | Package Legitimacy Audit | slopcheck unavailable at research time; package confirmed via npm registry and official homepage jakearchibald/idb. Risk: near zero (9yr old package by known Google dev). |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

> A3 note: The SISPOS Docker stack serves via Nginx on port 80 (HTTP), not HTTPS. `crypto.randomUUID()` requires a secure context (HTTPS or localhost). In development on localhost, this works. In production Docker, Nginx is HTTP-only — confirm whether `crypto.randomUUID()` is available or add the `uuid` package as a fallback.

---

## Open Questions

1. **`crypto.randomUUID()` in HTTP context**
   - What we know: Nginx in the SISPOS stack exposes port 80 (HTTP), not HTTPS. `crypto.randomUUID()` requires a secure context.
   - What's unclear: Does the Docker setup serve over localhost (where secure context applies)? If deployed externally without HTTPS, `crypto.randomUUID()` fails silently in some browsers.
   - Recommendation: Add `uuid` npm package as fallback, or confirm Nginx termination at HTTPS proxy in deployment.

2. **Sync of `kehadiran_queue` when session expired**
   - What we know: The axios refresh interceptor retries on 401 → refresh → retry. If refresh token is also expired, `clearAuth()` + redirect to login.
   - What's unclear: If a kader goes offline, comes back hours later (session expired), and triggers sync — the sync requests will 401, refresh will fail, user gets redirected mid-sync.
   - Recommendation: Before calling `syncAll()`, check `navigator.onLine === true` AND optionally call `GET /api/auth/me` to verify session is active. If 401, defer sync until next login rather than mid-operation logout redirect.

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view idb`) — confirmed package existence, version 8.0.3, homepage jakearchibald/idb
- `frontend/vite.config.ts` — verified VitePWA 0.20.5 with existing runtimeCaching config
- `frontend/package.json` — verified all installed packages; confirmed `idb` not yet installed
- `frontend/node_modules/vite-plugin-pwa/package.json` — confirmed vite-plugin-pwa 0.20.5, workbox-build ^7.1.0
- npm registry (`npm view workbox-background-sync`) — confirmed v7.4.1, google/workbox homepage
- Codebase grep — confirmed all Meja pages use `apiClient.post/patch` (axios)
- `frontend/src/stores/useKaderMejaStore.ts` — confirmed partialize (only `isLocked` persisted)
- `frontend/src/App.tsx` — confirmed minimal 12-line component, easy extension point
- `.planning/phases/06-pwa-offline/06-UI-SPEC.md` — confirmed component file locations, copy strings, visual specs

### Secondary (MEDIUM confidence)
- npm homepage `github.com/jakearchibald/idb` — cross-verified idb authorship and API shape
- npm registry (`npm view workbox-background-sync`) — confirmed workbox-background-sync is a standalone package

### Tertiary (LOW confidence)
- idb v8 `openDB<Schema>()` typed API details — from training knowledge (verified npm exists, API shape assumed from training)
- VitePWA `backgroundSync` shorthand in runtimeCaching — from training knowledge (workbox-build v7 types not directly inspected)
- `crypto.randomUUID()` secure context requirement — from MDN training knowledge (not live-verified against Docker HTTP setup)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified via npm registry; VitePWA installation confirmed in node_modules
- Architecture: HIGH — based on direct codebase reading of all 5 Meja pages + App.tsx + store + hooks
- idb API details: MEDIUM — npm registry confirms package; API shape from training knowledge tagged [ASSUMED]
- Workbox BackgroundSync shorthand: MEDIUM — package confirmed; shorthand syntax from training knowledge tagged [ASSUMED]
- Pitfalls: HIGH — identified from direct codebase analysis (pemeriksaanId chain, store partialize pattern, runtimeCaching order)

**Research date:** 2026-07-04
**Valid until:** 2026-08-04 (stable libraries; 30-day window)
