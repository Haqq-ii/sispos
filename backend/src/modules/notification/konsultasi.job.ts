/**
 * konsultasi.job.ts - BullMQ job data untuk WhatsApp ringkasan konsultasi Meja 4.
 */
export interface KonsultasiJobData {
  nomorPonsel: string
  namaBalita: string
  tanggalPemeriksaan: string
  ringkasan: string
  saranUtama: string
}

export const KONSULTASI_WA_JOB_NAME = 'konsultasi_whatsapp' as const