# Phase 05: Reports & Export — Research

**Researched:** 2026-07-04
**Domain:** Excel/PDF export, Prisma aggregation query, puskesmas laporan bulanan e-PPGBM
**Confidence:** HIGH (codebase patterns verified; e-PPGBM column format ASSUMED — see Open Questions)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPORT-01 | Laporan bulanan Puskesmas mengagregasi data pemeriksaan; export Excel (.xlsx) format e-PPGBM standar Kemenkes; export PDF ringkas; via ExcelJS + pdfkit (bukan puppeteer) | §Standard Stack (ExcelJS 4.4.0 + pdfkit 0.15.0 already installed), §Reusable Patterns from Phase 3, §Aggregation Query Pattern |
</phase_requirements>

---

## Summary

Phase 5 menambahkan laporan bulanan Puskesmas (berbeda dari rekap harian kader di Phase 3). Mayoritas pola implementasi sudah ada dan teruji di codebase — Phase 3 Plan 07 telah mengimplementasikan ExcelJS + pdfkit dengan pattern yang persis sama. Tidak ada package baru yang perlu diinstall.

Scope Phase 5 adalah: satu endpoint baru `GET /api/reports/laporan-bulanan?bulan=YYYY-MM&format=xlsx|pdf` untuk role puskesmas, dan rewrite `LaporanPage.tsx` (saat ini stub). Query agregasi mengikuti pola persis dari `dashboard.service.ts` (Phase 4) — loop posyandu → jadwal → slotSesi → antrian → pemeriksaan, dengan tambahan balita dan warga detail untuk kolom e-PPGBM individual.

**Critical finding:** Format kolom e-PPGBM standar Kemenkes tidak dapat diverifikasi dari sumber otoritatif secara langsung dalam sesi ini (domain kemkes.go.id tidak dapat diakses via WebFetch). Kolom yang didokumentasikan di §e-PPGBM Column Format berstatus [ASSUMED] dan WAJIB dikonfirmasi dengan instruktur sebelum implementasi atau dianggap sudah sesuai untuk konteks akademik.

**Primary recommendation:** Implementasikan dalam satu wave tunggal (Wave 5.1). Tidak ada blocking dependency dari Phase 3 — rekap-harian module sudah selesai dan Phase 5 menambahkan file baru ke module yang sama. Reuse pattern ExcelJS + pdfkit dari `rekap-harian.service.ts` secara langsung.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data agregasi laporan bulanan | Backend (Prisma query) | — | Query kompleks multi-level join; tidak boleh di client |
| Excel generation (.xlsx) | Backend (ExcelJS) | — | File generation di server; puskesmasId dari JWT (IDOR guard) |
| PDF generation (.pdf) | Backend (pdfkit) | — | File generation di server; key tidak boleh di client |
| IDOR guard puskesmas scope | Backend (authMiddleware + requireRole) | — | puskesmasId SELALU dari JWT, bukan query param |
| Month picker UI | Frontend (HTML input[type=month]) | — | Native input cukup; react-day-picker overkill untuk month-only |
| Download trigger | Frontend (window.open) | — | JWT di httpOnly cookie — same-origin request otomatis bawa cookie; tidak perlu token di URL |

---

## Standard Stack

### Core — ALREADY INSTALLED (no new installs needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `exceljs` | 4.4.0 | Generate .xlsx workbook dengan multiple sheets | [VERIFIED: backend/package.json] |
| `pdfkit` | 0.15.0 | Generate .pdf landscape ringkas | [VERIFIED: backend/package.json] |
| `@types/pdfkit` | 0.13.4 | TypeScript types untuk pdfkit | [VERIFIED: backend/package.json devDependencies] |
| `@prisma/client` | 5.15.0 | ORM query ke PostgreSQL | [VERIFIED: backend/package.json] |
| `pino` | 9.2.0 | Logging | [VERIFIED: backend/package.json] |

**No new packages needed.** ExcelJS dan pdfkit sudah ada dan teruji via Phase 3 rekap-harian smoke test.

### Alternatives Considered

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| ExcelJS | xlsx (SheetJS) | ExcelJS sudah installed dan teruji; tidak ada alasan ganti |
| pdfkit | puppeteer | CLAUDE.md §Export: "bukan puppeteer" — explicit constraint |
| pdfkit | pdfmake | Tidak ada di package.json; tidak boleh tambah tanpa alasan |

---

## Package Legitimacy Audit

Tidak ada package baru yang perlu diinstall untuk Phase 5. ExcelJS 4.4.0 dan pdfkit 0.15.0 sudah ada di `backend/package.json` dan sudah digunakan di `rekap-harian.service.ts` (Phase 3).

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| `exceljs` | npm | Already installed, Phase 3 tested | Approved — no new install |
| `pdfkit` | npm | Already installed, Phase 3 tested | Approved — no new install |

