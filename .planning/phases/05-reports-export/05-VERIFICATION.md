---
phase: 05-reports-export
verified: 2026-07-04T06:30:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Browser at /puskesmas/laporan — visual layout check"
    expected: "Green header visible with title 'Laporan e-PPGBM'; month picker visible in top-right of header; two download rows (Excel + PDF) inside FORMAT LAPORAN card; amber warning card below with 'Catatan Format e-PPGBM' title"
    why_human: "Visual rendering cannot be verified via grep — requires browser and logged-in puskesmas session"
  - test: "Click 'Unduh Excel' opens download"
    expected: "New tab opens to /api/reports/laporan-bulanan?bulan=YYYY-MM&format=xlsx; browser prompts file download of laporan-YYYY-MM.xlsx"
    why_human: "Requires running backend with valid JWT cookie; cannot simulate live HTTP response in static analysis"
  - test: "GET /api/reports/laporan-bulanan without auth cookie returns 401"
    expected: "curl -s http://localhost/api/reports/laporan-bulanan?bulan=2026-07&format=xlsx without cookie → HTTP 401"
    why_human: "Requires live running backend; authMiddleware behavior is wired in code but HTTP response needs live verification"
  - test: "Download .xlsx e-PPGBM format compliance"
    expected: "Sheet 1 'Data Balita' has 17 correctly-named columns; Sheet 2 'Rekap Bulanan' has 9 columns; header row frozen, bold, green fill; data rows contain real posyandu/balita data from DB"
    why_human: "Requires opening the actual Excel file with data from a seeded database to verify column names, formatting, and aggregate accuracy match Kemenkes standard (ROADMAP SC2)"
  - test: "Download .pdf ringkas layout"
    expected: "PDF opens as landscape A4; header shows 'Laporan Gizi Balita Bulanan', puskesmas name, and month/year; table rows per posyandu with counts; footer shows print timestamp"
    why_human: "Visual PDF layout inspection required to confirm 'bersih' presentation (ROADMAP SC3)"
---

# Phase 05: Reports & Export — Verification Report

**Phase Goal:** Backend laporan bulanan service + route handler + frontend LaporanPage — e-PPGBM export feature complete
**Verified:** 2026-07-04T06:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `generateLaporanBulananXlsx(puskesmasId, bulan)` returns a non-empty Buffer (Buffer.isBuffer === true, length > 0) | VERIFIED | Service line 291: `return Buffer.from(rawBuffer as ArrayBuffer)`; xlsx.writeBuffer() produces real data |
| 2  | Excel workbook contains exactly 2 worksheets: 'Data Balita' (17 columns) and 'Rekap Bulanan' (9 columns) | VERIFIED | Service lines 177+235: `addWorksheet('Data Balita')` and `addWorksheet('Rekap Bulanan')`; 17 columns defined lines 178–196; 9 columns lines 236–246 |
| 3  | `generateLaporanBulananPdf(puskesmasId, bulan)` returns a non-empty Buffer | VERIFIED | Service lines 305–440: pdfkit stream collection pattern, `return buffer` at line 438 |
| 4  | `safeCell()` prefixes values starting with = + - @ with apostrophe; leaves safe values unchanged | VERIFIED | Service lines 28–30: `export function safeCell(value: string): string { return /^[=+\-@]/.test(value) ? "'" + value : value }` |
| 5  | Prisma select in service NEVER includes `catatanKonsultasi` or `rekomendasiAi` (UU PDP No. 27/2022) | VERIFIED | `grep -c "catatanKonsultasi\|rekomendasiAi" laporan-bulanan.service.ts` = 0; comment at line 95 confirms exclusion intent |
| 6  | `parseBulan` uses `lt: startOfNextMonth` (not `lte endOfMonth`) to avoid Pitfall 5 UTC/WIB off-by-one | VERIFIED | Service line 55: `const startOfNextMonth = new Date(year, month, 1) // exclusive upper bound`; line 72: `lt: startOfNextMonth`; grep returns 2 occurrences |
| 7  | `GET /api/reports/laporan-bulanan?bulan=2026-07&format=xlsx` with valid JWT returns 200 with Content-Disposition: attachment | VERIFIED (code path) | Routes line 61–66: Content-Type + Content-Disposition headers set; service called with puskesmasId; registered at app.ts line 77; LIVE HTTP test needed (see human_verification) |
| 8  | `GET /api/reports/laporan-bulanan` without auth cookie returns 401 | VERIFIED (code path) | `puskesmasAuth = [authMiddleware, requireRole('puskesmas')]` spread on route; same authMiddleware used across all protected routes; LIVE test needed (see human_verification) |
| 9  | `GET /api/reports/laporan-bulanan?format=invalid` returns 400 VALIDASI_GAGAL (T-05-03 path traversal guard) | VERIFIED (code path) | Routes lines 46–52: `if (!format \|\| !['xlsx', 'pdf'].includes(format))` → 400 VALIDASI_GAGAL; LIVE test noted in human_verification |
| 10 | LaporanPage.tsx renders green header with month picker and two download rows (Excel + PDF) | VERIFIED (code path) | LaporanPage lines 54/63/128/147: `bg-[#008236]` header, `type="month"` input, `handleDownload('xlsx')` + `handleDownload('pdf')` buttons; visual rendering needs human test |
| 11 | Download buttons call `window.open` synchronously from onClick — not after await (Pitfall 6) | VERIFIED | `grep -c "async\|await" LaporanPage.tsx` = 0; `handleDownload` lines 41–47 is synchronous with no async/await; `window.open` called directly |
| 12 | `puskesmasId` is extracted from `req.user!.userId` in the route handler — never from `req.query` (T-05-01) | VERIFIED | Routes line 56: `const puskesmasId = req.user!.userId`; no reference to `req.query.puskesmasId` or `req.body.puskesmasId` in the file |

