/**
 * users.test.ts — Unit tests untuk users.service.ts
 *
 * Test suite:
 *   1. getKaderList — verifikasi where clause scoping ke puskesmasId
 *   2. unlockKader — IDOR guard (AKSES_DITOLAK)
 *   3. unlockKader — panggil $transaction saat IDOR guard lolos
 *   4. unlockKader — 404 saat kader tidak ditemukan (KADER_TIDAK_DITEMUKAN)
 *
 * Path note: test berada di backend/tests/ → satu level di atas backend/src/
 *   '../src/config/db'  → backend/src/config/db
 *   '../src/config/env' → backend/src/config/env
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db dan env SEBELUM import service (vi.mock di-hoist oleh vitest)
vi.mock('../src/config/db', () => ({
  prisma: {
    kader: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('../src/config/env', () => ({
  env: { NODE_ENV: 'test' },
}))

// Import setelah mock terdaftar
import { getKaderList, unlockKader } from '../src/modules/users/users.service'
import { prisma } from '../src/config/db'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PUSKESMAS_ID = 'puskesmas-test-123'
const OTHER_PUSKESMAS_ID = 'other-puskesmas-456'
const KADER_ID = 'kader-test-789'

const mockKaderSameOwner = {
  id: KADER_ID,
  namaLengkap: 'Siti Aminah',
  nomorPonsel: '081234567890',
  isAktif: true,
  isKetua: false,
  gagalLogin: 5,
  terkunciSampai: new Date('2026-07-03T15:00:00Z'),
  posyandu: { puskesmasId: PUSKESMAS_ID },
}

const mockKaderOtherOwner = {
  ...mockKaderSameOwner,
  posyandu: { puskesmasId: OTHER_PUSKESMAS_ID },
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Suite 1: getKaderList ─────────────────────────────────────────────────────

describe('getKaderList', () => {
  it('memanggil prisma.kader.findMany dengan where posyandu.puskesmasId yang benar', async () => {
    vi.mocked(prisma.kader.findMany).mockResolvedValue([])

    await getKaderList(PUSKESMAS_ID)

    expect(prisma.kader.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { posyandu: { puskesmasId: PUSKESMAS_ID } },
      })
    )
  })
})

// ── Suite 2: unlockKader ──────────────────────────────────────────────────────

describe('unlockKader', () => {
  it('throws AKSES_DITOLAK ketika kader.posyandu.puskesmasId tidak cocok dengan caller', async () => {
    vi.mocked(prisma.kader.findUnique).mockResolvedValue(mockKaderOtherOwner as any)

    await expect(
      unlockKader(KADER_ID, PUSKESMAS_ID, {})
    ).rejects.toMatchObject({ code: 'AKSES_DITOLAK' })

    // $transaction TIDAK boleh dipanggil setelah IDOR rejected
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('memanggil prisma.$transaction ketika IDOR guard lolos', async () => {
    vi.mocked(prisma.kader.findUnique).mockResolvedValue(mockKaderSameOwner as any)
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined)

    await unlockKader(KADER_ID, PUSKESMAS_ID, { ip: '127.0.0.1', userAgent: 'test-agent' })

    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })

  it('throws KADER_TIDAK_DITEMUKAN ketika prisma.kader.findUnique mengembalikan null', async () => {
    vi.mocked(prisma.kader.findUnique).mockResolvedValue(null)

    await expect(
      unlockKader('non-existent-kader', PUSKESMAS_ID, {})
    ).rejects.toMatchObject({ code: 'KADER_TIDAK_DITEMUKAN' })

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