**Slopcheck:** Tidak diperlukan karena tidak ada package baru.

---

## Architecture Patterns

### System Architecture Diagram

```
Puskesmas Browser
  │
  ├─ GET /puskesmas/laporan
  │    LaporanPage.tsx (month picker + download buttons)
  │
  ├─ window.open('/api/reports/laporan-bulanan?bulan=YYYY-MM&format=xlsx')
  │    (httpOnly JWT cookie otomatis ikut — same-origin)
  │
Backend Express
  │
  ├─ authMiddleware (verify JWT cookie)
  ├─ requireRole('puskesmas')
  │
  ├─ laporan-bulanan.routes.ts
  │    GET /laporan-bulanan?bulan=YYYY-MM&format=xlsx|pdf
  │
  ├─ laporan-bulanan.service.ts
  │    generateLaporanBulananXlsx(puskesmasId, bulan) → Buffer
  │    generateLaporanBulananPdf(puskesmasId, bulan) → Buffer
  │
  ├─ Prisma Query Chain:
  │    Posyandu (puskesmasId) → Jadwal (tanggalPelaksanaan filter)
  │    → SlotSesi → Antrian (statusAntrian='selesai')
  │    → Pemeriksaan + Balita + Warga
  │
  ├─ ExcelJS / pdfkit → Buffer
  └─ res.send(buffer) with Content-Disposition: attachment
```

### Recommended Project Structure (additions only)

```
backend/src/modules/reports/
├── rekap-harian.routes.ts       # existing — kader, per-slot
├── rekap-harian.service.ts      # existing — kader, per-slot
├── laporan-bulanan.routes.ts    # NEW — puskesmas, per-bulan
└── laporan-bulanan.service.ts   # NEW — puskesmas, per-bulan

frontend/src/pages/puskesmas/
└── LaporanPage.tsx              # REWRITE — stub → functional UI
```

### Pattern 1: Reusable ExcelJS Workbook Generation

Langsung dari `rekap-harian.service.ts` (Phase 3, teruji):

```typescript
// Source: backend/src/modules/reports/rekap-harian.service.ts (existing, verified)
import ExcelJS from 'exceljs'

async function generateXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SISPOS'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Data Balita')  // Sheet 1

  sheet.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Balita', key: 'namaBalita', width: 25 },
    // ... more columns
  ]

  // Bold + frozen header (proven pattern)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  // Add data rows
  sheet.addRow({ no: 1, namaBalita: safeCell(nama), ... })

  // Sheet 2: Rekap Agregat
  const sheet2 = workbook.addWorksheet('Rekap Bulanan')
  // ... summary columns

  const rawBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(rawBuffer as ArrayBuffer)  // WAJIB: normalize ArrayBuffer → Buffer
}
```

**Critical note:** `workbook.xlsx.writeBuffer()` mengembalikan `ArrayBuffer` di beberapa versi ExcelJS. Wajib `Buffer.from(rawBuffer as ArrayBuffer)` — sudah dibuktikan di Phase 3.

### Pattern 2: Reusable pdfkit Stream Collection

Langsung dari `rekap-harian.service.ts` (Phase 3, teruji):

```typescript
// Source: backend/src/modules/reports/rekap-harian.service.ts (existing, verified)
import PDFDocument from 'pdfkit'

async function generatePdf(): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text('Laporan Bulanan e-PPGBM', { align: 'center' })
  doc.moveDown(0.4)
  doc.fontSize(10).font('Helvetica').text(`Periode: Januari 2026`, { align: 'center' })
  doc.moveDown(0.8)

  // Summary table (per posyandu)
  // Use manual X positioning — no pdf-table library needed
  // Max ~10-15 posyandu per puskesmas — layout manual cukup

  doc.end()
  return bufferPromise
}
```

### Pattern 3: Aggregation Query (extends dashboard.service.ts pattern)

Dari `dashboard.service.ts` (Phase 4), pattern query puskesmas-scoped monthly aggregation:

