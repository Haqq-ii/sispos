/**
 * laporan-bulanan.test.ts — Unit tests for laporan bulanan service (Plan 05-01)
 *
 * Tests:
 * - generateLaporanBulananXlsx: returns non-empty Buffer, 2 worksheets with correct names
 * - generateLaporanBulananPdf: returns non-empty Buffer
 * - safeCell: formula injection guard (prefix = + - @ with apostrophe)
 *
 * Uses vi.mock for ExcelJS, pdfkit, prisma, pino (no I/O in unit tests).
 *
 * IMPORTANT: ExcelJS.Workbook and PDFDocument are called with `new`, so their vi.fn()
 * implementations MUST use `function` keyword (NOT arrow functions).
 * Arrow functions cannot be used as constructors and throw "is not a constructor" at runtime.
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
// MUST use `function` keyword — arrow functions cannot be used with `new`.
// The factory function returns an object, which JavaScript treats as the
// constructed instance when a constructor explicitly returns an object.
vi.mock('exceljs', () => {
  // Workbook constructor using regular function (required for `new` calls)
  const Workbook = vi.fn(function MockWorkbook() {
    return {
      creator: '' as string,
      created: null as Date | null,
      addWorksheet: vi.fn(function MockSheet() {
        return {
          columns: [] as unknown[],
          getRow: vi.fn(() => ({
            font: {} as Record<string, unknown>,
            fill: {} as Record<string, unknown>,
          })),
          views: [] as unknown[],
          addRow: vi.fn(),
        }
      }),
      xlsx: { writeBuffer: vi.fn(async () => new ArrayBuffer(8)) },
    }
  })
  return { default: { Workbook } }
})

// ── Mock pdfkit ───────────────────────────────────────────────────────────
// MUST use `function` keyword — arrow functions cannot be used with `new`.
// Emits 'data' then 'end' synchronously so bufferPromise resolves to non-empty Buffer.
vi.mock('pdfkit', () => {
  const PDFDocument = vi.fn(function MockPDFDocument() {
    const emitter: Record<string, ((...args: unknown[]) => void)[]> = {}
    return {
      on: vi.fn(function(event: string, cb: (...args: unknown[]) => void) {
        ;(emitter[event] ??= []).push(cb)
      }),
      end: vi.fn(function() {
        // Emit dummy PDF header bytes so Buffer.concat(chunks).length > 0
        emitter['data']?.forEach((cb) => cb(Buffer.from([0x25, 0x50, 0x44, 0x46]))) // %PDF
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

// ── Constants ─────────────────────────────────────────────────────────────
const PUSKESMAS_ID = 'puskesmas-test-id'
const BULAN = '2026-07'

// ─────────────────────────────────────────────────────────────────────────
describe('generateLaporanBulananXlsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.puskesmas.findUnique.mockResolvedValue({ namaPuskesmas: 'Puskesmas Test' })
    prismaMock.posyandu.findMany.mockResolvedValue([])
  })

  it('returns a non-empty Buffer for valid puskesmasId and bulan', async () => {
    const result = await generateLaporanBulananXlsx(PUSKESMAS_ID, BULAN)
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('calls addWorksheet exactly twice', async () => {
    await generateLaporanBulananXlsx(PUSKESMAS_ID, BULAN)
    // Get the Workbook instance returned by mock.results[0].value
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
