---
phase: 08-ui-figma-alignment
plan: "04"
subsystem: puskesmas-ui
tags: [figma-alignment, puskesmas, mobile-first, design-tokens]
dependency_graph:
  requires: [08-03]
  provides: [puskesmas-screens-aligned]
  affects: [08-05]
tech_stack:
  added: []
  patterns: [figma-mcp, design-tokens, mobile-first]
key_files:
  created: []
  modified:
    - frontend/src/pages/puskesmas/PetaStuntingPage.tsx
    - frontend/src/pages/puskesmas/PuskesmasDashboardPage.tsx
    - frontend/src/pages/puskesmas/ManajemenPenggunaPage.tsx
decisions:
  - "MapContainer has NO key prop per decisions log 2026-07-03 — prevents Map container is already initialized error"
  - "PuskesmasDashboard stats moved out of header into body section for cleaner mobile layout"
  - "ManajemenPengguna replaced max-w-2xl desktop wrapper with full-width mobile-first layout"
metrics:
  duration: "~15 min (partial agent + inline completion)"
  completed_date: "2026-07-05"
requirements: [UI-02]
---

# Phase 08 Plan 04: Puskesmas Screens Figma Alignment Summary

**One-liner:** PetaStunting mobile-first with green header; PuskesmasDashboard stats grid aligned; ManajemenPengguna green header + design tokens applied.

## Task Results

| Task | Name | Status | Commit | Notes |
|------|------|--------|--------|-------|
| 1 | PetaStuntingPage mobile-first + green header | DONE | 6b672bc | Removed max-w-5xl wrapper; no key on MapContainer |
| 2 | PuskesmasDashboard + ManajemenPengguna alignment | DONE | b0f76a6, 44c09c9 | Stats outside header; ManajemenPengguna green header |

---

## Task 1: PetaStuntingPage

- Removed `p-6 max-w-5xl mx-auto` desktop wrapper → full-width mobile-first
- Added `bg-[#008236]` green header with subtitle "Peta Stunting", title, caption showing bulan filter
- MapContainer has NO key prop (decisions log 2026-07-03 — prevents reinitialization error)
- Root `bg-[#f9fafb]`
- `usePuskesmasStunting(bulan)` hook and CircleMarker logic unchanged

---

## Task 2: PuskesmasDashboard + ManajemenPengguna

### PuskesmasDashboardPage

- Stats 2×2 grid moved from inside header to body section with `px-4 mt-4`
- Stats cards: `rounded-2xl border border-[#f3f4f6] shadow-sm`
- Month input: styled inline in header with semi-transparent background
- Quick action links: `rounded-2xl border border-[#f3f4f6] shadow-sm hover:border-[#b9f8cf]`

### ManajemenPenggunaPage

- White `border-b border-gray-200` header replaced with `bg-[#008236]` green header
- Removed `max-w-2xl mx-auto` desktop wrapper
- All cards: `rounded-2xl border border-[#f3f4f6] shadow-sm`
- Text colors: `text-gray-900` → `text-[#1e2939]`, `text-gray-500` → `text-[#99a1af]`
- Empty state and error state updated to design tokens
- unlockMutation, Badge statuses, and locked state logic unchanged

---

## Deferred Items

None — all puskesmas screens aligned.

## Threat Flags

None — only className/JSX changes; no business logic modified.

## Self-Check: PASSED

- PetaStuntingPage: `bg-[#008236]` present, no `max-w-5xl`, no `key` on MapContainer ✓
- PuskesmasDashboardPage: `bg-[#f9fafb]` root, `rounded-2xl border border-[#f3f4f6]` stats cards ✓
- ManajemenPenggunaPage: `bg-[#008236]` header, `rounded-2xl` cards ✓
- TypeScript: `npm run lint` exits 0 ✓
- Commits: 3 commits present (6b672bc, b0f76a6, 44c09c9) ✓
