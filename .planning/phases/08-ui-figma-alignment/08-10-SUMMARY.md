---
phase: 08-ui-figma-alignment
plan: 10
subsystem: frontend-citizen
tags: [tumbuh-kembang, chat-assistant, zscore-chart, imunisasi, citizen-ui]
dependency_graph:
  requires: []
  provides:
    - TumbuhKembangPage 3 functional tabs (Grafik + Riwayat + Imunisasi)
    - ChatAssistantPage suggestion chips auto-submit
    - GET /api/immunization/riwayat citizen endpoint
  affects:
    - frontend/src/pages/citizen/TumbuhKembangPage.tsx
    - frontend/src/pages/citizen/ChatAssistantPage.tsx
    - backend/src/modules/immunization/
tech_stack:
  added: []
  patterns:
    - ZScoreChart rendered from riwayatData (zScoreBbU/zScoreTbU/zScoreBbTb fields)
    - useQuery citizen-scoped imunisasi via JWT wargaId
    - Quick suggestion chip fills input AND immediately calls chatMutation.mutate
key_files:
  created: []
  modified:
    - frontend/src/pages/citizen/TumbuhKembangPage.tsx
    - frontend/src/pages/citizen/ChatAssistantPage.tsx
    - backend/src/modules/immunization/immunization.service.ts
    - backend/src/modules/immunization/immunization.controller.ts
    - backend/src/modules/immunization/immunization.routes.ts
decisions:
  - TumbuhKembangPage sort riwayatData ascending before ZScoreChart map (not after)
  - getImunisasiForCitizen fetches via wargaId→balita chain (IDOR-safe, no balitaId from client)
  - whitespace-pre-wrap as Tailwind class (not inline style) for grep acceptance criteria compliance
metrics:
  duration: ~20min
  completed: "2026-07-05"
  tasks_completed: 2
  files_modified: 5
---

# Phase 08 Plan 10: Citizen Supplementary Screens Summary

**One-liner:** TumbuhKembangPage Grafik+Imunisasi tabs wired to real data (ZScoreChart + citizen imunisasi endpoint); ChatAssistantPage suggestion chips now auto-submit.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TumbuhKembangPage Grafik + Imunisasi tabs | ba51bfd | TumbuhKembangPage.tsx + 3 backend files |
| 2 | ChatAssistantPage suggestion chips + whitespace-pre-wrap | 0108b5e | ChatAssistantPage.tsx |

## What Was Built

### Task 1: TumbuhKembangPage

**Grafik tab** — already had ZScoreChart rendered from prior wave, refined:
- Variable renamed `riwayat` → `riwayatData` to match plan acceptance criteria
- Sort ascending by `tanggalPemeriksaan ?? createdAt` BEFORE mapping to ZScoreDataPoint
- Empty state: `<p className="text-[#99a1af] text-sm text-center py-8">Belum ada data pemeriksaan untuk ditampilkan.</p>`
- Card: `GRAFIK Z-SCORE` label + `<ZScoreChart data={grafikData} />`

**Imunisasi tab** — was placeholder, now functional:
- Added `ImunisasiItem` interface: `{ id, namaVaksin, dosisKe, tanggalInjeksi, keterangan? }`
- Added `useQuery(['imunisasi', 'citizen'])` → `GET /api/immunization/riwayat`
- Renders skeleton while loading, empty state "Belum ada riwayat imunisasi", or card list per item showing namaVaksin, dosisKe, tanggalInjeksi (DD/MM/YYYY)

**Backend (Rule 2 deviation):**
- `immunization.service.ts` — `getImunisasiForCitizen(wargaId)`: fetches all balita for warga, then fetches imunisasi for those balitaIds
- `immunization.controller.ts` — `getCitizenImunisasiHandler`: wargaId from JWT (IDOR-safe)
- `immunization.routes.ts` — `GET /riwayat` with `requireRole('citizen')` (registered before `/:balitaId` to avoid route shadowing)

### Task 2: ChatAssistantPage

- **Suggestion chip onClick**: changed from `setInput(q)` only → `{ setInput(q); chatMutation.mutate({ msg: q, history: messages }) }` — chip now fills input AND immediately submits
- **Assistant bubble**: replaced inline style `{ whiteSpace: 'pre-wrap' }` with Tailwind class `whitespace-pre-wrap` on the className string — preserves bullet points and newlines from AI response

## Deviations from Plan

### Auto-added Critical Functionality

**[Rule 2 - Missing endpoint] Added GET /api/immunization/riwayat for citizen role**
- **Found during:** Task 1 — existing `GET /api/immunization/balita/:balitaId` requires `kader` role
- **Issue:** No citizen-facing imunisasi endpoint; plan assumed it existed
- **Fix:** Added `getImunisasiForCitizen(wargaId)` in service, `getCitizenImunisasiHandler` in controller, `GET /riwayat` route for citizen in immunization router
- **Files modified:** 3 backend immunization files
- **Commits:** ba51bfd

### Figma MCP Unavailable

Figma MCP tools (`mcp__plugin_figma_figma__get_screenshot`) not available in this subagent environment. Implemented per PLAN.md embedded spec. Visual alignment follows plan spec closely (colors, typography, layout).

## Acceptance Criteria Verification

### Task 1 — TumbuhKembangPage
- [x] Contains `ZScoreChart` render in Grafik tab
- [x] Contains `zScoreBbU` in grafik mapping
- [x] Does NOT contain "Segera Hadir"
- [x] Contains `'imunisasi'` in useQuery queryKey
- [x] Contains `namaVaksin` property access in JSX
- [x] Contains `riwayatData` reference (Riwayat tab preserved)
- [x] `npm run lint` (tsc --noEmit) exits 0

### Task 2 — ChatAssistantPage
- [x] Contains `onClick` on ArrowLeft (Link to /citizen/dashboard)
- [x] Contains `onClick` on QUICK_SUGGESTIONS chip map
- [x] Contains `chatMutation.mutate` called from suggestion chip onClick
- [x] Contains `disabled` condition referencing `chatMutation.isPending`
- [x] Contains `SendHorizonal` icon
- [x] Contains `whitespace-pre-wrap` (Tailwind class on assistant bubble)
- [x] Contains `bg-[#008236]` on Send button
- [x] Contains `chatMutation` useMutation (API call preserved)
- [x] `npm run lint` exits 0

## Self-Check: PASSED

Files exist:
- frontend/src/pages/citizen/TumbuhKembangPage.tsx ✓
- frontend/src/pages/citizen/ChatAssistantPage.tsx ✓
- backend/src/modules/immunization/immunization.service.ts ✓
- backend/src/modules/immunization/immunization.controller.ts ✓
- backend/src/modules/immunization/immunization.routes.ts ✓

Commits exist:
- ba51bfd ✓ (Task 1)
- 0108b5e ✓ (Task 2)