```typescript
// Source: backend/src/modules/dashboard/dashboard.service.ts (existing, verified)
// Extended untuk laporan dengan individual balita data

const posyanduList = await prisma.posyandu.findMany({
  where: { puskesmasId },   // IDOR: puskesmasId dari JWT selalu
  select: {
    id: true,
    namaPosyandu: true,
    kelurahan: true,
    rw: true,
    jadwal: {
      where: {
        tanggalPelaksanaan: { gte: startOfMonth, lte: endOfMonth },
      },
      select: {
        tanggalPelaksanaan: true,
        slotSesi: {
          select: {
            antrian: {
              where: { statusAntrian: 'selesai' },
              select: {
                nomorUrut: true,
                pemeriksaan: {
                  select: {
                    beratBadan: true,
                    tinggiBadan: true,
                    lingkarLengan: true,  // LILA
                    zScoreBbU: true,
                    zScoreTbU: true,
                    zScoreBbTb: true,
                    statusGizi: true,
                    statusGiziOverride: true,
                    tanggalPemeriksaan: true,
                    balita: {
                      select: {
                        namaBalita: true,
                        nikBalita: true,
                        tanggalLahir: true,
                        jenisKelamin: true,
                        warga: {
                          select: { namaLengkap: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
})
```

**Performance note:** Untuk seed data >100 balita, query nested ini akan menghasilkan O(posyandu × jadwal × slot × antrian × pemeriksaan) objects. Acceptable untuk laporan batch (bukan realtime). Jika perlu optimize: gunakan `prisma.$queryRaw` dengan JOIN langsung.

### Pattern 4: Excel Formula Injection Guard

```typescript
// Source: backend/src/modules/reports/rekap-harian.service.ts (existing, verified)
function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? "'" + value : value
}
// Apply to ALL string columns: namaBalita, namaOrangTua, namaPosyandu
```

### Pattern 5: Download via window.open (Frontend)

```typescript
// Source: frontend/src/pages/kader/RekapHarianPage.tsx (existing, verified)
// window.open works karena JWT di httpOnly cookie — same-origin request otomatis bawa cookie

const handleDownload = (format: 'xlsx' | 'pdf') => {
  const url = `/api/reports/laporan-bulanan?bulan=${bulan}&format=${format}`
  window.open(url, '_blank')
}
```

### Pattern 6: IDOR Guard untuk Puskesmas

```typescript
// Source: dashboard.controller.ts + STATE.md decision 2026-07-03
// puskesmasId SELALU dari req.user!.userId — TIDAK PERNAH dari query param

const puskesmasId = req.user!.userId  // dari JWT (validated by authMiddleware)
```

### Anti-Patterns to Avoid

- **Pupeteer untuk PDF:** CLAUDE.md §Export melarang puppeteer secara eksplisit — gunakan pdfkit.
- **puskesmasId dari query param:** IDOR vulnerability — selalu dari JWT.
- **Direct Fonnte call:** Tidak ada WA notification di fase ini, tapi jika ditambahkan, WAJIB via BullMQ.
- **Menulis file ke disk:** ExcelJS dan pdfkit harus menggunakan in-memory buffer, bukan `writeFile()`. Lihat pattern `xlsx.writeBuffer()` dan `doc.on('data')`.
- **`catatanKonsultasi` dan `rekomendasiAi` di export:** Kolom ini terenkripsi (UU PDP No. 27/2022) dan TIDAK boleh dieksport ke Excel/PDF dalam bentuk plaintext maupun ciphertext. Sudah dikecualikan di rekap-harian.service.ts — lanjutkan pattern yang sama.

---

## e-PPGBM Column Format

> **Status: [ASSUMED] dari training knowledge** — tidak dapat diverifikasi dari sumber Kemenkes resmi dalam sesi ini (domain sigiziterpadu.gizi.kemkes.go.id tidak dapat diakses). Konfirmasi dengan instruktur sebelum implementasi, atau anggap sebagai "format e-PPGBM akademik" yang reasonable.

### Sheet 1: "Data Balita" (individual per pemeriksaan)

| # | Header | Source Field | Notes |
|---|--------|-------------|-------|
| 1 | No. | row index | Auto-increment |
| 2 | Nama Posyandu | Posyandu.namaPosyandu | safeCell() |
| 3 | Tanggal Pemeriksaan | Pemeriksaan.tanggalPemeriksaan | DD/MM/YYYY format |
| 4 | Nama Anak | Balita.namaBalita | safeCell() |
| 5 | NIK Anak | Balita.nikBalita | nullable → '' |
| 6 | Nama Orang Tua | Warga.namaLengkap | safeCell() |
| 7 | Tanggal Lahir | Balita.tanggalLahir | DD/MM/YYYY |
| 8 | Jenis Kelamin | Balita.jenisKelamin | 'L' / 'P' |
| 9 | Umur (bln) | computed via ageInMonths() | integer |
| 10 | BB (kg) | Pemeriksaan.beratBadan | nullable → '' |
| 11 | TB/PB (cm) | Pemeriksaan.tinggiBadan | nullable → '' |
| 12 | LILA (cm) | Pemeriksaan.lingkarLengan | nullable → '' |
| 13 | Z-Score BB/U | Pemeriksaan.zScoreBbU | toFixed(2) nullable → '' |
| 14 | Z-Score TB/U | Pemeriksaan.zScoreTbU | toFixed(2) nullable → '' |
| 15 | Z-Score BB/TB | Pemeriksaan.zScoreBbTb | toFixed(2) nullable → '' |
| 16 | Status Gizi BB/U | COALESCE(statusGiziOverride, statusGizi) | enum string |
| 17 | Kelurahan/Wilayah | Posyandu.kelurahan | safeCell() |

