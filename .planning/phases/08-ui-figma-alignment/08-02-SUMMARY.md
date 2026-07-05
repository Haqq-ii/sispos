---
phase: 08-ui-figma-alignment
plan: "02"
subsystem: citizen-ui
tags: [growth-chart, zscore, figma-alignment, citizen-screens, backend-endpoint]
dependency_graph:
  requires: [08-01]
  provides: [citizen-growth-chart, citizen-screens-aligned, growth-riwayat-full-zscore]
  affects: [08-03, 08-04, 08-05]
tech_stack:
  added: []
  patterns: [tanstack-query, recharts-linechart, tailwind-design-tokens]
key_files:
  created: []
  modified:
    - backend/src/modules/growth/growth.service.ts
    - backend/src/modules/growth/growth.controller.ts
    - backend/src/modules/growth/growth.routes.ts
    - frontend/src/pages/citizen/TumbuhKembangPage.tsx
    - frontend/src/pages/auth/LoginPage.tsx
    - frontend/src/components/auth/LoginForm.tsx
    - frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx
decisions:
  - "getCitizenGrowthRiwayat uses findFirst(balita, orderBy.createdAt.asc) for IDOR safety — first balita of the warga, not client-supplied id"
  - "Old getRiwayatCitizenHandler kept in place (backward compat), route now uses getCitizenRiwayatHandler"
  - "LoginForm.tsx modified (not in original files list) as deviation to satisfy acceptance criteria for bg-[#008236] button"
  - "tailwind primary DEFAULT is #16a34a not #008236 — explicit hex required everywhere"
  - "Figma MCP not available in executor context; alignment done via design tokens from RESEARCH.md section 1.4"
  - "ChatAssistantPage.tsx already aligned; CitizenDashboardPage.tsx already aligned — no changes needed"
metrics:
  duration: "~6 min"
  completed_date: "2026-07-05"
requirements: [UI-01, UI-03]
---

# Phase 08 Plan 02: Citizen UI + Z-Score Chart Summary

**One-liner:** ZScoreChart live in TumbuhKembangPage grafik tab via full 3-field GET /api/growth/riwayat; citizen screens aligned to #008236 design tokens.

## Task Results

| Task | Name | Status | Commit | Notes |
|------|------|--------|--------|-------|
| 1 | Backend GET /api/growth/riwayat | DONE | e3c5899 | getCitizenGrowthRiwayat + getCitizenRiwayatHandler |
| 2 | TumbuhKembangPage grafik + imunisasi tabs | DONE | 8f1ffb3 | ZScoreChart wired, imunisasi informative message |
| 3 | Citizen screens Figma alignment | DONE | d163c96 | LoginPage, LoginForm, TiketAntrianPage aligned |

---

## Task 1: Backend GET /api/growth/riwayat

### getCitizenGrowthRiwayat (growth.service.ts)

New function added at line 331 that:
1. Finds first balita by wargaId (IDOR-safe: wargaId from JWT, not client-supplied)
2. Returns empty array if no balita found
3. Queries `pemeriksaan.findMany` with full Z-Score shape: `zScoreBbU`, `zScoreTbU`, `zScoreBbTb`
4. Maps `statusGiziOverride ?? statusGizi` for display

### getCitizenRiwayatHandler (growth.controller.ts)

New handler added that uses `getCitizenGrowthRiwayat(userId)` where `userId = req.user!.userId`.

### Route update (growth.routes.ts)

`GET /riwayat` now imports and uses `getCitizenRiwayatHandler` (replaces `getRiwayatCitizenHandler`). Old handler kept for backward compatibility.

**Verification:**
- `GET /api/growth/riwayat` without JWT → 401 (authMiddleware enforces auth)
- TypeScript compile: clean (0 errors)

---

## Task 2: TumbuhKembangPage grafik + imunisasi tabs

### Changes made (TumbuhKembangPage.tsx)

1. **Import added:** `ZScoreChart` and `ZScoreDataPoint` from `@/components/kader/ZScoreChart`
2. **RiwayatRecord extended:** added `tanggalPemeriksaan?`, `zScoreBbU?`, `zScoreTbU?`, `zScoreBbTb?` fields
3. **grafikData derivation:** maps riwayat → ZScoreDataPoint[] using `toLocaleDateString('id-ID', {year:'2-digit'})` format
4. **Grafik tab:** replaced "Fitur akan segera tersedia" with:
   - Skeleton during loading
   - Empty-state card if no data
   - `<ZScoreChart data={grafikData} />` inside white card with title "Tren Z-Score"
