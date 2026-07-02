/**
 * queue-kader.test.ts — Moving average unit tests for selesaikanAntrian (Plan 03-07)
 *
 * Covers QUEUE-05: durasiRataAktual CMA formula verification.
 *
 * RED phase: tests fail because selesaikanAntrian is not yet exported
 *            from queue-kader.service.ts (Plan 03-07 adds it).
 * GREEN phase: tests pass after selesaikanAntrian implementation.
 *
 * Formula: n<=1 ? durasiLayanan : (oldAvg*(n-1)+durasiLayanan)/n
 * n = count of 'selesai' antrian in slot AFTER this update
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'

process.env.NODE_ENV = 'test'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../../config/db', () => ({
  prisma: {
    kader: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
}))

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../../antrian/antrian.service', () => ({
  broadcastQueueUpdate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../notification/notification.queue', () => ({
  notificationQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

// ── Imports after mocks ───────────────────────────────────────────────────

import { selesaikanAntrian } from '../queue-kader.service'
import { prisma } from '../../../config/db'
import { broadcastQueueUpdate } from '../../antrian/antrian.service'

const prismaMock = prisma as unknown as {
  kader: { findUnique: Mock }
  $transaction: Mock
}
const broadcastMock = broadcastQueueUpdate as unknown as Mock

// ── Fixtures ──────────────────────────────────────────────────────────────

const ANTRIAN_ID = 'antrian-uuid-0001'
const KADER_ID = 'kader-uuid-0001'
const SLOT_ID = 'slot-uuid-0001'
const POSYANDU_ID = 'posyandu-uuid-0001'

/**
 * setupTxMock — Configures prismaMock.$transaction to call fn with a fresh tx mock.
 * Returns the tx mock so tests can assert on tx.slotSesi.update calls etc.
 */