### Sheet 2: "Rekap Bulanan" (aggregate per posyandu)

| # | Header | Computation |
|---|--------|-------------|
| 1 | No. | row index |
| 2 | Nama Posyandu | Posyandu.namaPosyandu |
| 3 | Jml Diperiksa (D) | COUNT(antrian.statusAntrian='selesai' dengan pemeriksaan) |
| 4 | Gizi Buruk | COUNT(statusGizi='buruk') |
| 5 | Gizi Kurang | COUNT(statusGizi='kurang') |
| 6 | Gizi Normal | COUNT(statusGizi='normal') |
| 7 | Gizi Lebih/Obesitas | COUNT(statusGizi IN ('lebih','obesitas')) |
| 8 | Sangat Pendek | COUNT(statusGizi='sangat_pendek') |
| 9 | Pendek | COUNT(statusGizi='pendek') |

### PDF Ringkas Layout (A4 Portrait atau Landscape)

```
LAPORAN GIZI BALITA BULANAN
Puskesmas: [namaPuskesmas]    Periode: [bulan/tahun]
─────────────────────────────────────────────────────
No | Posyandu     | D | Buruk | Kurang | Normal | Lebih | Pendek | SP
─────────────────────────────────────────────────────
1  | Posyandu A   | 8 |   0   |   2   |   5   |   1  |   1   |  0
...
─────────────────────────────────────────────────────
TOTAL              |42 |   1   |  10   |  28   |   3  |   4   |  1

Dicetak oleh SISPOS pada [tanggal]
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel file generation | Custom CSV writer or string concat | `exceljs` (already installed) | Column types, frozen header, cell formatting |
| PDF generation | HTML template + puppeteer | `pdfkit` (already installed) | CLAUDE.md constraint; puppeteer butuh headless browser |
| Month date range | Manual date math | `parseBulan()` dari `dashboard.service.ts` | Helper sudah ada dan teruji |
| Age calculation | Manual arithmetic | `ageInMonths()` dari `zscore.ts` | Helper sudah ada dan dipakai di rekap-harian |
| Formula injection guard | None / missing | `safeCell()` dari `rekap-harian.service.ts` | Sudah ada; copy-paste langsung |

---

## Common Pitfalls

### Pitfall 1: ExcelJS writeBuffer Returns ArrayBuffer, Not Buffer
**What goes wrong:** `workbook.xlsx.writeBuffer()` mengembalikan `ArrayBuffer` di ExcelJS 4.x. `res.send(rawBuffer)` mengirim data corrupt.
**Why it happens:** Node.js Buffer ≠ ArrayBuffer. ExcelJS menggunakan Web Streams API internal.
**How to avoid:** Selalu wrap: `return Buffer.from(rawBuffer as ArrayBuffer)` — sudah dibuktikan di rekap-harian.service.ts.
**Warning signs:** Response content-length salah, file corrupt, Excel error "file is not valid".

### Pitfall 2: puskesmasId dari Query Param (IDOR)
**What goes wrong:** Endpoint menerima `?puskesmasId=xxx` dari client → puskesmas A bisa download laporan puskesmas B.
**Why it happens:** Convenience saat development; lupa IDOR guard.
**How to avoid:** `const puskesmasId = req.user!.userId` selalu. Jangan pernah `req.query.puskesmasId`.
**Warning signs:** Audit log kosong; pentest menemukan data crossing.

### Pitfall 3: catatanKonsultasi/rekomendasiAi di Export
**What goes wrong:** Kolom terenkripsi ikut ter-export ke Excel dalam format `iv:tag:ciphertext`.
**Why it happens:** Query `pemeriksaan.findMany` include semua kolom by default.
**How to avoid:** Gunakan `select: { ... }` eksplisit — JANGAN include `catatanKonsultasi` atau `rekomendasiAi`.
**Warning signs:** Kolom dengan nilai seperti `abcdef123:def456:...` panjang di Excel.

### Pitfall 4: Null Pemeriksaan (antrian tanpa pemeriksaan)
**What goes wrong:** Antrian `selesai` tidak punya baris `pemeriksaan` (kader lupa input di Meja 2). Flatmap → null error.
**Why it happens:** `Pemeriksaan.antrianId` adalah nullable. Ada antrian selesai tanpa pemeriksaan di schema.
**How to avoid:** Filter `antrian.pemeriksaan.length > 0` sebelum flatten, atau query dengan `pemeriksaan: { some: {} }` sebagai filter tambahan.
**Warning signs:** TypeScript error saat access `.beratBadan` pada undefined.

### Pitfall 5: Month Range End-of-Month UTC vs WIB
**What goes wrong:** Filter `tanggalPelaksanaan <= endOfMonth` melewatkan jadwal di tanggal terakhir bulan.
**Why it happens:** `new Date(year, month, 0, 23, 59, 59)` benar di local time; tapi PostgreSQL Prisma query di UTC. WIB = UTC+7, jadi midnight WIB = 17:00 UTC hari sebelumnya.
**How to avoid:** Gunakan `new Date(year, month, 1)` (awal bulan berikutnya) sebagai exclusive upper bound: `tanggalPelaksanaan: { lt: startOfNextMonth }`.
**Warning signs:** Data jadwal tanggal 31 tidak muncul di laporan bulan tersebut.

### Pitfall 6: window.open Blocked by Popup Blocker
**What goes wrong:** Browser memblok `window.open()` yang tidak dipanggil dari user gesture langsung.
**Why it happens:** `window.open` dari dalam `async` function setelah `await` dianggap tidak synchronous dengan user gesture.
**How to avoid:** Panggil `window.open()` langsung dari onClick handler (synchronous), bukan setelah `await`. Untuk Phase 5 ini straightforward — URL sudah diketahui dari state, tidak perlu async.
**Warning signs:** "Popup blocked" notification di browser; download tidak muncul.

---

## Code Examples

### Verified Pattern: Route Handler (puskesmas-scoped)

```typescript
// Based on: backend/src/modules/dashboard/dashboard.routes.ts (existing, verified)
import { Router } from 'express'
import type { Response } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { generateLaporanBulananXlsx, generateLaporanBulananPdf } from './laporan-bulanan.service'

