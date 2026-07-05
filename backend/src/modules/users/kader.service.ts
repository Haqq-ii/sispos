/**
 * kader.service.ts — Kader PIN verification service
 *
 * T-08-07-01 Mitigation: PIN value NEVER logged (pino calls omit pin parameter)
 * T-08-07-02 Mitigation: Endpoint protected by authMiddleware + requireRole(['kader','ketua_kader'])
 */
import bcrypt from 'bcrypt'
import { prisma } from '../../config/db'

/**
 * verifyKetuaPin — bcrypt-compares submitted PIN against the ketua_kader hash
 * for the same posyandu as the requesting kader.
 *
 * @param kaderId  - kader ID from JWT (never from request body)
 * @param pin      - raw 6-digit PIN string; never logged
 * @returns        { verified: boolean }
 * @throws Error with code 'KADER_TIDAK_DITEMUKAN' if kader record not found
 * @throws Error with code 'KETUA_TIDAK_DITEMUKAN' if no active ketua kader exists for posyandu
 */
export async function verifyKetuaPin(kaderId: string, pin: string): Promise<{ verified: boolean }> {
  // Step 1: Resolve posyanduId from kaderId (IDOR guard — kaderId always from JWT)
  const kaderRecord = await prisma.kader.findUnique({
    where: { id: kaderId },
    select: { posyanduId: true },
  })
  if (!kaderRecord) {
    const err = new Error('KADER_TIDAK_DITEMUKAN') as Error & { code: string }
    err.code = 'KADER_TIDAK_DITEMUKAN'
    throw err
  }

  // Step 2: Find active ketua kader for the same posyandu
  const ketua = await prisma.kader.findFirst({
    where: { posyanduId: kaderRecord.posyanduId, isKetua: true, isAktif: true },
    select: { pinHash: true },
  })
  if (!ketua) {
    const err = new Error('KETUA_TIDAK_DITEMUKAN') as Error & { code: string }
    err.code = 'KETUA_TIDAK_DITEMUKAN'
    throw err
  }

  // Step 3: bcrypt compare — PIN is NOT logged at any point
  const match = await bcrypt.compare(pin, ketua.pinHash)
  return { verified: match }
}
