# Phase 05: Reports & Export — Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/src/modules/reports/laporan-bulanan.routes.ts` | route | request-response | `backend/src/modules/reports/rekap-harian.routes.ts` | exact |
| `backend/src/modules/reports/laporan-bulanan.service.ts` | service | batch / file-I/O | `backend/src/modules/reports/rekap-harian.service.ts` | exact |
| `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts` | test | — | `backend/src/modules/growth/__tests__/growth.test.ts` | role-match |
| `backend/src/app.ts` (2 line addition) | config | — | `backend/src/app.ts` (lines 19, 74 as pattern) | exact |
| `frontend/src/pages/puskesmas/LaporanPage.tsx` | component | request-response | `frontend/src/pages/puskesmas/PuskesmasDashboardPage.tsx` | exact |
| `frontend/src/hooks/useLaporanBulanan.ts` | hook | request-response | `frontend/src/hooks/useJadwalList.ts` | role-match |

---

## Pattern Assignments

### `backend/src/modules/reports/laporan-bulanan.routes.ts` (route, request-response)

**Analog:** `backend/src/modules/reports/rekap-harian.routes.ts`

**Imports pattern** (lines 14–19):
```typescript
import { Router } from 'express'
import type { Response } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { generateLaporanBulananXlsx, generateLaporanBulananPdf } from './laporan-bulanan.service'
```

**Auth guard pattern** (line 23):
```typescript
const puskesmasAuth = [authMiddleware, requireRole('puskesmas')]
// Note: rekap-harian uses requireRole('kader', 'ketua_kader') — laporan-bulanan uses 'puskesmas'
```

**Core route handler pattern** (lines 31–86):
```typescript
export const laporanBulananRouter = Router()

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

  const puskesmasId = req.user!.userId  // IDOR guard: NEVER from query param

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

**Key difference from analog:** `slotId` param replaced by `bulan` (YYYY-MM); `kaderId` IDOR replaced by `puskesmasId`; error map uses `PUSKESMAS_TIDAK_DITEMUKAN` instead of kader/slot codes.

---

### `backend/src/modules/reports/laporan-bulanan.service.ts` (service, batch / file-I/O)

**Analog:** `backend/src/modules/reports/rekap-harian.service.ts`

**Imports pattern** (lines 18–23 of analog):
```typescript
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { prisma } from '../../config/db'
import { ageInMonths } from '../../shared/utils/zscore'
import pino from 'pino'