export const laporanBulananRouter = Router()

const puskesmasAuth = [authMiddleware, requireRole('puskesmas')]

async function laporanBulananHandler(req: AuthRequest, res: Response): Promise<void> {
  const { bulan, format } = req.query as { bulan?: string; format?: string }

  if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: "Parameter 'bulan' wajib diisi dalam format YYYY-MM.",
    })
    return
  }
  if (!format || !['xlsx', 'pdf'].includes(format)) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: "Parameter 'format' harus 'xlsx' atau 'pdf'.",
    })
    return
  }

  const puskesmasId = req.user!.userId  // IDOR: selalu dari JWT

  try {
    if (format === 'xlsx') {
      const buffer = await generateLaporanBulananXlsx(puskesmasId, bulan)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="laporan-${bulan}.xlsx"`)
      res.send(buffer)
    } else {
      const buffer = await generateLaporanBulananPdf(puskesmasId, bulan)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="laporan-${bulan}.pdf"`)
      res.send(buffer)
    }
  } catch (err) {
    const e = err as { code?: string }
    const errorMap: Record<string, number> = {
      PUSKESMAS_TIDAK_DITEMUKAN: 404,
    }
    const status = errorMap[e.code ?? ''] ?? 500
    res.status(status).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: 'Gagal generate laporan. Coba lagi.',
    })
  }
}

laporanBulananRouter.get('/laporan-bulanan', ...puskesmasAuth, laporanBulananHandler)
```

### Verified Pattern: app.ts Registration

```typescript
// Extend existing registration di backend/src/app.ts
// TAMBAHKAN setelah baris: app.use('/api/reports', rekapHarianRouter)

import { laporanBulananRouter } from './modules/reports/laporan-bulanan.routes'

// OPSI A: Tambah router terpisah di path yang sama
app.use('/api/reports', laporanBulananRouter)
// → Endpoint final: GET /api/reports/laporan-bulanan?bulan=YYYY-MM&format=xlsx|pdf

// OPSI B: Extend rekapHarianRouter dengan route baru
// (tidak disarankan — coupling dua scope berbeda: kader dan puskesmas)
```

Rekomendasi: **Opsi A** — pisahkan router untuk separation of concerns (kader vs puskesmas scope).

### Verified Pattern: parseBulan Helper (reuse from dashboard.service.ts)

```typescript
// Source: backend/src/modules/dashboard/dashboard.service.ts (existing, verified)
// Copy-paste helper ini ke laporan-bulanan.service.ts (atau extract ke shared utils)