5. **Imunisasi tab:** replaced placeholder with informative message about Meja 5

**Verification:**
- No "Fitur akan segera tersedia" in grafik tab (grep: clean)
- `<ZScoreChart` present in JSX
- TypeScript compile: clean

---

## Task 3: Citizen screens Figma visual alignment

### Root cause

`tailwind.config.js` sets `primary.DEFAULT = "#16a34a"` (not `#008236`). All `text-primary`, `bg-primary`, `bg-green-50` references needed explicit hex values.

### Files changed

**LoginPage.tsx:**
- Root div: `bg-white` → `bg-[#f9fafb]`
- Logo container: `bg-green-50` → `bg-[#f0fdf4]`
- ShieldCheck + h1: `text-primary` → `text-[#008236]`
- Form card: `bg-green-50 rounded-lg` → `bg-white rounded-2xl border border-[#f3f4f6]`
- Register link: `text-primary` → `text-[#008236]`

**LoginForm.tsx (deviation):**
- Button: added `bg-[#008236] hover:bg-[#00a63e] text-white rounded-[14px]` explicit classes

**TiketAntrianPage.tsx:**
- Root: `bg-white` → `bg-[#f9fafb]`
- Sticky header: `border-b` → `border-b border-[#f3f4f6]`, `text-primary` → `text-[#008236]`
- Nomor antrian area: `bg-green-50 rounded-xl` → `bg-[#f0fdf4] rounded-2xl`

**CitizenDashboardPage.tsx:** no changes — already uses correct design tokens throughout.

**ChatAssistantPage.tsx:** no changes — root already `bg-[#f9fafb]`, header `bg-[#008236]`.

**Verification:**
- `npm run lint` (tsc --noEmit): exit 0
- CountdownEstimasi and useAntrianSocket preserved in TiketAntrianPage

---

## Deviations from Plan

### [Rule 2 - Missing] LoginForm.tsx button color explicit override

- **Found during:** Task 3 analysis of tailwind.config.js
- **Issue:** `tailwind.config.js` defines `primary.DEFAULT = "#16a34a"`, not `#008236`. The Button in LoginForm.tsx used `className="w-full min-h-[44px]"` with default shadcn/ui variant `bg-primary`, rendering the wrong brand green.
- **Fix:** Added explicit `bg-[#008236] hover:bg-[#00a63e] text-white rounded-[14px]` to Button className in LoginForm.tsx
- **Files modified:** `frontend/src/components/auth/LoginForm.tsx`
- **Commit:** d163c96

### Figma MCP not available in executor context

- **Observation:** Figma MCP tools (`mcp__figma__get_design_context`, etc.) are not exposed in the executor's tool list (upstream bug anthropics/claude-code#13898)
- **Mitigation:** Alignment performed using established design tokens from RESEARCH.md section 1.4 + direct analysis of tailwind.config.js; acceptance criteria all verified via grep + tsc --noEmit
- **Impact:** None — design tokens in RESEARCH.md were derived from prior Figma analysis and are correct

---

## Known Stubs

None — ZScoreChart is wired to real data from GET /api/growth/riwayat, and all "Fitur akan segera tersedia" placeholders in this plan's scope have been replaced.

## Threat Flags

No new threat surface introduced. GET /api/growth/riwayat is IDOR-safe (wargaId from JWT, not client-supplied). UU PDP encrypted fields (catatanKonsultasi, rekomendasiAi) are excluded from the select.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| Commit e3c5899 (Task 1) | FOUND |
| Commit 8f1ffb3 (Task 2) | FOUND |
| Commit d163c96 (Task 3) | FOUND |
| growth.service.ts contains getCitizenGrowthRiwayat | FOUND (line 331) |
| growth.routes.ts contains requireRole('citizen') on /riwayat | FOUND (line 18) |
| TumbuhKembangPage.tsx imports ZScoreChart | FOUND (line 18) |
| TumbuhKembangPage.tsx renders `<ZScoreChart` | FOUND (line 253) |
| TumbuhKembangPage.tsx no "Fitur akan segera tersedia" in grafik tab | CLEAN |
| LoginForm.tsx Button has bg-[#008236] | FOUND (line 118) |
| LoginPage.tsx root has bg-[#f9fafb] | FOUND (line 129) |
| TiketAntrianPage.tsx has CountdownEstimasi | FOUND (line 21) |
| TiketAntrianPage.tsx has useAntrianSocket | FOUND (line 24) |
| Backend tsc --noEmit | EXIT 0 |
| Frontend npm run lint (tsc --noEmit) | EXIT 0 |
| GET /api/growth/riwayat without JWT | 401 |
