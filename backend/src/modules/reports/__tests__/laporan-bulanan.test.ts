/**
 * laporan-bulanan.test.ts — Unit tests for laporan bulanan service (Plan 05-01)
 *
 * Tests:
 * - generateLaporanBulananXlsx: returns non-empty Buffer, 2 worksheets with correct names
 * - generateLaporanBulananPdf: returns non-empty Buffer
 * - safeCell: formula injection guard (prefix = + - @ with apostrophe)
 *
 * Uses vi.mock for ExcelJS, pdfkit, prisma, pino (no I/O in unit tests).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// Set env before any imports
process.env.NODE_ENV = 'test'

// ── Mock prisma ───────────────────────────────────────────────────────────
vi.mock('../../../config/db', () => {
  const mockPrisma = {
    puskesmas: { findUnique: vi.fn() },
    posyandu: { findMany: vi.fn() },
  }
  return { prisma: mockPrisma }
})

// ── Mock env ──────────────────────────────────────────────────────────────
vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
}))

// ── Mock pino ─────────────────────────────────────────────────────────────
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ── Mock ExcelJS ──────────────────────────────────────────────────────────
// Tracks addWorksheet calls for sheet-count and sheet-name assertions.
vi.mock('exceljs', () => {
  const Workbook = vi.fn(() => ({
    creator: '',
    created: null as Date | null,
    addWorksheet: vi.fn(() => ({
      columns: [] as unknown[],
      getRow: vi.fn(() => ({ font: {} as Record<string, unknown>, fill: {} as Record<string, unknown> })),
      views: [] as unknown[],
      addRow: vi.fn(),
    })),
    xlsx: { writeBuffer: vi.fn(async () => new ArrayBuffer(8)) },
  }))
  return { default: { Workbook } }
})

// ── Mock pdfkit ───────────────────────────────────────────────────────────
// Emits 'end' synchronously when doc.end() is called so the Promise resolves.
vi.mock('pdfkit', () => {
  const PDFDocument = vi.fn(() => {
    const emitter: Record<string, ((...args: unknown[]) => void)[]> = {}
    return {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        ;(emitter[event] ??= []).push(cb)
      }),
      end: vi.fn(() => {
        emitter['end']?.forEach((cb) => cb())
      }),
      fontSize: vi.fn().mockReturnThis(),
      font: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      moveDown: vi.fn().mockReturnThis(),
      moveTo: vi.fn().mockReturnThis(),
      lineTo: vi.fn().mockReturnThis(),
      strokeColor: vi.fn().mockReturnThis(),
      lineWidth: vi.fn().mockReturnThis(),
      stroke: vi.fn().mockReturnThis(),
      fillColor: vi.fn().mockReturnThis(),
      get y() { return 100 },
    }
  })
  return { default: PDFDocument }
})

// ── Import service after all mocks ────────────────────────────────────────
import { generateLaporanBulananXlsx, generateLaporanBulananPdf, safeCell } from '../laporan-bulanan.service'
import { prisma } from '../../../config/db'
import ExcelJS from 'exceljs'

// ── Typed mock accessors ──────────────────────────────────────────────────
const prismaMock = prisma as unknown as {
  puskesmas: { findUnique: Mock }
  posyandu: { findMany: Mock }
}

const ExcelJSMock = ExcelJS as unknown as { Workbook: Mock }

// ── Helpers ───────────────────────────────────────────────────────────────
const PUSKESMAS_ID = 'puskesmas-test-id'
const BULAN = '2026-07'

// ─────────────────────────────────────────────────────────────────────────
describe('generateLaporanBulananXlsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mocks
    prismaMock.puskesmas.findUnique.mockResolvedValue({ namaPuskesmas: 'Puskesmas Test' })
    prismaMock.posyandu.findMany.mockResolvedValue([])
    // Reset Workbook mock instance tracking
    ExcelJSMock.Workbook.mockClear()
  })

  it('returns a non-empty Buffer for valid puskesmasId and bulan', async () => {
    const result = await generateLaporanBulananXlsx(PUSKESMAS_ID, BULAN)
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('calls addWorksheet exactly twice', async () => {
    await generateLaporanBulananXlsx(PUSKESMAS_ID, BULAN)
    // Get the mock Workbook instance created by the service
    const workbookInstance = ExcelJSMock.Workbook.mock.results[0].value as {
      addWorksheet: Mock
    }
    expect(workbookInstance.addWorksheet).toHaveBeenCalledTimes(2)
  })

  it('first sheet is named Data Balita', async () => {
    await generateLaporanBulananXlsx(PUSKESMAS_ID, BULAN)
    const workbookInstance = ExcelJSMock.Workbook.mock.results[0].value as {
      addWorksheet: Mock
    }
    expect(workbookInstance.addWorksheet.mock.calls[0][0]).toBe('Data Balita')
  })

  it('second sheet is named Rekap Bulanan', async () => {
    await generateLaporanBulananXlsx(PUSKESMAS_ID, BULAN)
    const workbookInstance = ExcelJSMock.Workbook.mock.results[0].value as {
      addWorksheet: Mock
    }
    expect(workbookInstance.addWorksheet.mock.calls[1][0]).toBe('Rekap Bulanan')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('generateLaporanBulananPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.puskesmas.findUnique.mockResolvedValue({ namaPuskesmas: 'Puskesmas Test' })
    prismaMock.posyandu.findMany.mockResolvedValue([])
  })

  it('returns a non-empty Buffer', async () => {
    const result = await generateLaporanBulananPdf(PUSKESMAS_ID, BULAN)
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('safeCell — formula injection guard', () => {
  it("prefixes '=' with apostrophe", () => {
    expect(safeCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)")
  })

  it("prefixes '+' with apostrophe", () => {
    expect(safeCell('+A1')).toBe("'+A1")
  })

  it('leaves safe values unchanged', () => {
    expect(safeCell('Ahmad')).toBe('Ahmad')
  })
})