function parseBulan(bulan: string): { startOfMonth: Date; endOfNextMonth: Date } {
  const [year, month] = bulan.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  // Pitfall 5: gunakan lt startOfNextMonth, bukan lte endOfMonth
  const endOfNextMonth = new Date(year, month, 1)  // exclusive upper bound
  return { startOfMonth, endOfNextMonth }
}

// Query:
// tanggalPelaksanaan: { gte: startOfMonth, lt: endOfNextMonth }
```

### Verified Pattern: Frontend Download UI

```typescript
// Pattern: window.open dari onClick (synchronous — tidak blocked by popup blocker)
// Based on: frontend/src/pages/kader/RekapHarianPage.tsx (existing, verified)

function LaporanPage() {
  const [bulan, setBulan] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const handleDownload = (format: 'xlsx' | 'pdf') => {
    // Synchronous — harus dipanggil langsung dari onClick, bukan setelah await
    window.open(`/api/reports/laporan-bulanan?bulan=${bulan}&format=${format}`, '_blank')
  }

  return (
    // ... UI dengan <input type="month"> dan dua download button
    <input
      type="month"
      value={bulan}
      onChange={e => setBulan(e.target.value)}
      className="..."
    />
    <button onClick={() => handleDownload('xlsx')}>Download Excel (.xlsx)</button>
    <button onClick={() => handleDownload('pdf')}>Download PDF (.pdf)</button>
  )
}
```

---

## Existing Code to Reuse

### Phase 3 Patterns Already Tested (100% Reusable)

| Function/Pattern | Source File | Reuse in Phase 5 |
|-----------------|-------------|------------------|
| `safeCell(value)` | rekap-harian.service.ts | Copy-paste ke laporan-bulanan.service.ts |
| `formatTanggal(date)` | rekap-harian.service.ts | Copy-paste (DD/MM/YYYY WIB format) |
| pdfkit buffer collection via `doc.on('data'/'end')` | rekap-harian.service.ts | Identical pattern |
| `Buffer.from(rawBuffer as ArrayBuffer)` | rekap-harian.service.ts | WAJIB untuk ExcelJS writeBuffer |
| ExcelJS column definitions + frozen header | rekap-harian.service.ts | Adapt column list |
| Route handler try/catch + error map | rekap-harian.routes.ts | Identical structure |
| `requireRole('puskesmas')` middleware | dashboard.routes.ts | Copy-paste |

### Phase 4 Patterns Already Tested (Reusable for Query)

| Function/Pattern | Source File | Reuse in Phase 5 |
|-----------------|-------------|------------------|
| `parseBulan(bulan)` | dashboard.service.ts | Copy-paste + fix Pitfall 5 |
| Nested Prisma query: posyandu → jadwal → slotSesi → antrian → pemeriksaan | dashboard.service.ts | Extend with balita + warga includes |
| `puskesmasId = req.user!.userId` IDOR guard | dashboard.controller.ts | Identical pattern |

---

## What Already Exists vs What Needs Building

| Item | Status | Action |
|------|--------|--------|
| `backend/src/modules/reports/` directory | Exists | Add new files |
| `rekap-harian.routes.ts` | Complete (Phase 3) | No changes |
| `rekap-harian.service.ts` | Complete (Phase 3) | No changes |
| `laporan-bulanan.routes.ts` | MISSING | CREATE |
| `laporan-bulanan.service.ts` | MISSING | CREATE |
| app.ts: `app.use('/api/reports', laporanBulananRouter)` | MISSING | ADD 2 lines |
| `frontend/src/pages/puskesmas/LaporanPage.tsx` | Stub exists | REWRITE |
| Router route `/puskesmas/laporan` | Exists in router/index.tsx | No changes |
| PuskesmasLayout nav item "Laporan e-PPGBM" | Exists | No changes |
| ExcelJS + pdfkit packages | Installed | No install needed |

---

## Dependency on Phase 3

Phase 3 Plan 07 (rekap-harian) **COMPLETE** — confirmed by 03-07-SUMMARY.md (all tasks done, smoke test approved 2026-07-02). Phase 5 dapat berjalan **independent** karena:
1. Menggunakan file baru (`laporan-bulanan.*`) bukan mengubah file Phase 3
2. ExcelJS + pdfkit sudah installed oleh Phase 3
3. Tidak ada shared state yang perlu dikhawatirkan

Phase 5 tidak blocked oleh Phase 4 (04-04 checkpoint). Phase 5 hanya butuh: auth middleware (Phase 1 ✓), Prisma client (Phase 0 ✓), laporan data dari Pemeriksaan (Phase 3 ✓).

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Puppeteer-based PDF | pdfkit direct | CLAUDE.md constraint; pdfkit lebih ringan, tidak butuh headless browser |
| Server-side file save + download URL | In-memory Buffer + res.send() | Tidak perlu disk I/O; tidak ada file cleanup |
| excel4node / node-xlsx | ExcelJS | ExcelJS lebih mature untuk frozen header, cell styling, multiple sheets |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | e-PPGBM Sheet 1 kolom mencakup: No, Nama Posyandu, Tanggal Pemeriksaan, Nama Anak, NIK Anak, Nama Orang Tua, Tanggal Lahir, Jenis Kelamin, Umur (bln), BB, TB/PB, LILA, Z-Score BB/U, TB/U, BB/TB, Status Gizi BB/U | §e-PPGBM Column Format | Format tidak sesuai standar Kemenkes → laporan ditolak / nilai PSI berkurang |
| A2 | e-PPGBM Sheet 2 adalah rekap agregat per posyandu dengan kolom D, GL, N, GK, GB, Pendek, SP | §e-PPGBM Column Format | Format tidak sesuai → laporan tidak terima |
| A3 | PDF "ringkas" cukup dengan summary table per posyandu (tidak perlu individual rows di PDF) | §e-PPGBM Column Format | Instruktur/penguji mengharapkan individual rows di PDF juga |
| A4 | `input[type="month"]` cukup untuk month picker di LaporanPage — tidak perlu komponen calendar custom | §Code Examples | Browser support OK di Chrome/Edge; Firefox support baik; IE11 tidak relevan |

---

## Open Questions (RESOLVED)

1. **Format kolom e-PPGBM yang tepat**
   - What we know: Standard e-PPGBM Kemenkes punya laporan export Excel, tapi exact column list tidak dapat diverifikasi dari sumber otoritatif dalam sesi ini (sigiziterpadu.gizi.kemkes.go.id tidak dapat diakses)
   - What's unclear: Apakah ada template Excel resmi yang harus diikuti persis (header names, column order, sheet names)?
   - Recommendation: Konfirmasi dengan instruktur PSI — jika tidak ada template spesifik, gunakan kolom A1-A4 di Assumptions Log sebagai "format e-PPGBM akademik yang reasonable"
   - **RESOLVED:** Gunakan layout 17 kolom dari Assumptions Log sebagai "format e-PPGBM akademik yang reasonable" untuk konteks PSI. Jika instruktur mensyaratkan template spesifik, kolom dapat disesuaikan tanpa mengubah arsitektur service.

2. **Export kader rekap harian di scope Phase 5?**
   - What we know: Phase 3 Plan 07 sudah implement `rekap-harian` untuk kader. CLAUDE.md §Export menyebut "berlaku untuk kader (rekap harian) dan puskesmas (laporan bulanan)".
   - What's unclear: Apakah Phase 5 perlu tambah apa-apa untuk kader side, atau Phase 3 sudah cukup?
   - Recommendation: ROADMAP.md Phase 5 description hanya menyebut Puskesmas. Anggap kader rekap harian sudah done (Phase 3) — Phase 5 hanya laporan bulanan puskesmas.
   - **RESOLVED:** Phase 5 scope = laporan bulanan puskesmas only. Kader rekap harian sudah selesai di Phase 3 Plan 07 (03-07-PLAN.md). ROADMAP.md Phase 5 goal tidak menyebut kader.

3. **Nama Puskesmas di laporan header**
   - What we know: `Puskesmas` model punya `namaPuskesmas` field. Auth token hanya berisi `userId` (puskesmasId).
   - What's unclear: Perlu satu query tambahan ke `prisma.puskesmas.findUnique({ where: { id: puskesmasId }, select: { namaPuskesmas: true } })` untuk header laporan.
   - Recommendation: Tambahkan query ini di service function — lightweight, single-row lookup.
   - **RESOLVED:** Query `prisma.puskesmas.findUnique({ where: { id: puskesmasId }, select: { namaPuskesmas: true } })` ditambahkan di `generateLaporanBulananXlsx` dan `generateLaporanBulananPdf` sebelum data aggregation query. Diimplementasi di Plan 05-01 Task 2.

---

## Environment Availability

Tidak ada external dependencies baru untuk Phase 5. Semua dependency sudah ada dari Phase 0-4.

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| ExcelJS | xlsx export | ✓ | 4.4.0 | Installed Phase 3 |
| pdfkit | pdf export | ✓ | 0.15.0 | Installed Phase 3 |
| PostgreSQL | Data source | ✓ | 16 | Running via Docker |
| Prisma Client | ORM | ✓ | 5.15.0 | Active, migrated |
| Express backend | API | ✓ | 4.19.2 | Running |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `backend/vitest.config.ts` (exists) |
| Quick run command | `cd backend && npx vitest run --reporter verbose` |
| Full suite command | `cd backend && npx vitest run --reporter verbose` (same — no separation yet) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPORT-01 | `generateLaporanBulananXlsx` returns non-empty Buffer | unit | `npx vitest run src/modules/reports/__tests__/laporan-bulanan.test.ts -x` | ❌ Wave 0 |
| REPORT-01 | `generateLaporanBulananPdf` returns non-empty Buffer | unit | (same file) | ❌ Wave 0 |
| REPORT-01 | Route GET /api/reports/laporan-bulanan without auth → 401 | smoke | manual or integration | manual |
| REPORT-01 | Excel buffer parses as valid workbook (2 sheets) | unit | (same file, ExcelJS parse) | ❌ Wave 0 |

### Sampling Rate

- Per task commit: `cd backend && npx tsc --noEmit` (TypeScript check)
- Per wave merge: `cd backend && npx vitest run --reporter verbose`
- Phase gate: Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts` — covers REPORT-01 (unit test: mock Prisma, verify buffer non-empty + 2 sheets)
- [ ] No new framework install needed — vitest already configured

