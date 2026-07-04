---
phase: 05-reports-export
reviewed: 2026-07-04T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/src/modules/reports/laporan-bulanan.service.ts
  - backend/src/modules/reports/__tests__/laporan-bulanan.test.ts
  - backend/src/modules/reports/laporan-bulanan.routes.ts
  - backend/src/app.ts
  - frontend/src/pages/puskesmas/LaporanPage.tsx
findings:
  critical: 2
  warning: 5
  info: 0
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed covering the monthly reports export feature (e-PPGBM). The IDOR guard is correctly implemented (puskesmasId always from JWT, never from client query). Excel formula injection via `safeCell` is present and correct for XLSX format. Auth chain (`authMiddleware` + `requireRole('puskesmas')`) is applied to all routes.

Two blockers were found: (1) the `bulan` input validation regex accepts out-of-range months (00, 13–99), causing silent wrong-month queries; (2) the PDF generator has no pagination, truncating output for puskesmas with many posyandu entries. Five warnings cover duplicate aggregation logic, missing frontend error feedback, incomplete test coverage, a statusGizi counting design flaw in the Rekap sheet, and a config-access convention violation.

---

## Critical Issues

### CR-01: `bulan` parameter accepts out-of-range months — silently returns wrong-period data

**File:** `backend/src/modules/reports/laporan-bulanan.routes.ts:36`
**Issue:** The validation regex `/^\d{4}-\d{2}$/` accepts any two-digit month string, including `00` and `13`–`99`. `parseBulan` feeds these directly into `new Date(year, month - 1, 1)`, which JavaScript rolls over into adjacent years. For example:
- `bulan=2026-00` → `new Date(2026, -1, 1)` = **December 1, 2025** — queries the previous month with no error.
- `bulan=2026-99` → `new Date(2026, 98, 1)` ≈ **March 2034** — returns an empty (but successful) response for a nonsensical future date.

Neither case returns a 400; both return HTTP 200 with misleading or empty data. A Puskesmas user who accidentally inputs `2026-00` would download a blank or wrong-month report believing it is correct.

**Fix:** Tighten the regex to enforce `01`–`12`:
```typescript
// routes, line 36
if (!bulan || !/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) {
  res.status(400).json({
    success: false,
    error: 'VALIDASI_GAGAL',
    message: "Parameter 'bulan' harus dalam format YYYY-MM dengan bulan 01–12.",
  })
  return
}
```

---

### CR-02: PDF generator has no pagination — output is truncated for large posyandu lists

**File:** `backend/src/modules/reports/laporan-bulanan.service.ts:382–426`
**Issue:** The PDF row loop uses pdfkit's absolute-coordinate text mode (`doc.text(..., rowY, ...)`) with no check against the page height and no call to `doc.addPage()`. In landscape A4, the usable vertical area is approximately 515 pt (595 pt page height minus 80 pt margins). Each row consumes roughly 20–22 pt (one `moveDown(0.3)` at default line height). Beyond roughly 20–25 posyandu rows, `doc.y` will exceed the page bottom. In pdfkit, content rendered beyond the page boundary is silently clipped — it is neither wrapped nor placed on a new page. The resulting PDF appears to contain all rows until the last visible one; subsequent rows are lost without any error.

**Fix:** Add a page-overflow guard inside the row loop:
```typescript
// After: const rowY = doc.y
const PAGE_BOTTOM = doc.page.height - doc.page.margins.bottom
if (doc.y + 22 > PAGE_BOTTOM) {
  doc.addPage()
  // Re-draw column headers on the new page
  // ... (copy the header block starting at line 359)
}
const rowY = doc.y
```

---

## Warnings

### WR-01: Duplicate aggregation logic in XLSX and PDF generators

**File:** `backend/src/modules/reports/laporan-bulanan.service.ts:254–272` and `390–408`
**Issue:** The per-posyandu status counting loop (`diperiksa`, `buruk`, `kurang`, `normal`, `lebihObesi`, `sangatPendek`, `pendek`) is copy-pasted verbatim in both `generateLaporanBulananXlsx` and `generateLaporanBulananPdf`. Any future change to status enum values or counting logic must be updated in two places.

**Fix:** Extract a shared helper:
```typescript
function aggregatePosyanduStats(posyandu: typeof posyanduList[0]) {
  let diperiksa = 0, buruk = 0, kurang = 0, normal = 0
  let lebihObesi = 0, sangatPendek = 0, pendek = 0
  for (const jadwal of posyandu.jadwal)
    for (const sesi of jadwal.slotSesi)
      for (const antrian of sesi.antrian)
        for (const pem of antrian.pemeriksaan) {
          diperiksa++
          const status = pem.statusGiziOverride ?? pem.statusGizi ?? ''
          if (status === 'buruk') buruk++
          else if (status === 'kurang') kurang++
          else if (status === 'normal') normal++
          else if (status === 'lebih' || status === 'obesitas') lebihObesi++
          else if (status === 'sangat_pendek') sangatPendek++
          else if (status === 'pendek') pendek++
        }
  return { diperiksa, buruk, kurang, normal, lebihObesi, sangatPendek, pendek }
}
```

