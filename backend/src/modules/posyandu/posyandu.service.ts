import { prisma } from '../../config/db'

/**
 * getPosyanduList — Kembalikan daftar posyandu milik puskesmas tertentu.
 *
 * D-08: Dropdown hanya menampilkan posyandu yang di-assign ke akun Puskesmas
 * (via Puskesmas.posyandu relation). Bukan semua posyandu di sistem.
 */
export async function getPosyanduList(puskesmasId: string) {
  return prisma.posyandu.findMany({
    where: { puskesmasId },
    select: {
      id: true,
      namaPosyandu: true,
      kelurahan: true,
      kecamatan: true,
    },
    orderBy: { namaPosyandu: 'asc' },
  })
}
