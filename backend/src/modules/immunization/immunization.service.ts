/**
 * immunization.service.ts — Stub for Meja 3 imunisasi history + create
 *
 * AuditLog WAJIB dalam transaksi yang sama (CLAUDE.md §Keamanan).
 */
import pino from 'pino'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/db'
import { env } from '../../config/env'
import type { IncomingHttpHeaders } from 'http'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

export interface CreateImunisasiInput {
  balitaId: string
  namaVaksin: string
  dosisKe: number
  tanggalInjeksi: string
  keterangan?: string
}

export async function getImunisasiByBalita(balitaId: string) {
  return prisma.imunisasi.findMany({
    where: { balitaId },
    orderBy: { tanggalInjeksi: 'asc' },
  })
}

/**
 * getImunisasiForCitizen — Ambil semua riwayat imunisasi balita milik warga (citizen).
 *
 * Scoped ke wargaId dari JWT — tidak ada IDOR karena balita difilter via wargaId.
 * T-08-10-01: endpoint aman, data hanya milik citizen ybs.
 */
export async function getImunisasiForCitizen(wargaId: string) {
  // Fetch semua balita milik warga terlebih dahulu
  const balitaList = await prisma.balita.findMany({
    where: { wargaId },
    select: { id: true },
  })
  const balitaIds = balitaList.map((b) => b.id)
  if (balitaIds.length === 0) return []

  return prisma.imunisasi.findMany({
    where: { balitaId: { in: balitaIds } },
    orderBy: { tanggalInjeksi: 'asc' },
    select: {
      id: true,
      namaVaksin: true,
      dosisKe: true,
      tanggalInjeksi: true,
      keterangan: true,
    },
  })
}

export async function createImunisasi(
  data: CreateImunisasiInput,
  kaderId: string,
  meta: { headers: IncomingHttpHeaders; ip?: string }
) {
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const imunisasi = await tx.imunisasi.create({
      data: {
        balitaId: data.balitaId,
        kaderId,
        namaVaksin: data.namaVaksin,
        dosisKe: data.dosisKe,
        tanggalInjeksi: new Date(data.tanggalInjeksi),
        keterangan: data.keterangan ?? null,
      },
    })

    // AuditLog WAJIB dalam tx yang sama (CLAUDE.md §Keamanan)
    await tx.auditLog.create({
      data: {
        userId: kaderId,
        userRole: 'kader',
        aksi: 'CREATE_IMUNISASI',
        tabelTerkait: 'imunisasi',
        recordId: imunisasi.id,
        dataSebelum: Prisma.JsonNull,
        dataSesudah: {
          namaVaksin: data.namaVaksin,
          dosisKe: data.dosisKe,
          tanggalInjeksi: data.tanggalInjeksi,
        },
        ipAddress: meta.ip ?? null,
        userAgent: (meta.headers['user-agent'] as string | undefined) ?? null,
      },
    })

    return imunisasi
  })

  logger.info({ imunisasiId: result.id, kaderId }, 'Imunisasi berhasil disimpan')
  return result
}
