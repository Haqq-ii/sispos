---
phase: 05
slug: reports-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-04
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `backend/vitest.config.ts` (exists) |
| **Quick run command** | `cd backend && npx vitest run --reporter verbose` |
| **Full suite command** | `cd backend && npx vitest run --reporter verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `cd backend && npx tsc --noEmit`
- **After every plan wave:** `cd backend && npx vitest run --reporter verbose`
- **Before `/gsd-verify-work`:** Full suite must be green

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | REPORT-01 | T-05-01-IDOR | puskesmasId dari JWT, bukan query param | unit | `cd backend && npx vitest run src/modules/reports/__tests__/laporan-bulanan.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | REPORT-01 | T-05-01-INJECT | safeCell() pada namaBalita | unit | same file | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | REPORT-01 | — | generateLaporanBulananXlsx returns non-empty Buffer | unit | same file | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | REPORT-01 | — | generateLaporanBulananPdf returns non-empty Buffer | unit | same file | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | REPORT-01 | — | Excel workbook has 2 sheets (Rekap + Data Balita) | unit | same file | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts` — vitest unit tests for REPORT-01 (mock Prisma, verify buffer non-empty + 2 sheets, safeCell injection guard)
- [ ] No new framework install needed — Vitest already configured in `backend/vitest.config.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GET /api/reports/laporan-bulanan without auth → 401 | REPORT-01 | Integration test would need running server | Call endpoint with no cookie, expect 401 |
| Download .xlsx opens correctly in Excel/LibreOffice | REPORT-01 | Binary output visual check | Click "Unduh Excel" in browser, open file |
| Download .pdf layout bersih | REPORT-01 | PDF visual inspection | Click "Unduh PDF" in browser, inspect layout |
| Filter bulan update tanpa reload | REPORT-01 | UI behavior | Change month picker, verify data changes |