const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })
```

**safeCell helper** (lines 27–30 of analog — copy verbatim):
```typescript
function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? "'" + value : value
}
```

**formatTanggal helper** (lines 33–40 of analog — copy verbatim):
```typescript
function formatTanggal(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}
```

**parseBulan helper** (from `dashboard.service.ts` lines 23–28, but fix Pitfall 5 — use `lt` not `lte`):
```typescript
function parseBulan(bulan: string): { startOfMonth: Date; startOfNextMonth: Date } {
  const [year, month] = bulan.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const startOfNextMonth = new Date(year, month, 1)  // exclusive upper bound — avoids Pitfall 5
  return { startOfMonth, startOfNextMonth }
}
// Use: tanggalPelaksanaan: { gte: startOfMonth, lt: startOfNextMonth }
// NOT: lte endOfMonth — that misses records on last day of month
```

**Prisma aggregation query** (extending `dashboard.service.ts` lines 39–60):
```typescript
// IDOR: puskesmasId always from JWT parameter, never from client
const posyanduList = await prisma.posyandu.findMany({
  where: { puskesmasId },
  select: {
    id: true,
    namaPosyandu: true,
    kelurahan: true,
    rw: true,
    jadwal: {
      where: {
        tanggalPelaksanaan: { gte: startOfMonth, lt: startOfNextMonth },
      },
      select: {
        tanggalPelaksanaan: true,
        slotSesi: {
          select: {
            antrian: {
              where: { statusAntrian: 'selesai' },
              select: {
                pemeriksaan: {
                  select: {
                    beratBadan: true,
                    tinggiBadan: true,
                    lingkarLengan: true,
                    zScoreBbU: true,
                    zScoreTbU: true,
                    zScoreBbTb: true,
                    statusGizi: true,
                    statusGiziOverride: true,
                    tanggalPemeriksaan: true,
                    // DO NOT include: catatanKonsultasi, rekomendasiAi (encrypted, UU PDP)
                    balita: {
                      select: {
                        namaBalita: true,
                        nikBalita: true,
                        tanggalLahir: true,
                        jenisKelamin: true,
                        warga: { select: { namaLengkap: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
})
// Flatten: posyanduList → jadwal[] → slotSesi[] → antrian[] → pemeriksaan[]
// Filter: antrian items where pemeriksaan.length > 0 (Pitfall 4 guard)
```

**ExcelJS workbook pattern** (lines 95–153 of analog, adapted for 2 sheets):
```typescript
export async function generateLaporanBulananXlsx(puskesmasId: string, bulan: string): Promise<Buffer> {
  // ... (query above) ...

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SISPOS'
  workbook.created = new Date()

  // Sheet 1: "Data Balita" (individual rows)
  const sheet1 = workbook.addWorksheet('Data Balita')
  sheet1.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Posyandu', key: 'namaPosyandu', width: 20 },
    { header: 'Tanggal Pemeriksaan', key: 'tanggalPemeriksaan', width: 18 },
    { header: 'Nama Anak', key: 'namaBalita', width: 22 },
    { header: 'NIK Anak', key: 'nikBalita', width: 18 },
    { header: 'Nama Orang Tua', key: 'namaOrangTua', width: 22 },
    { header: 'Tanggal Lahir', key: 'tanggalLahir', width: 14 },
    { header: 'JK', key: 'jenisKelamin', width: 5 },
    { header: 'Umur (bln)', key: 'usiaBulan', width: 10 },
    { header: 'BB (kg)', key: 'beratBadan', width: 9 },
    { header: 'TB/PB (cm)', key: 'tinggiBadan', width: 10 },
    { header: 'LILA (cm)', key: 'lingkarLengan', width: 10 },
    { header: 'Z-Score BB/U', key: 'zScoreBbU', width: 13 },
    { header: 'Z-Score TB/U', key: 'zScoreTbU', width: 13 },
    { header: 'Z-Score BB/TB', key: 'zScoreBbTb', width: 14 },
    { header: 'Status Gizi BB/U', key: 'statusGizi', width: 16 },
    { header: 'Kelurahan/Wilayah', key: 'kelurahan', width: 18 },
  ]
  const h1 = sheet1.getRow(1)
  h1.font = { bold: true }
  h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
  sheet1.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  // Sheet 2: "Rekap Bulanan" (aggregate per posyandu)
  const sheet2 = workbook.addWorksheet('Rekap Bulanan')
  // ... aggregate columns ...

  const rawBuffer = await workbook.xlsx.writeBuffer()
  // CRITICAL: normalize ArrayBuffer → Buffer (Pitfall 1)
  return Buffer.from(rawBuffer as ArrayBuffer)
}
```

**pdfkit buffer pattern** (lines 181–293 of analog — identical stream collection):
```typescript
export async function generateLaporanBulananPdf(puskesmasId: string, bulan: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text('Laporan Gizi Balita Bulanan', { align: 'center' })
  doc.moveDown(0.4)
  doc.fontSize(10).font('Helvetica').text(`Puskesmas: [namaPuskesmas]   Periode: [bulan]`, { align: 'center' })
  doc.moveDown(0.8)

  // Summary table per posyandu (manual X positioning — no pdf-table library)
  // ...

  doc.end()
  return bufferPromise
}
```

---

### `backend/src/modules/reports/__tests__/laporan-bulanan.test.ts` (test)

**Analog:** `backend/src/modules/growth/__tests__/growth.test.ts`

**Test file structure pattern** (lines 1–50 of analog):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// Set env before any imports
process.env.NODE_ENV = 'test'

// Mock prisma
vi.mock('../../../config/db', () => {
  const mockPrisma = {
    puskesmas: { findUnique: vi.fn() },
    posyandu: { findMany: vi.fn() },
  }
  return { prisma: mockPrisma }
})

// Mock env
vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
}))

// Mock pino
vi.mock('pino', () => ({
  default: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

// Mock ExcelJS (for unit test — avoid actual xlsx generation)
vi.mock('exceljs', () => {
  const Workbook = vi.fn(() => ({
    creator: '',
    created: null,
    addWorksheet: vi.fn(() => ({
      columns: [],
      getRow: vi.fn(() => ({ font: {}, fill: {} })),
      views: [],
      addRow: vi.fn(),
    })),
    xlsx: { writeBuffer: vi.fn(async () => new ArrayBuffer(8)) },
  }))
  return { default: { Workbook } }
})

// Mock pdfkit
vi.mock('pdfkit', () => {
  const PDFDocument = vi.fn(() => {
    const emitter: Record<string, ((...args: unknown[]) => void)[]> = {}
    return {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { (emitter[event] ??= []).push(cb) }),
      end: vi.fn(() => { emitter['end']?.forEach(cb => cb()) }),
      fontSize: vi.fn().mockReturnThis(),
      font: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      moveDown: vi.fn().mockReturnThis(),
    }
  })
  return { default: PDFDocument }
})

import { generateLaporanBulananXlsx, generateLaporanBulananPdf } from '../laporan-bulanan.service'

describe('generateLaporanBulananXlsx', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a non-empty Buffer for valid puskesmasId and bulan', async () => {
    // ... mock prisma.posyandu.findMany to return empty array ...
    const result = await generateLaporanBulananXlsx('puskesmas-id', '2026-01')
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('workbook has 2 sheets', async () => {
    // ... verify addWorksheet called twice ...
  })
})

describe('generateLaporanBulananPdf', () => {
  it('returns a non-empty Buffer', async () => {
    const result = await generateLaporanBulananPdf('puskesmas-id', '2026-01')
    expect(Buffer.isBuffer(result)).toBe(true)
  })
})
```

---

### `backend/src/app.ts` (2 line addition)

**Analog:** Existing import block (line 19) and route registration block (line 74) in `backend/src/app.ts`.

**Import line to add** (after line 19, following the same pattern):
```typescript
import { laporanBulananRouter } from './modules/reports/laporan-bulanan.routes'
```

**Route registration line to add** (after line 74 — the rekapHarianRouter line):
```typescript
// Reports: GET /api/reports/laporan-bulanan?bulan=YYYY-MM&format=xlsx|pdf (puskesmas laporan bulanan)
app.use('/api/reports', laporanBulananRouter)
```

**Exact insertion context** (lines 73–75 of current `app.ts`):
```typescript
// Reports: GET /api/reports/rekap-harian?slotId=&format=xlsx|pdf (kader download harian)
app.use('/api/reports', rekapHarianRouter)
// ADD THESE TWO LINES HERE ↓
import { laporanBulananRouter } from './modules/reports/laporan-bulanan.routes'  // top of file
app.use('/api/reports', laporanBulananRouter)  // after line 74
```

---

### `frontend/src/pages/puskesmas/LaporanPage.tsx` (component, request-response)

**Analog:** `frontend/src/pages/puskesmas/PuskesmasDashboardPage.tsx`

**Imports pattern** (lines 1–6 of analog):
```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, Download, AlertCircle } from 'lucide-react'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/useAuthStore'
```

**getBulanDefault helper** (lines 32–34 of analog — copy verbatim):
```typescript
function getBulanDefault(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}
```

**Green header pattern** (lines 87–102 of analog — adapt title/subtitle only):
```typescript
<div className="bg-[#008236] px-5 py-6">
  <div className="flex items-start justify-between mb-4">
    <div>
      <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Puskesmas</p>
      <h1 className="text-white font-bold text-xl leading-tight">Laporan e-PPGBM</h1>
      <p className="text-[#b9f8cf] text-xs mt-1">Ekspor laporan bulanan Kemenkes</p>
    </div>
    <input
      type="month"
      value={bulan}
      onChange={(e) => setBulan(e.target.value)}
      aria-label="Pilih bulan laporan"
      className="px-3 py-2 text-xs border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.15)] text-white rounded-[14px] focus:outline-none focus:bg-[rgba(255,255,255,0.25)]"
    />
  </div>
  {/* 2×2 stat grid — copy from PuskesmasDashboardPage lines 106–141 verbatim */}
</div>
```

**Stat boxes loading pattern** (lines 106–113 of analog — copy verbatim):
```typescript
{isLoading ? (
  <div className="grid grid-cols-2 gap-2">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-[rgba(255,255,255,0.15)] rounded-[14px] px-3 py-3 h-16 animate-pulse" />
    ))}
  </div>
) : (
  // stat boxes with real numbers
)}
```

**Download handler** (synchronous onClick — Pitfall 6 avoidance):
```typescript
const handleDownload = (format: 'xlsx' | 'pdf') => {
  // MUST be synchronous — called directly from onClick, not after await
  // Pitfall 6: window.open after await is blocked by popup blocker
  window.open(`/api/reports/laporan-bulanan?bulan=${bulan}&format=${format}`, '_blank', 'noopener,noreferrer')
}
```

**Format laporan card row** (from existing `LaporanPage.tsx` stub lines 16–24, rewritten functional):
```typescript
<div className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm p-5">
  <p className="text-[#6a7282] text-xs font-bold tracking-wider mb-3">FORMAT LAPORAN</p>
  <div className="space-y-2">
    <div className="flex items-center justify-between p-3 border border-[#f3f4f6] rounded-[14px]">
      <div className="flex items-center gap-3">
        <FileSpreadsheet size={16} className="text-[#008236]" />
        <div>
          <p className="text-[#364153] text-sm font-medium">Laporan e-PPGBM (.xlsx)</p>
          <p className="text-[#99a1af] text-xs">Data individual balita + rekap status gizi</p>
        </div>
      </div>
      <button
        onClick={() => handleDownload('xlsx')}
        className="flex items-center gap-1.5 text-[#008236] text-xs font-medium hover:text-[#00a63e]"
      >
        <Download size={14} />
        Unduh Excel
      </button>
    </div>
    {/* PDF row: same structure, FileText icon, format='pdf', "Unduh PDF" */}
  </div>
</div>
```

**Warning card** (from existing `LaporanPage.tsx` stub lines 29–33, repurposed):
```typescript
<div className="bg-[#fffbeb] border border-[#fef3c6] rounded-2xl p-4" role="note">
  <div className="flex items-center gap-2 mb-1">
    <AlertCircle size={14} className="text-[#973c00]" />
    <p className="text-[#973c00] text-xs font-semibold">Catatan Format e-PPGBM</p>
  </div>
  <p className="text-[#bb4d00] text-xs mt-1">
    Format kolom e-PPGBM mengacu pada standar Kemenkes (akademik)
  </p>
</div>
```

**Stats query** (reuse `GET /api/dashboard/stats` — same as PuskesmasDashboardPage, no new endpoint):
```typescript
// In LaporanPage — reuse existing dashboard stats endpoint, not a new one
const { data: stats, isLoading } = useQuery<DashboardStats>({
  queryKey: ['dashboard', 'stats', bulan],
  queryFn: () =>
    apiClient.get('/dashboard/stats', { params: { bulan } }).then((r) => r.data.data as DashboardStats),
  staleTime: 5 * 60 * 1000,
})
```

---

### `frontend/src/hooks/useLaporanBulanan.ts` (hook, request-response)

**Analog:** `frontend/src/hooks/useJadwalList.ts`

**Note:** Based on UI-SPEC review, `LaporanPage.tsx` reuses the existing `/api/dashboard/stats` endpoint (Phase 4) for its stat boxes — no new backend endpoint is needed for display. The `useLaporanBulanan` hook is therefore **optional**; the stat query can be inlined in the page (as done in `PuskesmasDashboardPage.tsx`). If extracted to a hook, follow this pattern:

```typescript
// frontend/src/hooks/useLaporanBulanan.ts
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/axios'

interface LaporanStats {
  totalPemeriksaan: number
  totalBalita: number
  breakdown: Record<string, number>
}

/**
 * Hook untuk LaporanPage — reuses GET /api/dashboard/stats (Phase 4 endpoint).
 * Download triggers are NOT queries — they use window.open() directly in onClick.
 */
export function useLaporanStats(bulan: string) {
  return useQuery<LaporanStats>({
    queryKey: ['dashboard', 'stats', bulan],  // shared key with PuskesmasDashboardPage
    queryFn: () =>
      apiClient
        .get('/dashboard/stats', { params: { bulan } })
        .then((r) => r.data.data as LaporanStats),
    staleTime: 5 * 60 * 1000,
  })
}
```

**Pattern source:** `frontend/src/hooks/useJadwalList.ts` (lines 1–16) and inline query in `PuskesmasDashboardPage.tsx` (lines 18–27).

---

## Shared Patterns

### Authentication + Role Guard
**Source:** `backend/src/modules/reports/rekap-harian.routes.ts` lines 16–23
**Apply to:** `laporan-bulanan.routes.ts`
```typescript
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'

const puskesmasAuth = [authMiddleware, requireRole('puskesmas')]
// Spread as middleware array: laporanBulananRouter.get('/laporan-bulanan', ...puskesmasAuth, handler)
```

### IDOR Guard (puskesmasId from JWT)
**Source:** `backend/src/modules/reports/rekap-harian.routes.ts` line 53 (kaderId pattern)
**Apply to:** `laporan-bulanan.routes.ts` handler, `laporan-bulanan.service.ts` function signature
```typescript
const puskesmasId = req.user!.userId  // NEVER from req.query or req.body
```

### Error Handling (routes)
**Source:** `backend/src/modules/reports/rekap-harian.routes.ts` lines 70–83
**Apply to:** `laporan-bulanan.routes.ts`
```typescript
} catch (err) {
  const e = err as { code?: string }
  const errorMap: Record<string, number> = { PUSKESMAS_TIDAK_DITEMUKAN: 404 }
  const status = errorMap[e.code ?? ''] ?? 500
  res.status(status).json({
    success: false,
    error: e.code ?? 'INTERNAL_ERROR',
    message: 'Gagal generate laporan. Coba lagi.',
  })
}
```

### Typed Error Throwing (service)
**Source:** `backend/src/modules/reports/rekap-harian.service.ts` lines 52–63
**Apply to:** `laporan-bulanan.service.ts` (for puskesmas not found)
```typescript
throw Object.assign(new Error('Puskesmas tidak ditemukan'), { code: 'PUSKESMAS_TIDAK_DITEMUKAN' })
```

### ExcelJS ArrayBuffer Normalization (CRITICAL)
**Source:** `backend/src/modules/reports/rekap-harian.service.ts` line 152
**Apply to:** `laporan-bulanan.service.ts` — every `xlsx.writeBuffer()` call
```typescript
const rawBuffer = await workbook.xlsx.writeBuffer()
return Buffer.from(rawBuffer as ArrayBuffer)  // WAJIB — ExcelJS returns ArrayBuffer in v4.x
```

### pdfkit Stream Collection
**Source:** `backend/src/modules/reports/rekap-harian.service.ts` lines 188–193
**Apply to:** `laporan-bulanan.service.ts` generateLaporanBulananPdf
```typescript
const chunks: Buffer[] = []
doc.on('data', (chunk: Buffer) => chunks.push(chunk))
const bufferPromise = new Promise<Buffer>((resolve, reject) => {
  doc.on('end', () => resolve(Buffer.concat(chunks)))
  doc.on('error', reject)
})
// ... doc content ...
doc.end()
return bufferPromise
```

### PDP Exclusion (UU No. 27/2022)
**Source:** `backend/src/modules/reports/rekap-harian.service.ts` line 13 (comment) + implicit in query
**Apply to:** `laporan-bulanan.service.ts` Prisma select — never include these fields:
```typescript
// DO NOT SELECT: catatanKonsultasi, rekomendasiAi
// These are encrypted at rest (UU PDP No. 27/2022) and MUST NOT appear in any export
```

### Frontend Month Picker + WIB Default
**Source:** `frontend/src/pages/puskesmas/PuskesmasDashboardPage.tsx` lines 32–34, 99–101
**Apply to:** `LaporanPage.tsx`
```typescript
function getBulanDefault(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7)
}
// <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} ... />
```

### Vitest Mock Structure
**Source:** `backend/src/modules/growth/__tests__/growth.test.ts` lines 19–45
**Apply to:** `laporan-bulanan.test.ts`
```typescript
// Order: vi.mock() calls BEFORE import of the module under test
vi.mock('../../../config/db', () => ({ prisma: { posyandu: { findMany: vi.fn() }, ... } }))
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' } }))
vi.mock('pino', () => ({ default: () => ({ debug: vi.fn(), error: vi.fn() }) }))
// Then: import { generateLaporanBulananXlsx } from '../laporan-bulanan.service'
```

---

## No Analog Found

None. All 6 files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `backend/src/modules/reports/`, `backend/src/modules/dashboard/`, `backend/src/modules/growth/__tests__/`, `frontend/src/pages/puskesmas/`, `frontend/src/hooks/`, `backend/src/app.ts`
**Files scanned:** 8 files read directly
**Pattern extraction date:** 2026-07-04
