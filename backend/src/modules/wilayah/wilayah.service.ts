import { prisma } from '../../config/db'

/**
 * Mengembalikan daftar provinsi yang tersedia di tabel wilayah (distinct, sorted).
 */
export async function getProvinsi(): Promise<string[]> {
  const rows = await prisma.wilayah.findMany({
    distinct: ['provinsi'],
    select: { provinsi: true },
    orderBy: { provinsi: 'asc' },
  })
  return rows.map((r) => r.provinsi)
}

/**
 * Mengembalikan daftar kabupaten/kota berdasarkan provinsi (distinct, sorted).
 */
export async function getKabupaten(provinsi: string): Promise<string[]> {
  const rows = await prisma.wilayah.findMany({
    where: { provinsi },
    distinct: ['kabupaten'],
    select: { kabupaten: true },
    orderBy: { kabupaten: 'asc' },
  })
  return rows.map((r) => r.kabupaten)
}

/**
 * Mengembalikan daftar kecamatan berdasarkan kabupaten dan provinsi (distinct, sorted).
 */
export async function getKecamatan(kabupaten: string, provinsi: string): Promise<string[]> {
  const rows = await prisma.wilayah.findMany({
    where: { kabupaten, provinsi },
    distinct: ['kecamatan'],
    select: { kecamatan: true },
    orderBy: { kecamatan: 'asc' },
  })
  return rows.map((r) => r.kecamatan)
}

/**
 * Mengembalikan daftar kelurahan/desa berdasarkan kecamatan, kabupaten, dan provinsi (distinct, sorted).
 */
export async function getKelurahan(
  kecamatan: string,
  kabupaten: string,
  provinsi: string
): Promise<string[]> {
  const rows = await prisma.wilayah.findMany({
    where: { kecamatan, kabupaten, provinsi },
    distinct: ['kelurahan'],
    select: { kelurahan: true },
    orderBy: { kelurahan: 'asc' },
  })
  return rows.map((r) => r.kelurahan)
}
