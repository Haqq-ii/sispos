---
phase: 08-ui-figma-alignment
plan: 15
subsystem: frontend
tags: [landing-page, mobile-first, figma-alignment, ui]
dependency_graph:
  requires: [08-05]
  provides: [landing-page-mobile-first]
  affects: [LandingPage, /login route, /register route]
tech_stack:
  added: []
  patterns: [mobile-first PWA layout, max-w-sm container, flex-col single-column]
key_files:
  created: []
  modified:
    - frontend/src/pages/LandingPage.tsx
decisions:
  - "LandingPage converted from desktop-first (max-w-6xl + md:grid-cols) to mobile-first (max-w-sm + flex-col)"
  - "Puskesmas Login check: Figma 5:13077 is same LoginPage as citizen/kader (aligned 08-05) — no code change needed"
  - "ArrowRight import removed (unused in mobile layout)"
  - "Hero section: bg-[#008236] centered, SISPOS h1 text-2xl, tagline text-[#7bf1a8]"
  - "Masuk CTA uses bg-[#008236] (primary green) — important for acceptance criteria"
metrics:
  duration: "~8 min"
  completed: "2026-07-05T11:09:19Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 08 Plan 15: LandingPage Figma Alignment Summary

**One-liner:** LandingPage dikonversi dari desktop-first (max-w-6xl + grid 3 kolom) ke mobile-first PWA layout (max-w-sm + single-column flex-col) sesuai Figma 2001:691 dengan Masuk → /login dan Daftar Sekarang → /register.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LandingPage mobile-first Figma alignment (frame 2001:691) | 63e7103 | frontend/src/pages/LandingPage.tsx |

## What Was Built

LandingPage.tsx diubah total dari layout desktop-first menjadi mobile-first:

**Sebelum (desktop-first):**
- Root container: `max-w-6xl mx-auto` (1152px wide)
- Stats section: `grid grid-cols-2 md:grid-cols-4`
- Features: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Roles: `grid grid-cols-1 md:grid-cols-3`
- "Masuk" di nav header sebagai text link (tidak ada bg-[#008236])

**Sesudah (mobile-first PWA):**
- Root: `min-h-screen bg-[#f9fafb] flex flex-col items-center`
- Main container: `w-full max-w-sm mx-auto flex flex-col` (375px)
- Hero: `bg-[#008236] px-4 pt-12 pb-8` centered, SISPOS h1, tagline `text-[#7bf1a8]`
- CTA: "Masuk" (`bg-[#008236]`, Link to="/login") + "Daftar Sekarang" (border-2, Link to="/register")
- Features: 6 cards sebagai `flex flex-col gap-3` (horizontal icon + text)
- Roles: Warga/Orang Tua, Kader, Puskesmas sebagai `flex flex-col gap-3`
- Authenticated redirect: dipertahankan persis (useAuthStore + Navigate by role)

**Puskesmas Login Check (frame 5:13077):**
- Figma MCP tidak tersedia di subagent (logged sebagai deviation)
- Berdasarkan objective plan: Puskesmas Login = same LoginPage (sudah aligned 08-05)
- Tidak ada perubahan kode diperlukan — LoginPage handles all 3 roles via single gateway

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| "SISPOS" di hero section | PASS (line 27) |
| No `md:grid-cols` or `lg:grid-cols` | PASS (none present) |
| `max-w-sm` container | PASS (line 20) |
| `/login` sebagai Masuk target | PASS (line 38) |
| `/register` sebagai Daftar Sekarang target | PASS (line 44) |
| `to=` present (interactive buttons) | PASS |
| `useAuthStore` + `isAuthenticated` (redirect logic) | PASS |
| `bg-[#008236]` pada Masuk button | PASS (line 39) |
| `npm run lint` exits 0 | PASS |

## Deviations from Plan

### Noted Issues

**1. [Figma MCP Unavailable] Figma screenshot tidak dapat diambil via MCP tools**
- **Found during:** Task 1 (mandatory first step)
- **Issue:** Figma MCP tools (`mcp__plugin_figma_figma__get_screenshot`, `mcp__plugin_figma_figma__get_design_context`) tidak tersedia di subagent executor. Ini adalah upstream limitation dari agent spawning.
- **Action:** Lanjut dengan embedded spec dari PLAN.md action section sebagai source of truth
- **Impact:** Layout diimplementasi berdasarkan spec tekstual di PLAN.md; visual mungkin perlu fine-tuning di 08-16 final QA jika ada perbedaan dengan Figma aktual

**2. [Plan Execution] Puskesmas Login frame 5:13077 tidak dapat diverifikasi via MCP**
- **Found during:** Task 1
- **Issue:** Figma MCP tidak tersedia — tidak bisa screenshot frame 5:13077
- **Action:** Per objective plan, LoginPage (aligned 08-05) mencakup semua 3 role; tidak ada code change
- **Impact:** Minimal — objective plan sudah menyatakan ini hanya check visual, bukan perubahan kode

## Known Stubs

None — LandingPage adalah marketing page statis. Tidak ada data fetching, tidak ada stub content.

## Threat Flags

Tidak ada. LandingPage adalah public marketing page:
- Tidak ada data pengguna yang di-expose
- Tidak ada API calls
- Authenticated redirect sudah ada (T-08-15-02 — accepted, mitigated)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `frontend/src/pages/LandingPage.tsx` exists | FOUND |
| Commit `63e7103` exists | FOUND |
| `08-15-SUMMARY.md` exists | FOUND |
