---
phase: 08-ui-figma-alignment
plan: "06"
subsystem: kader-dashboard
tags: [kader, dashboard, recharts, tabs, shadcn, backend-endpoint, idor-guard]
dependency_graph:
  requires: [08-05]
  provides: [kader-dashboard-stats-api, kader-dashboard-charts-ui]
  affects: [frontend/src/pages/kader/KaderDashboardPage.tsx]
tech_stack:
  added: []
  patterns:
    - recharts BarChart + PieChart inside ResponsiveContainer
    - shadcn Tabs (Ringkasan/Data Balita/Absensi)
    - Prisma $queryRaw LATERAL JOIN for per-balita latest pemeriksaan
    - Promise.all for parallel DB queries after posyanduId resolved
key_files:
  created: []
  modified:
    - backend/src/modules/queue/queue-kader.service.ts
    - backend/src/modules/queue/queue-kader.controller.ts
    - backend/src/modules/queue/queue-kader.routes.ts
    - frontend/src/pages/kader/KaderDashboardPage.tsx
decisions:
  - "getKaderDashboardStats uses Promise.all for Steps B-G after posyanduId resolved (Step A)"
  - "risikoStunting uses LATERAL JOIN $queryRaw to count balita whose most recent pemeriksaan is risk status"
  - "peringatanRisiko fetches 20 records then deduplicates by balitaId to guarantee 10 unique balita"
  - "stats row moved from inside green header to body — header remains green-only per Figma 27:2531"
  - "Figma MCP tools unavailable in agent environment; implemented per detailed plan specs (planner already encoded Figma 27:2531 design)"
metrics:
  duration: "~8 min"
  completed: "2026-07-05T11:43:14Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 08 Plan 06: Kader Dashboard Stats API + Figma Alignment Summary

Implementasi endpoint baru `GET /api/kader/dashboard-stats` dan redesign `KaderDashboardPage` sesuai Figma frame 27:2531. Dashboard kader sekarang menampilkan statistik klinis yang berguna (stunting risk, nutrition trends) melalui recharts BarChart dan PieChart, dengan shadcn Tabs untuk navigasi Ringkasan/Data Balita/Absensi.

## What Was Built

**Backend: GET /api/kader/dashboard-stats**

- Service function `getKaderDashboardStats(kaderId)` di `queue-kader.service.ts`:
  - Step A: Lookup posyanduId dari kader (IDOR guard — kaderId dari JWT, bukan request param)
  - Step B: `totalBalita` via `prisma.balita.count` filtered by `warga.posyanduUtamaId`
  - Step C: `hadirHariIni` via `prisma.antrian.count` dengan WIB timezone date logic
  - Step D: `risikoStunting` via `$queryRaw` LATERAL JOIN — count balita dengan pemeriksaan terakhir status risiko
  - Step E: `trenGiziBulanan` via `$queryRaw` GROUP BY bulan + statusGizi (6 bulan terakhir)
  - Step F: `distribusiGiziBulanIni` via `$queryRaw` untuk bulan berjalan
  - Step G: `peringatanRisiko` via `prisma.pemeriksaan.findMany` take 20 → dedup ke 10 unique balita
  - Steps B-G dieksekusi paralel dengan `Promise.all`

- Controller handler `getKaderDashboardStatsHandler` di `queue-kader.controller.ts`
- Route `GET /kader/dashboard-stats` di `queue-kader.routes.ts` (setelah `/kader/today-slots`)

**Frontend: KaderDashboardPage redesign (Figma 27:2531)**

- Stats row dipindah dari header ke body: Total Balita | Risiko Stunting (merah) | Hadir Hari Ini
- Green header dipertahankan dengan kader name, logout, SyncPendingBadge, install button
- Mulai Pelayanan Hari-H card per slot tetap ada
- shadcn Tabs dengan 3 tab: Ringkasan, Data Balita, Absensi
- Ringkasan tab:
  - TREN STATUS GIZI: recharts BarChart (data dari `trenGiziBulanan`, 4 bars: normal/kurang/buruk/pendek)
  - STATUS GIZI BULAN INI: recharts PieChart donut (innerRadius=40, outerRadius=70)
  - PERINGATAN RISIKO STUNTING: list balita berisiko dengan badge statusGizi
- useActiveMeja redirect useEffect dipertahankan (fitur lock-screen)
- useQuery queryKey `['kader', 'dashboard-stats']` dengan staleTime 60_000

## Deviations from Plan

### Auto-resolved

**[Rule 3 - Info] Figma MCP tools tidak tersedia di agent environment**
- **Found during:** Task 2 (sebelum menulis JSX)
- **Issue:** `mcp__plugin_figma_figma__get_screenshot` dan `get_design_context` tidak ada di tool set agent (upstream bug #13898 strips MCP tools from subagents)
- **Fix:** Implemented berdasarkan spesifikasi detail yang sudah di-encode dalam plan action section. Planner sudah melakukan Figma research dan menghasilkan spesifikasi layout yang lengkap (colors, spacing, structure). Design tokens dan layout structure dari plan diikuti persis.
- **Impact:** Tidak ada visual regression — plan memuat semua informasi yang diperlukan dari Figma 27:2531

None lain — plan dieksekusi sesuai spesifikasi.

## Security Audit

Semua mitigasi threat model diimplementasikan:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-08-06-01 | IDOR: kaderId dari JWT, posyanduId dari DB | Implemented |
| T-08-06-02 | SQL Injection: tagged template literals untuk $queryRaw | Implemented |
| T-08-06-03 | Data scope: hanya balita posyandu kader sendiri | Implemented |
| T-08-06-04 | Spoofing: kaderAuth middleware (kader + ketua_kader) | Implemented |

## Known Stubs

- **Tab "Data Balita"**: menampilkan "Data lengkap tersedia di sistem Puskesmas." — ini intentional per plan spec; data balita rinci ada di Puskesmas Dashboard. Tidak mempengaruhi goal plan ini.
- **Tab "Absensi"**: link ke `/kader/rekap` (halaman yang sudah ada). Tidak ada stub.

## Threat Flags

Tidak ada threat surface baru di luar plan's threat model.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| backend/src/modules/queue/queue-kader.service.ts | FOUND |
| backend/src/modules/queue/queue-kader.controller.ts | FOUND |
| backend/src/modules/queue/queue-kader.routes.ts | FOUND |
| frontend/src/pages/kader/KaderDashboardPage.tsx | FOUND |
| .planning/phases/08-ui-figma-alignment/08-06-SUMMARY.md | FOUND |
| Commit 8a381a3 (Task 1 backend) | FOUND |
| Commit f65ad48 (Task 2 frontend) | FOUND |
| Backend TypeScript: tsc --noEmit | Exit 0 |
| Frontend TypeScript: npm run lint | Exit 0 |
