---
phase: "05-reports-export"
plan: "01"
subsystem: "reports"
tags: ["exceljs", "pdfkit", "laporan-bulanan", "e-PPGBM", "prisma", "vitest", "pdp-guard"]
dependency_graph:
  requires: []
  provides:
    - "generateLaporanBulananXlsx"
    - "generateLaporanBulananPdf"
    - "safeCell"
  affects:
    - "laporan-bulanan.routes.ts (Plan 05-02)"
tech_stack:
  added: []
  patterns:
    - "ExcelJS 2-sheet workbook with frozen header row"
    - "pdfkit stream collection via doc.on('data'/'end')"
    - "Prisma nested query: posyandu → jadwal → slotSesi → antrian → pemeriksaan"
    - "Buffer.from(rawBuffer as ArrayBuffer) ExcelJS normalization"
key_files:
  created:
    - "backend/src/modules/reports/laporan-bulanan.service.ts"
    - "backend/src/modules/reports/__tests__/laporan-bulanan.test.ts"
  modified: []
decisions:
  - "vi.fn() mock for Workbook/PDFDocument must use function keyword (not arrow fn) — arrow functions are not constructors in JS"
  - "pdfkit mock emits dummy 'data' event in end() so Buffer.concat resolves to non-empty"
  - "Comments mentioning PDP field names removed from service to satisfy grep-based T-05-04 acceptance criterion"
metrics:
  duration: "~9 min"
  completed: "2026-07-04T01:38:33Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 05 Plan 01: Laporan Bulanan Service Summary

**One-liner:** ExcelJS 2-sheet monthly e-PPGBM report + pdfkit PDF with nested Prisma aggregation query and Vitest unit tests with constructor-safe mocks.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create test scaffold — laporan-bulanan.test.ts + service stub | 0b3d109 | laporan-bulanan.test.ts, laporan-bulanan.service.ts |
| 2 | Implement laporan-bulanan service — GREEN (REPORT-01) | 5842719 | laporan-bulanan.service.ts, laporan-bulanan.test.ts (mock fix) |

## Test Results

All 8 Vitest tests pass:

- `generateLaporanBulananXlsx` returns a non-empty Buffer ✓
- `generateLaporanBulananXlsx` calls addWorksheet exactly twice ✓
- First sheet named 'Data Balita' ✓
- Second sheet named 'Rekap Bulanan' ✓
- `generateLaporanBulananPdf` returns a non-empty Buffer ✓
- `safeCell('=SUM(A1:A10)')` → `"'=SUM(A1:A10)"` ✓
- `safeCell('+A1')` → `"'+A1"` ✓
- `safeCell('Ahmad')` → `'Ahmad'` ✓

## Security Guards Verified

| Guard | Criterion | Status |
|-------|-----------|--------|
| T-05-04 PDP exclusion | `grep -c "catatanKonsultasi\|rekomendasiAi" service.ts` = 0 | PASS |
| T-05-02 formula injection | safeCell() on all string cells | PASS |
| T-05-01 IDOR | puskesmasId from parameter (JWT), never from client | PASS |
| Pitfall 1 | `Buffer.from(rawBuffer as ArrayBuffer)` present | PASS (2 occurrences) |
| Pitfall 4 | `pemeriksaan: { some: {} }` in antrian where | PASS (2 occurrences) |
| Pitfall 5 | `lt: startOfNextMonth` not lte endOfMonth | PASS (2 occurrences) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ExcelJS/PDFDocument mock — arrow functions are not constructors**

- **Found during:** Task 1 verification (red test run after stub creation)
- **Issue:** `vi.fn(() => ({...}))` uses arrow function as mock implementation. Arrow functions cannot be called with `new` — throws "is not a constructor". Both `ExcelJS.Workbook` and `PDFDocument` are called with `new` in the service.
- **Fix:** Changed both mock implementations to use `function` keyword (`vi.fn(function MockWorkbook() { return {...} })`). When a constructor returns an object explicitly, JavaScript uses that object as the `new` result.
- **Files modified:** `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts`
- **Commit:** 5842719

**2. [Rule 1 - Bug] pdfkit mock needed 'data' event emission for non-empty Buffer**

- **Found during:** Task 2 design review
- **Issue:** The mock's `end()` only fired 'end' callbacks. `doc.on('data', chunk => chunks.push(chunk))` registered a handler, but no 'data' event was emitted, so `Buffer.concat([])` = length 0, failing `result.length > 0`.
- **Fix:** Added `emitter['data']?.forEach(cb => cb(Buffer.from([0x25, 0x50, 0x44, 0x46])))` before firing 'end', simulating a minimal PDF data chunk.
- **Files modified:** `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts`
- **Commit:** 5842719

**3. [Rule 2 - Missing Guard] Removed PDP field names from comments**

- **Found during:** Task 2 acceptance criteria verification
- **Issue:** JSDoc and inline comments mentioned `catatanKonsultasi` and `rekomendasiAi` by name, causing `grep -c` to return 2 instead of 0 (T-05-04 acceptance criterion).
- **Fix:** Replaced explicit field names in comments with generic "encrypted PDP fields" to satisfy the grep-based CI gate without losing semantic meaning.
- **Files modified:** `backend/src/modules/reports/laporan-bulanan.service.ts`
- **Commit:** 5842719

## Known Stubs

None — both `generateLaporanBulananXlsx` and `generateLaporanBulananPdf` are fully implemented with production Prisma queries and file generation logic.

## Threat Flags

None — all threat mitigations from the plan's STRIDE register (T-05-01 through T-05-04) are implemented and verified.

## Self-Check: PASSED

- [x] `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts` exists
- [x] `backend/src/modules/reports/laporan-bulanan.service.ts` exists
- [x] Commit 0b3d109 exists (Task 1 scaffold)
- [x] Commit 5842719 exists (Task 2 implementation)
- [x] All 8 vitest tests pass
- [x] TypeScript compiles clean
