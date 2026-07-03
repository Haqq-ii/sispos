---
phase: 04-dashboard-dss-ai-chatbot
plan: "01"
subsystem: dashboard-puskesmas
tags: [leaflet, prisma-migration, dashboard, puskesmas, react-leaflet]
dependency_graph:
  requires:
    - 03-07 (growth + immunization + 5-meja complete — Pemeriksaan data needed)
  provides:
    - GET /api/dashboard/stunting (puskesmas-scoped stunting map data)
    - GET /api/dashboard/stats (puskesmas-scoped aggregate stats)
    - PuskesmasLayout sidebar (wraps all /puskesmas/* routes)
    - PetaStuntingPage (Leaflet map with CircleMarker)
    - PuskesmasDashboardPage (stats-only, no map)
  affects:
    - frontend/src/router/index.tsx (nested puskesmas routes)
    - prisma/schema.prisma (Posyandu lat/lng added)
tech_stack:
  added:
    - react-leaflet@4.2.1 (React 18 compatible; v5 requires React 19)
    - leaflet@1.9.4
    - "@types/leaflet@1.9.21"
  patterns:
    - MapContainer + CircleMarker (no key prop — prevents re-mount)
    - TanStack Query queryKey includes bulan for reactive refetch
    - puskesmasId always from JWT (req.user!.userId) — IDOR guard
key_files:
  created:
    - prisma/migrations/20260703065133_add_posyandu_coordinates/migration.sql
    - backend/src/modules/dashboard/dashboard.service.ts
    - backend/src/modules/dashboard/dashboard.controller.ts
    - backend/src/modules/dashboard/dashboard.routes.ts
    - frontend/src/layouts/PuskesmasLayout.tsx
    - frontend/src/pages/puskesmas/PuskesmasDashboardPage.tsx
    - frontend/src/pages/puskesmas/PetaStuntingPage.tsx
  modified:
    - prisma/schema.prisma (latitude Float? longitude Float? added to Posyandu)
    - backend/src/app.ts (dashboardRouter registered at /api/dashboard)
    - frontend/src/router/index.tsx (flat puskesmas routes → nested under PuskesmasLayout)
    - frontend/package.json (react-leaflet, leaflet, @types/leaflet added)
decisions:
  - "puskesmasId always from req.user!.userId (JWT), never from query params — IDOR T-04-01-01"
  - "react-leaflet@4.2.1 pinned (v5 requires React 19; SISPOS on React 18.3.1)"
  - "MapContainer has no key prop — prevents Map container is already initialized error"
  - "@types/leaflet landed in dependencies (not devDependencies) — acceptable for project"
  - "PetaStuntingPage stub created in Task 2 then overwritten in Task 3 — ensures TS compile in each step"
metrics:
  duration: "~7 min"
  completed: "2026-07-03"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 4
---

# Phase 04 Plan 01: Puskesmas Dashboard + Peta Stunting Summary

**One-liner:** Prisma migration adds lat/lng to Posyandu; dashboard backend exposes two JWT-scoped endpoints; PuskesmasLayout sidebar wraps all /puskesmas/* routes; PetaStuntingPage renders Leaflet OSM map with color-coded CircleMarker per posyandu; PuskesmasDashboardPage shows stats cards + quick actions (no map).

## What Was Built

### Task 1 — Schema migration + Dashboard backend module

**Migration:** Added `latitude Float?` and `longitude Float?` to Posyandu model. Migration `add_posyandu_coordinates` applied successfully to PostgreSQL via `docker compose exec sispos-backend npx prisma migrate dev`.

**dashboard.service.ts:**
- `getStuntingMapData(puskesmasId, bulan)` — queries posyandu with nested jadwal>slotSesi>antrian(selesai)>pemeriksaan, filters nullcoordinate posyandu, builds breakdown Record by statusGizi
- `getDashboardStats(puskesmasId, bulan)` — same nested query, counts distinct wargaId as totalBalita, aggregates breakdown

**dashboard.controller.ts:** WIB default bulan (UTC+7 offset), puskesmasId exclusively from `req.user!.userId`

**dashboard.routes.ts:** `GET /stunting` + `GET /stats` both behind `authMiddleware + requireRole('puskesmas')`

**app.ts:** `dashboardRouter` registered at `/api/dashboard` after `rekapHarianRouter`

Verified: `GET /api/dashboard/stunting` without auth returns 401. Migration status shows "Database schema is up to date!"

### Task 2 — PuskesmasLayout sidebar + Leaflet install + Router nested routes

**npm install:** react-leaflet@4.2.1 + leaflet@1.9.4 + @types/leaflet@1.9.21 added to frontend. No peer dependency warnings (React 18 compatible).

**PuskesmasLayout.tsx:** Responsive sidebar layout. Desktop (md+): fixed left sidebar w-64, white bg, border-r. Mobile (<md): fixed bottom nav bar (6 icon+label columns). 6 NavLink items with active style `bg-green-50 text-[#008236]`. Logout: POST /api/auth/logout → clearAuth → navigate('/login').

**router/index.tsx:** Flat puskesmas routes converted to nested under `<PuskesmasLayout />` element inside `<ProtectedRoute allowedRoles={['puskesmas']}>`. Routes: dashboard, peta, jadwal, pengguna (placeholder), laporan (placeholder), audit-log (placeholder).

TypeScript compiled without errors.

### Task 3 — PuskesmasDashboardPage (stats) + PetaStuntingPage (Leaflet map)

**PuskesmasDashboardPage:**
- 4 stats cards: Total Pemeriksaan, Total Balita, Gizi Normal, Bermasalah (buruk+sangat_pendek+kurang+pendek)
- TanStack Query: `queryKey: ['dashboard','stats',bulan]`, staleTime 5 min
- 4 quick action Links: Peta Stunting, Manajemen Kader, Jadwal, Laporan
- Month filter: `useState(getBulanDefault)` with `input type="month"`
- Loading skeletons while data fetches
- NO map on this page (map is on PetaStuntingPage)

**PetaStuntingPage:**
- `import 'leaflet/dist/leaflet.css'` as first import (critical for tile positioning)
- `MapContainer` center `[-7.7971, 110.3688]` (Yogyakarta), zoom 12, height 450px — no `key` prop
- `TileLayer` with OpenStreetMap tiles
- `CircleMarker` per StuntingMapPoint: radius `Math.max(8, Math.sqrt(total) * 3)`, color from `getMarkerColor`
- `getMarkerColor`: red (buruk/sangat_pendek > 0), yellow (kurang/pendek > 0), green (else)
- `Popup` shows posyandu name, kelurahan, total, breakdown
- Month filter changes `queryKey: ['dashboard','stunting',bulan]` — refetches without page reload
- Empty state shown when no coordinate data exists

Frontend container rebuilt (`docker compose build sispos-frontend`) with new packages.

## Deviations from Plan

None significant. Minor:
- `@types/leaflet` landed in `dependencies` (not `devDependencies`) — npm placed it there since `leaflet` itself is in `dependencies`. Functionally identical; no refactor needed.
- Task 2 created stub PuskesmasDashboardPage + PetaStuntingPage (to satisfy TS imports in router) before overwriting with full implementations in Task 3. This is documented in plan's done criteria as acceptable.

## Known Stubs

- `/puskesmas/pengguna` → placeholder "Halaman sedang dikembangkan." (implemented in Plan 04-02)
- `/puskesmas/laporan` → placeholder (implemented in future plan)
- `/puskesmas/audit-log` → placeholder (implemented in Plan 04-02)
- Posyandu lat/lng are NULL for existing seeded data — PetaStuntingPage will show empty state until seed data adds coordinates (Phase 7)

## Threat Flags

None. All new endpoints follow existing patterns:
- IDOR guard via `req.user!.userId` from JWT (T-04-01-01, T-04-01-03 mitigated)
- authMiddleware + requireRole('puskesmas') on all dashboard routes (T-04-01-02 mitigated)

## Self-Check: PASSED

All 7 created files exist on disk. All 3 task commits verified in git log:
- ba5fcca: feat(04-01): schema migration + dashboard backend module
- 71f54cb: feat(04-01): PuskesmasLayout sidebar + Leaflet install + router nested routes
- afd6c45: feat(04-01): PuskesmasDashboardPage stats + PetaStuntingPage Leaflet map