---

### WR-02: Frontend download failures are invisible — raw JSON error displayed in a new popup tab

**File:** `frontend/src/pages/puskesmas/LaporanPage.tsx:41–47`
**Issue:** `handleDownload` calls `window.open(url, '_blank')`. When the backend returns a 4xx or 5xx response (e.g., `500 Gagal generate laporan`), the browser renders the raw JSON error body in the new tab. There is no inline error state in the component. The user sees a blank or broken tab and has no understanding of why the download failed.

**Fix:** Replace `window.open` with a fetch-based download that surfaces errors inline:
```typescript
const [downloadError, setDownloadError] = useState<string | null>(null)
const [isDownloading, setIsDownloading] = useState(false)

const handleDownload = async (format: 'xlsx' | 'pdf') => {
  setDownloadError(null)
  setIsDownloading(true)
  try {
    const resp = await apiClient.get(
      `/reports/laporan-bulanan?bulan=${bulan}&format=${format}`,
      { responseType: 'blob' }
    )
    const url = URL.createObjectURL(resp.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-${bulan}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    setDownloadError('Gagal mengunduh laporan. Coba lagi.')
  } finally {
    setIsDownloading(false)
  }
}
```
Render `downloadError` as an inline alert below the buttons.

---

### WR-03: Rekap Bulanan `Sangat Pendek` / `Pendek` columns under-count stunted children

**File:** `backend/src/modules/reports/laporan-bulanan.service.ts:263–271`
**Issue:** `statusGizi` is a single priority-ranked field. `determineStatusGizi` assigns priority `buruk > sangat_pendek > kurang > pendek > ...`. A child who is both wasted (BB/U < −3) AND stunted (TB/U < −3) is classified solely as `'buruk'` and counted only in the `buruk` column — they are **not** counted in `sangatPendek`. The `Sangat Pendek` and `Pendek` columns therefore capture only children whose primary status is stunting, missing wasted-and-stunted cases. This diverges from standard e-PPGBM reporting where TB/U categories are counted independently of BB/U categories.

**Fix (design change required):** The `Pemeriksaan` model already stores `zScoreTbU`. Compute TB/U status independently for Rekap counting rather than relying on `statusGizi` alone:
```typescript
// Count sangatPendek / pendek from zScoreTbU directly, not from statusGizi
const tbU = pem.zScoreTbU
if (tbU !== null && tbU < -3) sangatPendek++
else if (tbU !== null && tbU < -2) pendek++
```

---

### WR-04: Test suite missing the `PUSKESMAS_TIDAK_DITEMUKAN` error path and two `safeCell` prefix variants

**File:** `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts`
**Issue (a):** Neither `generateLaporanBulananXlsx` nor `generateLaporanBulananPdf` tests verify the branch where `prisma.puskesmas.findUnique` returns `null`. This branch throws `{ code: 'PUSKESMAS_TIDAK_DITEMUKAN' }`, which the route maps to HTTP 404. Without a test, a future refactor of that branch could silently break error handling.

**Issue (b):** The `safeCell` regex guards four prefixes (`=`, `+`, `-`, `@`). The test suite only covers `=` and `+`. The `-` and `@` cases are untested.

**Fix:**
```typescript
// In generateLaporanBulananXlsx describe block
it('throws PUSKESMAS_TIDAK_DITEMUKAN when puskesmas not found', async () => {
  prismaMock.puskesmas.findUnique.mockResolvedValue(null)
  await expect(generateLaporanBulananXlsx(PUSKESMAS_ID, BULAN))
    .rejects.toMatchObject({ code: 'PUSKESMAS_TIDAK_DITEMUKAN' })
})

// In safeCell describe block
it("prefixes '-' with apostrophe", () => {
  expect(safeCell('-1+2')).toBe("'-1+2")
})
it("prefixes '@' with apostrophe", () => {
  expect(safeCell('@SUM')).toBe("'@SUM")
})
```

---

### WR-05: Logger in service uses `process.env.NODE_ENV` directly instead of `env` config module

**File:** `backend/src/modules/reports/laporan-bulanan.service.ts:24`
**Issue:** `process.env.NODE_ENV` is accessed directly:
```typescript
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })
```
The rest of the backend reads environment values via `import { env } from '../../config/env'` (which applies validation and type-safety). This file bypasses that contract, making it the only module that reads `NODE_ENV` raw. If the env module adds normalization or aliasing for `NODE_ENV`, this logger would silently behave differently.

**Fix:**
```typescript
import { env } from '../../config/env'
const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })
```

---

_Reviewed: 2026-07-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