**Score:** 12/12 truths verified at code level. 5 runtime/visual behaviors deferred to human verification.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts` | Vitest unit tests: buffer non-empty, 2 sheets, PDF buffer, safeCell guard | VERIFIED | 189 lines; 3 describe blocks (generateLaporanBulananXlsx, generateLaporanBulananPdf, safeCell); 8 test cases using constructor-safe vi.fn() mocks |
| `backend/src/modules/reports/laporan-bulanan.service.ts` | Exports generateLaporanBulananXlsx, generateLaporanBulananPdf, safeCell | VERIFIED | 441 lines; all 3 functions exported; full Prisma nested query; ExcelJS 2-sheet; pdfkit stream collection |
| `backend/src/modules/reports/laporan-bulanan.routes.ts` | laporanBulananRouter, GET /laporan-bulanan with IDOR + format validation | VERIFIED | 88 lines; exports `laporanBulananRouter`; IDOR guard at line 56; format enum at lines 46–52 |
| `backend/src/app.ts` | Route registration `app.use('/api/reports', laporanBulananRouter)` | VERIFIED | Line 20: import; Line 77: `app.use('/api/reports', laporanBulananRouter)`; `grep -c "laporanBulananRouter" app.ts` = 2 |
| `frontend/src/pages/puskesmas/LaporanPage.tsx` | Functional puskesmas laporan page: month picker, stats, download buttons | VERIFIED | 172 lines; default export `LaporanPage`; TanStack Query stats; synchronous `handleDownload`; amber warning card |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LaporanPage.tsx` | `/api/reports/laporan-bulanan` | `window.open` called synchronously from onClick | WIRED | Lines 41–47: `window.open('/api/reports/laporan-bulanan?bulan=' + bulan + '&format=' + format, '_blank', 'noopener,noreferrer')` |
| `backend/src/app.ts` | `laporan-bulanan.routes.ts` | `app.use('/api/reports', laporanBulananRouter)` | WIRED | Line 20: import; Line 77: `app.use('/api/reports', laporanBulananRouter)` |
| `laporan-bulanan.routes.ts` | `req.user!.userId` | IDOR guard — puskesmasId from JWT only | WIRED | Line 56: `const puskesmasId = req.user!.userId`; pattern `req\.user!?\.userId` present |
| `laporan-bulanan.service.ts` | `prisma.posyandu.findMany` | Nested query with puskesmasId | WIRED | Lines 63–115: `prisma.posyandu.findMany({ where: { puskesmasId }, ...})` |
| `laporan-bulanan.service.ts` | `ExcelJS.Workbook.addWorksheet` | `addWorksheet` called exactly 2 times | WIRED | Line 177: `addWorksheet('Data Balita')`; Line 235: `addWorksheet('Rekap Bulanan')` |
| `laporan-bulanan.service.ts` | `Buffer.from` | Pitfall 1 normalization after xlsx.writeBuffer() | WIRED | Line 291: `return Buffer.from(rawBuffer as ArrayBuffer)` |
| `frontend/src/router/index.tsx` | `LaporanPage` | React.lazy + Route at `/puskesmas/laporan` | WIRED | Router line 73: `lazy(() => import('@/pages/puskesmas/LaporanPage'))`; Route line 217 inside `ProtectedRoute allowedRoles=['puskesmas']` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LaporanPage.tsx` — stats grid | `stats` (DashboardStats) | `useQuery` → `GET /api/dashboard/stats?bulan=...` via `apiClient.get('/dashboard/stats', { params: { bulan } })` | Yes — Phase 4 endpoint queries real DB data | FLOWING |
| `LaporanPage.tsx` — downloads | `bulan` state | `useState(getBulanDefault)` → user input `<input type="month">` | Yes — synchronous `window.open` sends bulan to backend | FLOWING |
| `laporan-bulanan.service.ts` — xlsx/pdf | `posyanduList` | `prisma.posyandu.findMany({ where: { puskesmasId }, ... })` with nested jadwal → slotSesi → antrian → pemeriksaan select | Yes — queries real DB; returns empty array if no data for period (not static) | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for live HTTP checks (backend not running). Code path analysis substituted above under Truth 7–9.

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` files declared or found for Phase 5.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REPORT-01 | 05-01-PLAN.md, 05-02-PLAN.md | Laporan bulanan Puskesmas mengagregasi data pemeriksaan; export Excel (.xlsx) format e-PPGBM standar Kemenkes; export PDF ringkas; dihasilkan via ExcelJS + pdfkit (bukan puppeteer) | SATISFIED | ExcelJS used (service line 18: `import ExcelJS from 'exceljs'`); pdfkit used (line 19: `import PDFDocument from 'pdfkit'`); no puppeteer import anywhere in phase files; 2-sheet xlsx aggregates by posyandu; pdf generates per-posyandu summary |

