/**
 * antrian.job.ts — Definisi interface dan konstanta untuk BullMQ antrian WA job.
 *
 * Mirrors pattern dari otp.job.ts (Phase 01).
 *
 * T-02-12 Mitigation: nomorPonsel diambil dari DB (warga.nomorPonsel) oleh service,
 * bukan dari request body citizen — attacker tidak bisa mengontrol nomor tujuan WA.
 *
 * CLAUDE.md §WhatsApp: SELALU enqueue ke BullMQ — jangan kirim langsung ke Fonnte.
 */

export interface AntrianJobData {
  /** Nomor ponsel tujuan WA — dari warga.nomorPonsel di DB (T-02-12) */
  nomorPonsel: string
  /** Nomor urut antrian (1-based) */
  nomorUrut: number
  /** Estimasi waktu tunggu dalam menit: nomorUrut × estimasiDurasiMenit (D-03) */
  estimasiMenit: number
  /** Nama posyandu untuk ditampilkan di pesan WA */
  namaPosyandu: string
  /** Tanggal pelaksanaan dalam format DD/MM/YYYY (WIB) */
  tanggalPelaksanaan: string
  /** Label sesi, misal: "Sesi 1 (08:00 - 09:00)" */
  labelSesi: string
}

export const ANTRIAN_WA_JOB_NAME = 'antrian_whatsapp' as const