function setupTxMock({
  statusAntrian = 'dipanggil',
  waktuMulaiLayanan = null as Date | null,
  selesaiCount = 1,
  oldDurasiRataAktual = null as number | null,
}: {
  statusAntrian?: string
  waktuMulaiLayanan?: Date | null
  selesaiCount?: number
  oldDurasiRataAktual?: number | null
} = {}) {
  type TxMock = {
    $queryRaw: Mock
    antrian: { update: Mock; count: Mock; findUnique: Mock }
    slotSesi: { findUnique: Mock; update: Mock }
  }

  const tx: TxMock = {
    // SELECT id, "statusAntrian", "slotId", "waktuMulaiLayanan" FROM antrian WHERE id = $1 FOR UPDATE
    $queryRaw: vi.fn().mockResolvedValue([
      {
        id: ANTRIAN_ID,
        statusAntrian,
        slotId: SLOT_ID,
        waktuMulaiLayanan,
      },
    ]),
    antrian: {
      // tx.antrian.update: set statusAntrian='selesai', waktuSelesai
      update: vi.fn().mockResolvedValue({}),
      // tx.antrian.count: count of 'selesai' antrian after update
      count: vi.fn().mockResolvedValue(selesaiCount),
      // tx.antrian.findUnique: IDOR guard — returns posyanduId via nested include
      findUnique: vi.fn().mockResolvedValue({
        slotSesi: { jadwal: { posyanduId: POSYANDU_ID } },
      }),
    },
    slotSesi: {
      // tx.slotSesi.findUnique: returns current durasiRataAktual
      findUnique: vi.fn().mockResolvedValue({ durasiRataAktual: oldDurasiRataAktual }),
      // tx.slotSesi.update: saves new durasiRataAktual (assertion target)
      update: vi.fn().mockResolvedValue({}),
    },
  }

  prismaMock.$transaction.mockImplementation(
    async (fn: (t: TxMock) => Promise<unknown>) => fn(tx)
  )

  return tx
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('selesaikanAntrian — moving average (QUEUE-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Default: kader found, posyanduId matches
    prismaMock.kader.findUnique.mockResolvedValue({ posyanduId: POSYANDU_ID })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── CMA formula tests ────────────────────────────────────────────────

  it('n=1: durasiRataAktual = 7.0 when first selesai with 7 min duration', async () => {
    const now = new Date('2026-07-02T08:07:00.000Z')
    vi.setSystemTime(now)
    const mulai = new Date(now.getTime() - 7 * 60 * 1000) // 7 min before now

    const tx = setupTxMock({
      waktuMulaiLayanan: mulai,
      selesaiCount: 1,
      oldDurasiRataAktual: null, // first selesai — no existing average
    })

    await selesaikanAntrian(ANTRIAN_ID, KADER_ID)

    // n=1 → newAvg = durasiLayananBaru = 7.0
    expect(tx.slotSesi.update).toHaveBeenCalledWith({
      where: { id: SLOT_ID },
      data: { durasiRataAktual: expect.closeTo(7.0, 5) },
    })
  })

  it('n=2: durasiRataAktual = 7.5 when second selesai with 8 min (oldAvg=7)', async () => {
    const now = new Date('2026-07-02T08:08:00.000Z')
    vi.setSystemTime(now)
    const mulai = new Date(now.getTime() - 8 * 60 * 1000) // 8 min before now

    const tx = setupTxMock({
      waktuMulaiLayanan: mulai,
      selesaiCount: 2,
      oldDurasiRataAktual: 7, // previous average from first selesai
    })

    await selesaikanAntrian(ANTRIAN_ID, KADER_ID)

    // n=2 → newAvg = (7 * 1 + 8) / 2 = 7.5
    expect(tx.slotSesi.update).toHaveBeenCalledWith({
      where: { id: SLOT_ID },
      data: { durasiRataAktual: expect.closeTo(7.5, 5) },
    })
  })

  it('n=3: durasiRataAktual = 8.0 when third selesai with 9 min (oldAvg=7.5)', async () => {
    const now = new Date('2026-07-02T08:09:00.000Z')
    vi.setSystemTime(now)
    const mulai = new Date(now.getTime() - 9 * 60 * 1000) // 9 min before now

    const tx = setupTxMock({
      waktuMulaiLayanan: mulai,
      selesaiCount: 3,
      oldDurasiRataAktual: 7.5, // previous average from n=2
    })

    await selesaikanAntrian(ANTRIAN_ID, KADER_ID)

    // n=3 → newAvg = (7.5 * 2 + 9) / 3 = (15 + 9) / 3 = 8.0
    expect(tx.slotSesi.update).toHaveBeenCalledWith({
      where: { id: SLOT_ID },
      data: { durasiRataAktual: expect.closeTo(8.0, 5) },
    })
  })

  // ─── Error conditions ─────────────────────────────────────────────────

  it('throws ANTRIAN_BELUM_AKTIF when statusAntrian is not dipanggil (e.g. menunggu)', async () => {
    vi.setSystemTime(new Date('2026-07-02T08:00:00.000Z'))
    setupTxMock({ statusAntrian: 'menunggu' })

    await expect(selesaikanAntrian(ANTRIAN_ID, KADER_ID)).rejects.toMatchObject({
      code: 'ANTRIAN_BELUM_AKTIF',
    })
  })

  it('throws ANTRIAN_BELUM_AKTIF when statusAntrian is selesai (double-selesai guard)', async () => {
    vi.setSystemTime(new Date('2026-07-02T08:00:00.000Z'))
    setupTxMock({ statusAntrian: 'selesai' })

    await expect(selesaikanAntrian(ANTRIAN_ID, KADER_ID)).rejects.toMatchObject({
      code: 'ANTRIAN_BELUM_AKTIF',
    })
  })

  // ─── Null waktuMulaiLayanan ───────────────────────────────────────────

  it('does NOT update durasiRataAktual when waktuMulaiLayanan is null', async () => {
    vi.setSystemTime(new Date('2026-07-02T08:10:00.000Z'))
    const tx = setupTxMock({
      waktuMulaiLayanan: null, // no checkin time recorded
      selesaiCount: 1,
      oldDurasiRataAktual: null,
    })

    await selesaikanAntrian(ANTRIAN_ID, KADER_ID)

    // antrian.update should still be called (set statusAntrian='selesai')
    expect(tx.antrian.update).toHaveBeenCalledOnce()
    // slotSesi.update must NOT be called (no valid durasi)
    expect(tx.slotSesi.update).not.toHaveBeenCalled()
  })

  // ─── Broadcast verification ───────────────────────────────────────────

  it('calls broadcastQueueUpdate exactly once per selesaikanAntrian call', async () => {
    const now = new Date('2026-07-02T08:05:00.000Z')
    vi.setSystemTime(now)
    const mulai = new Date(now.getTime() - 5 * 60 * 1000)

    setupTxMock({ waktuMulaiLayanan: mulai, selesaiCount: 1 })

    await selesaikanAntrian(ANTRIAN_ID, KADER_ID)

    expect(broadcastMock).toHaveBeenCalledOnce()
    expect(broadcastMock).toHaveBeenCalledWith(SLOT_ID)
  })

  it('broadcastQueueUpdate is NOT called when transaction throws', async () => {
    vi.setSystemTime(new Date('2026-07-02T08:00:00.000Z'))
    // statusAntrian='ditangguhkan' triggers ANTRIAN_BELUM_AKTIF → transaction throws
    setupTxMock({ statusAntrian: 'ditangguhkan' })

    await expect(selesaikanAntrian(ANTRIAN_ID, KADER_ID)).rejects.toBeDefined()
    expect(broadcastMock).not.toHaveBeenCalled()
  })
})
