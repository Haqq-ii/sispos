/**
 * users.service.ts — Business logic untuk manajemen kader oleh puskesmas
 *
 * Security (CLAUDE.md §Keamanan):
 *   - IDOR guard: unlockKader verifikasi kader.posyandu.puskesmasId === JWT puskesmasId
 *   - AuditLog MASTER_OVERRULE WAJIB ditulis dalam prisma.$transaction yang sama dengan kader.update
 *   - T-04-02-01: Spoofing via IDOR → throw AKSES_DITOLAK
 *   - T-04-02-02: AuditLog atomicity via $transaction
 */
import pino from 'pino'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/db'
import { env } from '../../config/env'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KaderListItem {
  id: string
  namaLengkap: string
  nomorPonsel: string
  isAktif: boolean
  isKetua: boolean
  gagalLogin: number
  terkunciSampai: Date | null
  posyandu: { id: string; namaPosyandu: string }
}

// ── getKaderList ──────────────────────────────────────────────────────────────

/**
 * Kembalikan semua kader yang berada di bawah puskesmasId dari JWT.
 * T-04-02-04: puskesmasId HANYA dari JWT — tidak pernah dari query params.
 */
export async function getKaderList(puskesmasId: string): Promise<KaderListItem[]> {
  const result = await prisma.kader.findMany({
    where: { posyandu: { puskesmasId } },
    include: {
      posyandu: { select: { id: true, namaPosyandu: true } },
    },
    orderBy: [{ posyandu: { namaPosyandu: 'asc' } }, { namaLengkap: 'asc' }],
  })
  return result as KaderListItem[]
}

// ── unlockKader ───────────────────────────────────────────────────────────────

/**
 * Reset PIN-lock kader + tulis AuditLog MASTER_OVERRULE dalam satu $transaction.
 *
 * T-04-02-01: IDOR guard — bandingkan posyandu.puskesmasId dengan JWT puskesmasId
 * T-04-02-02: atomicity — kader.update + auditLog.create dalam satu $transaction
 *
 * Alur:
 *   1. Load kader dengan include posyandu.puskesmasId
 *   2. Jika tidak ada → throw KADER_TIDAK_DITEMUKAN (404)
 *   3. IDOR guard: kader.posyandu.puskesmasId !== caller puskesmasId → throw AKSES_DITOLAK (403)
 *   4. $transaction: kader.update gagalLogin=0 terkunciSampai=null + auditLog.create MASTER_OVERRULE
 */
export async function unlockKader(
  kaderId: string,
  puskesmasId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<void> {
  // 1. Load kader with IDOR check data
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    include: { posyandu: { select: { puskesmasId: true } } },
  })

  // 2. Not found
  if (!kader) {
    throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  }

  // 3. IDOR guard — T-04-02-01
  if (kader.posyandu.puskesmasId !== puskesmasId) {
    throw Object.assign(new Error('Akses ditolak'), { code: 'AKSES_DITOLAK' })
  }

  const dataSebelum = {
    gagalLogin: kader.gagalLogin,
    terkunciSampai: kader.terkunciSampai,
  }

  // 4. Atomic transaction — T-04-02-02
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.kader.update({
      where: { id: kaderId },
      data: { gagalLogin: 0, terkunciSampai: null },
    })

    await tx.auditLog.create({
      data: {
        userId: puskesmasId,
        userRole: 'puskesmas',
        aksi: 'MASTER_OVERRULE',
        tabelTerkait: 'kader',
        recordId: kaderId,
        dataSebelum,
        dataSesudah: { gagalLogin: 0, terkunciSampai: null },
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    })
  })

  logger.info({ kaderId, puskesmasId }, 'Master overrule: kader unlocked')
}
