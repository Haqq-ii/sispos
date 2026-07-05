---
phase: 08-ui-figma-alignment
plan: "09"
subsystem: frontend/citizen-antrian
tags: [ui, figma-alignment, citizen, antrian, queue]
dependency_graph:
  requires: [08-08]
  provides: [citizen-antrian-flow-aligned]
  affects: [PilihTanggalPage, PilihSesiPage, KonfirmasiAntrianPage, TiketAntrianPage]
tech_stack:
  patterns:
    - zustand-store-for-wizard-selection
    - selected-card-border-highlight
    - separate-lanjutkan-button-pattern
    - navigate-minus-1-for-back
key_files:
  modified:
    - frontend/src/pages/citizen/antrian/PilihTanggalPage.tsx
    - frontend/src/pages/citizen/antrian/PilihSesiPage.tsx
    - frontend/src/pages/citizen/antrian/KonfirmasiAntrianPage.tsx
    - frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx
decisions:
  - "PilihSesiPage: card tap only sets selectedSlotId in store; Lanjutkan button triggers navigate — better UX than immediate navigate on card tap"
  - "PilihSesiPage: uses selectedSlotId from store directly (no separate local state) for both highlight and disabled — simpler and satisfies literal acceptance criteria"
  - "KonfirmasiAntrianPage: navigate(-1) on back button instead of hardcoded route — respects navigation history stack"
  - "Figma MCP unavailable in executor toolset — proceeded with embedded spec from PLAN.md design tokens"
metrics:
  duration: ~12 min
  completed: "2026-07-05"
  tasks_completed: 2
  files_modified: 4
---

# Phase 08 Plan 09: Citizen Antrian Flow Figma Alignment Summary

**One-liner:** Citizen antrian flow 4 screens aligned — PilihTanggal/PilihSesi card-select pattern + KonfirmasiAntrian/TiketAntrian button polish with bg-[#008236] and navigate(-1).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PilihTanggalPage + PilihSesiPage Figma alignment | 2abc2e2 | PilihTanggalPage.tsx, PilihSesiPage.tsx |
| 2 | KonfirmasiAntrianPage + TiketAntrianPage alignment | 3c819ca | KonfirmasiAntrianPage.tsx, TiketAntrianPage.tsx |

## Changes Made

### Task 1: PilihTanggalPage + PilihSesiPage

**PilihTanggalPage.tsx:**
- CTA button: added `bg-[#008236] text-white rounded-[14px] hover:bg-[#00a63e]` explicit hex (Figma green)
- Button text renamed from "Pilih Tanggal Ini" to "Lanjutkan" (consistent with Figma language)
- Button `disabled={!canProceed}` preserved (canProceed checks selectedDate + availableDates)

**PilihSesiPage.tsx:**
- Restructured from "card click = immediate navigate" to "card click = select + Lanjutkan button = navigate"
- Added `selectedSlotId` to destructured store values (alongside existing `setSelectedSlotId`)
- `handlePilihSesi`: now only calls `setSelectedSlotId(sesiId)` — no navigate
- `handleLanjutkan`: new handler that navigates to `/citizen/antrian/konfirmasi` with jadwalId
- Card wrapper div: conditional `border-2 border-[#008236]` when `selectedSlotId === sesi.id`, else `border-2 border-transparent`
- New Lanjutkan button: `bg-[#008236]` + `disabled={!selectedSlotId}` + onClick calls handleLanjutkan

### Task 2: KonfirmasiAntrianPage + TiketAntrianPage

**KonfirmasiAntrianPage.tsx:**
- Back button onClick: `navigate('/citizen/antrian/pilih-sesi')` → `navigate(-1)` (respects history stack)
- CTA button: renamed "Ambil Antrian" → "Daftar Sekarang", added `bg-[#008236] text-white rounded-[14px] hover:bg-[#00a63e]`
- Loading text: "Mengambil antrian..." → "Mendaftarkan antrian..."
- Added explicit Batal ghost button with `onClick={() => navigate(-1)}`

**TiketAntrianPage.tsx:**
- Disconnect alert message: "Koneksi terputus. Memuat ulang data..." → "Koneksi realtime terputus. Data mungkin tidak terkini."
- Comment updated to mark it as non-dismissible (T-08-09-02 mitigation)

## Acceptance Criteria Verification

### Task 1 — PilihTanggalPage
- [x] Back button (ChevronLeft) has onClick → navigate('/citizen/dashboard')
- [x] Lanjutkan button: `disabled={!canProceed}` where canProceed depends on selectedDate (equivalent condition)
- [x] Lanjutkan button navigates to antrian/pilih-sesi route
- [x] Lanjutkan button has `bg-[#008236]`

### Task 1 — PilihSesiPage
- [x] Sesi card onPilih calls setSelectedSlotId from store
- [x] Selected card has `border-[#008236]` conditional on selectedSlotId === sesi.id
- [x] Lanjutkan button has `disabled={!selectedSlotId}` literal
- [x] Lanjutkan button navigates to konfirmasi route via handleLanjutkan

### Task 2 — KonfirmasiAntrianPage
- [x] Back button onClick calls navigate(-1)
- [x] Daftar Sekarang button references ambilAntrian (via useAmbilAntrian import)
- [x] Daftar Sekarang button disabled condition references selectedBalitaId (via canSubmit)
- [x] SLOT_PENUH string present (error handling + Alert)
- [x] Daftar Sekarang button has `bg-[#008236]`

### Task 2 — TiketAntrianPage
- [x] BatalkanAntrianDialog component rendered
- [x] statusAntrian === 'menunggu' guards BatalkanAntrianDialog render
- [x] CountdownEstimasi component rendered
- [x] padStart(2, '0') for nomorUrut zero-padding
- [x] useAntrianSocket hook call present (realtime preserved)

### Lint Gate
- [x] `docker compose exec sispos-frontend npm run lint` exits 0 (tsc --noEmit clean)

## Deviations from Plan

### Auto-noted Issues

**1. [Deviation - Non-breaking] Figma MCP unavailable in executor toolset**
- **Found during:** Task 1 start (mandatory first step)
- **Issue:** `mcp__plugin_figma_figma__get_screenshot` and `mcp__plugin_figma_figma__get_design_context` not available as tools in executor
- **Fix:** Proceeded with PLAN.md embedded spec (design tokens from 08-RESEARCH.md section 1.4)
- **Impact:** None — PLAN.md spec was detailed enough for full implementation

**2. [Rule 2 - Missing Batal button] KonfirmasiAntrianPage had no explicit Batal button**
- **Found during:** Task 2 review of acceptance criteria "Batal navigates back"
- **Issue:** Plan required "Batal button: onClick={() => navigate(-1)} — must be present" but original page only had back ChevronLeft button
- **Fix:** Added explicit "Batal" ghost button below Daftar Sekarang
- **Files modified:** KonfirmasiAntrianPage.tsx

## Known Stubs

None. All 4 screens are functional with real data fetching and button handlers.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. All changes are purely UI alignment.

## Self-Check: PASSED

- [x] PilihTanggalPage.tsx modified: file exists and contains bg-[#008236] on button
- [x] PilihSesiPage.tsx modified: file exists and contains border-[#008236] + disabled={!selectedSlotId}
- [x] KonfirmasiAntrianPage.tsx modified: file exists and contains navigate(-1) + bg-[#008236] + SLOT_PENUH
- [x] TiketAntrianPage.tsx modified: file exists and contains "Koneksi realtime terputus"
- [x] Commit 2abc2e2 exists (Task 1)
- [x] Commit 3c819ca exists (Task 2)