No orphaned requirements: REQUIREMENTS.md maps only REPORT-01 to Phase 5 (traceability table line: `REPORT-01 \| Phase 5 \| Wave 5.1`).

---

### Anti-Patterns Found

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| All phase 05 files | TBD / FIXME / XXX debt markers | Checked | None found |
| All phase 05 files | Placeholder / stub patterns | Checked | None found — both generators fully implemented |
| `laporan-bulanan.service.ts` | `return null \| return []` | Checked | Not present — returns real Buffer in both functions |
| `LaporanPage.tsx` | `Data Imunisasi` out-of-scope stub | Checked | Absent — `grep -c "Data Imunisasi"` = 0 |

No anti-patterns detected in any file modified by Phase 5.

---

### Human Verification Required

#### 1. LaporanPage Visual Layout

**Test:** Log in as puskesmas role, navigate to `/puskesmas/laporan`.
**Expected:** Green header `#008236` visible with heading "Laporan e-PPGBM"; month picker input in top-right corner of header; 2x2 stat grid below (Pemeriksaan, Terdaftar, Anak Sehat, Perlu Perhatian); FORMAT LAPORAN card with two rows — "Laporan e-PPGBM (.xlsx)" + "Laporan Ringkas (.pdf)"; amber "Catatan Format e-PPGBM" warning card at bottom.
**Why human:** Visual rendering and layout cannot be verified by static analysis; requires browser + authenticated puskesmas session.

#### 2. Excel Download Trigger

**Test:** On `/puskesmas/laporan`, click "Unduh Excel".
**Expected:** Browser opens a new tab to `/api/reports/laporan-bulanan?bulan=YYYY-MM&format=xlsx` (using selected month); download dialog for `laporan-YYYY-MM.xlsx` appears.
**Why human:** Requires live backend with valid JWT httpOnly cookie; actual HTTP response and file download behavior cannot be verified statically.

#### 3. Unauthorized Access Returns 401

**Test:** `curl -s -o /dev/null -w "%{http_code}" http://localhost/api/reports/laporan-bulanan?bulan=2026-07&format=xlsx` (no cookie).
**Expected:** HTTP 401.
**Why human:** Requires live running backend; authMiddleware behavior confirmed in code but actual HTTP response needs live verification.

#### 4. Excel e-PPGBM Format Compliance (ROADMAP SC2)

**Test:** Download `.xlsx` with a month that has real pemeriksaan data (requires seeded DB). Open in Excel/LibreOffice.
**Expected:** Sheet 1 "Data Balita" with exactly 17 columns matching e-PPGBM Kemenkes standard; header row frozen + bold + light-green fill; data rows show individual balita records with correct Z-Score values; Sheet 2 "Rekap Bulanan" with 9 aggregate columns per posyandu; no formula injection vulnerability (cell values starting with = are prefixed with apostrophe).
**Why human:** Requires actual DB data; column format compliance with Kemenkes standard requires human visual inspection of the Excel output (ROADMAP SC2: "100% format compliance").

#### 5. PDF Layout Quality (ROADMAP SC3)

**Test:** Download `.pdf` with a month that has posyandu data.
**Expected:** A4 landscape PDF; header "Laporan Gizi Balita Bulanan" centered; puskesmas name and period; clean table rows per posyandu; footer timestamp.
**Why human:** Visual quality and "layout yang bersih" judgment requires human review of the actual rendered PDF (ROADMAP SC3).

---

### Gaps Summary

No gaps. All 12 must-have truths are code-verified. All 5 required artifacts exist and are substantive, wired, and data-flowing. REPORT-01 is fully satisfied. Zero debt markers or stubs found.

5 human verification items remain — these concern runtime HTTP behavior, visual layout quality, and e-PPGBM format compliance that require a live system with seeded data.

---

_Verified: 2026-07-04T06:30:00Z_
_Verifier: Claude (gsd-verifier)_