*(Note: Unit testing ExcelJS + pdfkit output is pragmatic: check buffer is non-empty Buffer, check workbook has correct sheet count. Full Excel content validation is better done via smoke test / manual download.)*

---

## Security Domain

`security_enforcement: true` dan `security_asvs_level: 1` di config.json.

### Applicable ASVS Categories (ASVS Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT httpOnly cookie — existing authMiddleware |
| V3 Session Management | no | Session managed by auth layer (existing) |
| V4 Access Control | yes | requireRole('puskesmas') + puskesmasId dari JWT (IDOR) |
| V5 Input Validation | yes | Validate `bulan` format YYYY-MM + `format` enum ['xlsx','pdf'] |
| V6 Cryptography | no | Tidak ada crypto baru; catatanKonsultasi/rekomendasiAi TIDAK diexport |

### Known Threat Patterns untuk Reports Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: download laporan puskesmas lain | Elevation of Privilege | puskesmasId dari JWT, bukan query param |
| Excel formula injection via namaBalita | Tampering | safeCell() prefix dengan `'` jika diawali =+-@ |
| Path traversal via format param | Tampering | Validate format ∈ ['xlsx','pdf'] — reject lainnya |
| Plaintext PDP data di export | Information Disclosure | Exclude catatanKonsultasi + rekomendasiAi dari query select |
| Unbounded report (semua data) | Denial of Service | Scope selalu per-bulan (1 bulan saja); acceptable per spec |

