/**
 * growth.test.ts — TDD tests for growth module (Plan 03-02)
 *
 * Tests the service functions and utility integration:
 * - createPemeriksaan: Z-Score computation, validation, encryption, AuditLog
 * - getPemeriksaanHistory: sorted records
 *
 * RED phase: these tests fail because growth.service.ts does not exist yet.
 * GREEN phase: tests pass after implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// Set APP_ENCRYPTION_KEY before any module imports that call encrypt()
process.env.APP_ENCRYPTION_KEY = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd'
process.env.NODE_ENV = 'test'

// ── Mock prisma ───────────────────────────────────────────────────────────
vi.mock('../../../config/db', () => {
  const mockTx = {
    pemeriksaan: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  }
  const mockPrisma = {
    balita: { findUnique: vi.fn() },
    pemeriksaan: { findMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  }
  return { prisma: mockPrisma, __mockTx: mockTx }
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

// ── Import after mocks ────────────────────────────────────────────────────
import { createPemeriksaan, getPemeriksaanHistory } from '../growth.service'
import { prisma } from '../../../config/db'
import { computeZScore, ageInMonths, determineStatusGizi } from '../../../shared/utils/zscore'
import { encrypt } from '../../../shared/utils/encrypt'

// ── Typed mock accessors ──────────────────────────────────────────────────
const prismaMock = prisma as unknown as {
  balita: { findUnique: Mock }
  pemeriksaan: { findMany: Mock }
  $transaction: Mock
}

// ── Fixtures ──────────────────────────────────────────────────────────────
const KADER_ID = 'kader-uuid-0001'
const BALITA_ID = 'balita-uuid-0001'
const META = { headers: { 'user-agent': 'vitest' }, ip: '127.0.0.1' }

const BALITA_MALE_6M = {
  jenisKelamin: 'laki_laki' as const,
  tanggalLahir: new Date(Date.now() - 6 * 30.4375 * 24 * 60 * 60 * 1000), // ~6 months ago
}

// ── Utility Tests ─────────────────────────────────────────────────────────
describe('Z-Score utility (computeZScore)', () => {
  it('returns a finite number for 6-month male at 8.5 kg (WAZ)', () => {
    const z = computeZScore('wfa', 'laki_laki', 6, 8.5)
    expect(z).not.toBeNull()
    expect(isFinite(z!)).toBe(true)
    expect(isNaN(z!)).toBe(false)
  })

  it('returns a finite number for 6-month male at 70 cm (HAZ)', () => {
    const z = computeZScore('lhfa', 'laki_laki', 6, 70)
    expect(z).not.toBeNull()
    expect(isFinite(z!)).toBe(true)
  })

  it('L≈0 guard: does not produce NaN or Infinity', () => {
    const z = computeZScore('wfa', 'perempuan', 0, 3.2)
    if (z !== null) {
      expect(isFinite(z)).toBe(true)
      expect(isNaN(z)).toBe(false)
    }
  })
})

describe('ageInMonths', () => {
  it('computes ~6 months correctly', () => {
    const birth = new Date('2025-01-01')
    const exam = new Date('2025-07-01')
    const months = ageInMonths(birth, exam)
    expect(months).toBeGreaterThanOrEqual(5)
    expect(months).toBeLessThanOrEqual(6)
  })
})

describe('determineStatusGizi', () => {
  it('returns buruk when BB/U < -3', () => {
    expect(determineStatusGizi(-3.5, null, null)).toBe('buruk')
  })
  it('returns normal when all Z-Scores in range', () => {
    expect(determineStatusGizi(0, 0, 0)).toBe('normal')
  })
  it('returns kurang when BB/U < -2', () => {
    expect(determineStatusGizi(-2.5, -1.0, -1.0)).toBe('kurang')
  })
})

describe('encrypt utility', () => {
  it('returns iv:tag:ct format (3 parts separated by colon)', () => {
    const result = encrypt('test plaintext')
    const parts = result.split(':')
    expect(parts).toHaveLength(3)
    expect(parts[0].length).toBeGreaterThan(0) // IV hex
    expect(parts[1].length).toBeGreaterThan(0) // auth tag hex
    expect(parts[2].length).toBeGreaterThan(0) // ciphertext hex
  })

  it('does not contain the original plaintext', () => {
    const plaintext = 'catatan konsultasi sensitif UU PDP'
    const result = encrypt(plaintext)
    expect(result).not.toContain(plaintext)
  })
})

// ── Service Tests ─────────────────────────────────────────────────────────
describe('createPemeriksaan service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: balita found
    prismaMock.balita.findUnique.mockResolvedValue(BALITA_MALE_6M)

    // Default transaction: pemeriksaan.create returns a mock pemeriksaan
    prismaMock.$transaction.mockImplementation(async (fn: (tx: {
      pemeriksaan: { create: Mock }
      auditLog: { create: Mock }
    }) => Promise<unknown>) => {
      const tx = {
        pemeriksaan: {
          create: vi.fn().mockResolvedValue({
            id: 'pem-uuid-001',
            balitaId: BALITA_ID,
            kaderId: KADER_ID,
            beratBadan: 8.5,
            tinggiBadan: 70,
            zScoreBbU: 0.5,
            zScoreTbU: 0.3,
            zScoreBbTb: 0.1,
            statusGizi: 'normal',
            catatanKonsultasi: null,
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })
  })

  it('returns pemeriksaan with Z-Scores for valid input (8.5 kg, 70 cm, 6M male)', async () => {
    const result = await createPemeriksaan(
      { balitaId: BALITA_ID, beratBadan: 8.5, tinggiBadan: 70 },
      KADER_ID,
      META
    )
    expect(result).toBeDefined()
    expect(result.id).toBe('pem-uuid-001')
    // Z-Scores should be computed (the actual values come from the mocked pemeriksaan.create return)
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
  })

  it('throws BALITA_TIDAK_DITEMUKAN when balita not found', async () => {
    prismaMock.balita.findUnique.mockResolvedValue(null)
    await expect(
      createPemeriksaan({ balitaId: 'nonexistent', beratBadan: 8.5 }, KADER_ID, META)
    ).rejects.toMatchObject({ code: 'BALITA_TIDAK_DITEMUKAN' })
  })

  it('throws VALIDASI_BIOLOGIS_PERLU_KONFIRMASI when BB > 30 without konfirmasi header', async () => {
    await expect(
      createPemeriksaan(
        { balitaId: BALITA_ID, beratBadan: 85 },
        KADER_ID,
        { headers: {}, ip: '127.0.0.1' }
      )
    ).rejects.toMatchObject({ code: 'VALIDASI_BIOLOGIS_PERLU_KONFIRMASI' })
  })

  it('accepts BB > 30 when x-konfirmasi-biologis: true header is set', async () => {
    const result = await createPemeriksaan(
      { balitaId: BALITA_ID, beratBadan: 85 },
      KADER_ID,
      { headers: { 'x-konfirmasi-biologis': 'true' }, ip: '127.0.0.1' }
    )
    expect(result).toBeDefined()
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
  })

  it('stores catatanKonsultasi as encrypted (iv:tag:ct format) in DB, NOT plaintext', async () => {
    let storedCatatan: string | null = null

    prismaMock.$transaction.mockImplementation(async (fn: (tx: {
      pemeriksaan: { create: Mock }
      auditLog: { create: Mock }
    }) => Promise<unknown>) => {
      const tx = {
        pemeriksaan: {
          create: vi.fn().mockImplementation((args: { data: { catatanKonsultasi?: string } }) => {
            storedCatatan = args.data.catatanKonsultasi ?? null
            return Promise.resolve({ id: 'pem-uuid-001', balitaId: BALITA_ID, kaderId: KADER_ID, beratBadan: 8.5 })
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })

    await createPemeriksaan(
      { balitaId: BALITA_ID, beratBadan: 8.5, catatanKonsultasi: 'catatan sensitif' },
      KADER_ID,
      META
    )

    expect(storedCatatan).not.toBeNull()
    expect(storedCatatan).not.toBe('catatan sensitif')
    const parts = storedCatatan!.split(':')
    expect(parts).toHaveLength(3) // iv:tag:ct
  })

  it('calls auditLog.create in the same transaction as pemeriksaan.create', async () => {
    const auditLogCreate = vi.fn().mockResolvedValue({})
    const pemeriksaanCreate = vi.fn().mockResolvedValue({ id: 'pem-uuid-001', balitaId: BALITA_ID, kaderId: KADER_ID, beratBadan: 8.5 })

    prismaMock.$transaction.mockImplementation(async (fn: (tx: {
      pemeriksaan: { create: Mock }
      auditLog: { create: Mock }
    }) => Promise<unknown>) => {
      return fn({ pemeriksaan: { create: pemeriksaanCreate }, auditLog: { create: auditLogCreate } })
    })

    await createPemeriksaan(
      { balitaId: BALITA_ID, beratBadan: 8.5 },
      KADER_ID,
      META
    )

    expect(pemeriksaanCreate).toHaveBeenCalledOnce()
    expect(auditLogCreate).toHaveBeenCalledOnce()
    // Verify auditLog does NOT contain catatanKonsultasi
    const auditLogData = auditLogCreate.mock.calls[0][0].data
    expect(auditLogData.dataSesudah).not.toHaveProperty('catatanKonsultasi')
    expect(auditLogData.dataSesudah).not.toHaveProperty('rekomendasiAi')
  })
})

describe('getPemeriksaanHistory service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns records sorted by tanggalPemeriksaan asc', async () => {
    const mockHistory = [
      { id: '1', tanggalPemeriksaan: new Date('2025-01-01'), beratBadan: 6.0, zScoreBbU: -0.5 },
      { id: '2', tanggalPemeriksaan: new Date('2025-04-01'), beratBadan: 7.5, zScoreBbU: 0.1 },
    ]
    prismaMock.pemeriksaan.findMany.mockResolvedValue(mockHistory)

    const result = await getPemeriksaanHistory(BALITA_ID)
    expect(result).toHaveLength(2)
    expect(prismaMock.pemeriksaan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { balitaId: BALITA_ID },
        orderBy: { tanggalPemeriksaan: 'asc' },
      })
    )
  })
})
