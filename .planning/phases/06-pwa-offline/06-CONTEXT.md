# Phase 6: PWA & Offline - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Tambahkan kemampuan offline-first ke alur Kader 5 Meja: semua input Meja 1-5 tersimpan di IndexedDB lokal saat internet mati, lalu auto-sync ke PostgreSQL saat online kembali. Service Worker Workbox sudah terpasang — phase ini mengaktifkan sync queue dan IndexedDB schema. Tidak ada screen baru; semua perubahan pada screen yang sudah ada.

</domain>

<decisions>
## Implementation Decisions

### IndexedDB Library & Sync Mechanism
- **D-01:** Gunakan library `idb` (wrapper tipis atas native IDB API) — sudah tersedia via npm, TypeScript-friendly, tidak butuh install berat
- **D-02:** Sync queue triggered oleh `window 'online'` event + Workbox BackgroundSync plugin untuk retry HTTP request yang gagal
- **D-03:** IndexedDB stores: `pemeriksaan_queue`, `kehadiran_queue`, `meja5_queue` — masing-masing per operasi kritis

### Sync Conflict Resolution
- **D-04:** Last-write-wins saat sync — jika server return conflict atau 422, log error dan skip record tersebut (jangan gagalkan seluruh batch)
- **D-05:** Ini adalah proyek single-posyandu (satu Puskesmas), multi-device collision sangat jarang → simplicity > complexity untuk konteks akademik
- **D-06:** Sync error disimpan di IndexedDB store `sync_errors` — kader bisa lihat di rekap harian jika ada

### Offline UI Indicators
- **D-07:** Tampilkan banner merah/oranye di atas halaman saat `navigator.onLine === false`: "Mode Offline — data tersimpan lokal"
- **D-08:** Tombol submit di Meja 1-5 tetap aktif saat offline (tidak di-disable) — submit ke IndexedDB, tampilkan toast "Tersimpan lokal, akan sync saat online"
- **D-09:** Badge counter "N pending" di header kader saat ada antrian sync belum terkirim
- **D-10:** Saat sync selesai, tampilkan toast "Data berhasil disinkronkan"

### Meja 4 Offline Fallback (AI & STT)
- **D-11:** Saat offline, tombol "Rekam Suara" (Google STT) di-disable dengan tooltip "Tidak tersedia offline"
- **D-12:** Saat offline, tombol "Analisis AI" (OpenAI early warning) di-disable dengan tooltip "Tidak tersedia offline"
- **D-13:** Form textarea `catatanKlinis` tetap aktif saat offline — kader bisa input catatan manual, tersimpan ke IndexedDB
- **D-14:** Form data Meja 4 yang tersimpan offline (tanpa AI/STT) di-sync ke backend saat online; field `rekomendasiAi` dan `catatanSTT` dikosongkan/null

### PWA Install Prompt
- **D-15:** `manifest.json` sudah valid — PWA installable sudah terpenuhi dari Phase 0
- **D-16:** Tambahkan `beforeinstallprompt` handler sederhana di `App.tsx` untuk menyimpan event dan show install button di header (hanya muncul kalau belum di-install)
- **D-17:** Tidak perlu custom install page — cukup button kecil di navbar atau toast

### Claude's Discretion
- Implementasi detail IndexedDB schema (field names, indexes) — sesuaikan dengan struktur API request yang ada
- Timing retry: Workbox BackgroundSync default (24 jam window) sudah cukup untuk konteks Posyandu harian
- Order sync queue: FIFO (first-in first-out) per meja — tidak ada dependency antar meja yang perlu dikelola

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing PWA Setup
- `frontend/vite.config.ts` — VitePWA config sudah aktif: `registerType: 'autoUpdate'`, globPatterns caching, NetworkOnly untuk `/api/*`
- `frontend/public/manifest.json` — PWA manifest valid, `display: standalone`, icons set

### Kader Meja Pages (target offline integration)
- `frontend/src/pages/kader/meja/Meja1Page.tsx` — Checkin kehadiran (POST endpoint)
- `frontend/src/pages/kader/meja/Meja2Page.tsx` — BB/TB input (usePemeriksaan mutation)
- `frontend/src/pages/kader/meja/Meja3Page.tsx` — Tanda klinis patch (usePatchPemeriksaan)
- `frontend/src/pages/kader/meja/Meja4Page.tsx` — AI early warning + STT (disable offline)
- `frontend/src/pages/kader/meja/Meja5Page.tsx` — Selesai endpoint (POST)

### Key Hooks (mutation patterns to intercept offline)
- `frontend/src/hooks/usePemeriksaan.ts` — useCreatePemeriksaan + usePatchPemeriksaan (axios mutations)
- `frontend/src/stores/useKaderMejaStore.ts` — Kader meja state (Redux-like store)

### Phase Requirement
- `.planning/PROJECT.md` §Requirements — [PWA-01]: Offline-First via Workbox Service Worker, IndexedDB untuk input Meja 1-5, auto-sync saat online

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VitePWA` plugin (vite.config.ts): sudah terkonfigurasi, tinggal tambah `workbox.backgroundSync` plugin dan extend `runtimeCaching`
- `useKaderMejaStore` (Zustand): bisa extend untuk menyimpan `offlineQueue` state
- `useKaderSocket` hook: perlu guard jika offline (Socket.IO disconnect graceful)

### Established Patterns
- Semua mutations menggunakan `apiClient.post/patch` dari axios — intercept/wrap pattern bisa diterapkan konsisten
- Toast notification sudah dipakai di berbagai halaman (`use-toast.ts`) — reuse untuk offline feedback
- TanStack Query sudah di-setup dengan `queryClient` — error handling sudah ada

### Integration Points
- `App.tsx`: tambahkan `beforeinstallprompt` event listener + offline banner global
- `frontend/src/lib/axios.ts`: potential place untuk offline interceptor
- `vite.config.ts` `workbox.plugins`: tambah `BackgroundSyncPlugin` per store

</code_context>

<specifics>
## Specific Ideas

- Offline banner global di atas semua halaman Kader (tidak hanya Meja pages)
- Install button di navbar (tampil hanya jika `beforeinstallprompt` event tersedia)
- IndexedDB store per meja: granular, mudah di-debug per tipe operasi

</specifics>

<deferred>
## Deferred Ideas

- Push notification (Web Push API) — sudah di-out-of-scope di PROJECT.md; WA notif via BullMQ sudah cukup
- Background periodic sync API — terlalu kompleks untuk konteks akademik; `window 'online'` event cukup
- Conflict UI (tampilkan ke kader mana record yang conflict) — overkill untuk single-posyandu akademik

</deferred>

---

*Phase: 6-pwa-offline*
*Context gathered: 2026-07-04 (auto-generated — user away from keyboard, best-judgment defaults applied)*