---

## Sources

### Primary (HIGH confidence — verified dari codebase)

- `backend/src/modules/reports/rekap-harian.service.ts` — ExcelJS + pdfkit pattern, safeCell(), buffer collection
- `backend/src/modules/dashboard/dashboard.service.ts` — parseBulan(), Prisma nested query puskesmas scope
- `backend/src/app.ts` — route registration pattern
- `backend/package.json` — verified ExcelJS 4.4.0, pdfkit 0.15.0
- `prisma/schema.prisma` — verified all model fields
- `.planning/phases/03-kader-5-meja/03-07-SUMMARY.md` — confirmed Phase 3 rekap-harian complete

### Secondary (MEDIUM confidence — dari ROADMAP + STATE + CLAUDE.md)

- `.planning/ROADMAP.md` — Phase 5 scope dan success criteria
- `.planning/STATE.md` — decisions log (puskesmasId dari JWT, window.open pattern)
- `CLAUDE.md` — tech stack constraints (ExcelJS, pdfkit, bukan puppeteer)

### Tertiary (LOW confidence — training knowledge, perlu validasi)

- e-PPGBM column format (A1-A4 di Assumptions Log) — dari training knowledge tentang sistem Kemenkes; tidak dapat diverifikasi langsung (sigiziterpadu.gizi.kemkes.go.id tidak dapat diakses)
- [Panduan e-PPGBM Scribd](https://www.scribd.com/document/783320893/Juknis-E-PPGBM) — referenced but content not accessible in session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — semua packages verified dari package.json; pattern teruji di Phase 3
- Architecture: HIGH — Prisma query pattern verified dari dashboard.service.ts; route pattern dari existing modules
- e-PPGBM column format: LOW — training knowledge only; sumber resmi tidak dapat diakses
- Pitfalls: HIGH — Pitfall 1-4 verified dari existing code comments + STATE.md decisions; Pitfall 5-6 dari well-known patterns

**Research date:** 2026-07-04
**Valid until:** 2026-08-04 (stack stable; e-PPGBM format assumption needs instructor confirmation)
