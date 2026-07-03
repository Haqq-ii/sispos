/**
 * audit.service.ts — Business logic untuk audit log puskesmas
 *
 * Security (UU PDP No. 27/2022):
 *   - Hanya return AuditLog yang ditulis oleh puskesmas ini ATAU kader di bawah puskesmas ini
 *   - T-04-02-05: requireRole('puskesmas') di routes; scope server-side via kaderIds
 *   - T-04-02-06: kaderIds dihitung dari puskesmasId JWT — client tidak bisa inject puskesmasId lain
 */
import { prisma } from '../../config/db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  userId: string
  userRole: string
  aksi: string
  tabelTerkait: string | null
  recordId: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export interface AuditLogPage {
  data: AuditLogEntry[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ── getAuditLog ───────────────────────────────────────────────────────────────
// T-04-02-05: scope by puskesmasId — own actions + kader under this puskesmas
// T-04-02-06: kaderIds computed server-side, not from client

export async function getAuditLog(
  puskesmasId: string,
  page: number,
  limit: number
): Promise<AuditLogPage> {
  // Step 1: kumpulkan semua kaderIds di bawah puskesmas ini
  const kaderRecords = await prisma.kader.findMany({
    where: { posyandu: { puskesmasId } },
    select: { id: true },
  })
  const kaderIds = kaderRecords.map((k) => k.id)

  // Step 2: where clause — aksi puskesmas sendiri ATAU aksi kader di bawah puskesmas ini
  const where = {
    OR: [
      { userId: puskesmasId, userRole: 'puskesmas' as const },
      ...(kaderIds.length > 0 ? [{ userId: { in: kaderIds } }] : []),
    ],
  }

  // Step 3: query paginated + count
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        userRole: true,
        aksi: true,
        tabelTerkait: true,
        recordId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    data: data as AuditLogEntry[],
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}
