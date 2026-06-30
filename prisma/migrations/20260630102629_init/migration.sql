-- CreateEnum
CREATE TYPE "RolePengguna" AS ENUM ('citizen', 'kader', 'ketua_kader', 'puskesmas');

-- CreateEnum
CREATE TYPE "StatusVerifikasi" AS ENUM ('belum_verifikasi', 'terverifikasi', 'ditolak');

-- CreateEnum
CREATE TYPE "StatusJadwal" AS ENUM ('draft', 'terkunci', 'selesai', 'dibatalkan');

-- CreateEnum
CREATE TYPE "StatusAntrian" AS ENUM ('menunggu', 'dipanggil', 'selesai', 'ditangguhkan', 'tidak_hadir');

-- CreateEnum
CREATE TYPE "StatusGizi" AS ENUM ('normal', 'kurang', 'buruk', 'lebih', 'obesitas', 'pendek', 'sangat_pendek');

-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('laki_laki', 'perempuan');

-- CreateEnum
CREATE TYPE "TujuanOtp" AS ENUM ('registrasi', 'reset_password');

-- CreateTable
CREATE TABLE "puskesmas" (
    "id" TEXT NOT NULL,
    "namaPuskesmas" VARCHAR(200) NOT NULL,
    "alamat" TEXT NOT NULL,
    "nomorTelepon" VARCHAR(20),
    "wilayahKerja" VARCHAR(200),
    "email" VARCHAR(150) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puskesmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posyandu" (
    "id" TEXT NOT NULL,
    "puskesmasId" TEXT NOT NULL,
    "namaPosyandu" VARCHAR(200) NOT NULL,
    "provinsi" VARCHAR(100) NOT NULL,
    "kabupaten" VARCHAR(100) NOT NULL,
    "kecamatan" VARCHAR(100) NOT NULL,
    "kelurahan" VARCHAR(100) NOT NULL,
    "rw" VARCHAR(10) NOT NULL,
    "jamOperasional" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posyandu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warga" (
    "id" TEXT NOT NULL,
    "nikIbu" VARCHAR(16) NOT NULL,
    "namaLengkap" VARCHAR(200) NOT NULL,
    "nomorPonsel" VARCHAR(20) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "statusVerifikasi" "StatusVerifikasi" NOT NULL DEFAULT 'belum_verifikasi',
    "provinsi" VARCHAR(100),
    "kabupaten" VARCHAR(100),
    "kecamatan" VARCHAR(100),
    "kelurahan" VARCHAR(100),
    "rw" VARCHAR(10),
    "rt" VARCHAR(10),
    "posyanduUtamaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balita" (
    "id" TEXT NOT NULL,
    "wargaId" TEXT NOT NULL,
    "nikBalita" VARCHAR(16),
    "namaBalita" VARCHAR(200) NOT NULL,
    "tanggalLahir" DATE NOT NULL,
    "jenisKelamin" "JenisKelamin" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kader" (
    "id" TEXT NOT NULL,
    "posyanduId" TEXT NOT NULL,
    "namaLengkap" VARCHAR(200) NOT NULL,
    "nomorPonsel" VARCHAR(20) NOT NULL,
    "pinHash" TEXT NOT NULL,
    "isKetua" BOOLEAN NOT NULL DEFAULT false,
    "isAktif" BOOLEAN NOT NULL DEFAULT true,
    "gagalLogin" SMALLINT NOT NULL DEFAULT 0,
    "terkunciSampai" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal" (
    "id" TEXT NOT NULL,
    "posyanduId" TEXT NOT NULL,
    "puskesmasId" TEXT NOT NULL,
    "tanggalPelaksanaan" DATE NOT NULL,
    "estimasiDurasiMenit" SMALLINT NOT NULL DEFAULT 7,
    "statusJadwal" "StatusJadwal" NOT NULL DEFAULT 'draft',
    "dikunciPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jadwal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_sesi" (
    "id" TEXT NOT NULL,
    "jadwalId" TEXT NOT NULL,
    "nomorSesi" SMALLINT NOT NULL,
    "labelSesi" VARCHAR(50) NOT NULL,
    "jamMulai" TIME NOT NULL,
    "jamSelesai" TIME NOT NULL,
    "kuota" SMALLINT NOT NULL,
    "terisi" SMALLINT NOT NULL DEFAULT 0,
    "durasiRataAktual" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slot_sesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antrian" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "balitaId" TEXT NOT NULL,
    "wargaId" TEXT NOT NULL,
    "nomorUrut" SMALLINT NOT NULL,
    "isDaftarManual" BOOLEAN NOT NULL DEFAULT false,
    "statusAntrian" "StatusAntrian" NOT NULL DEFAULT 'menunggu',
    "waktuMulaiLayanan" TIMESTAMP(3),
    "waktuCheckin" TIMESTAMP(3),
    "waktuSelesai" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "antrian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pemeriksaan" (
    "id" TEXT NOT NULL,
    "antrianId" TEXT,
    "balitaId" TEXT NOT NULL,
    "kaderId" TEXT,
    "beratBadan" DOUBLE PRECISION,
    "tinggiBadan" DOUBLE PRECISION,
    "lingkarKepala" DOUBLE PRECISION,
    "lingkarLengan" DOUBLE PRECISION,
    "zScoreBbU" DOUBLE PRECISION,
    "zScoreTbU" DOUBLE PRECISION,
    "zScoreBbTb" DOUBLE PRECISION,
    "statusGizi" "StatusGizi",
    "catatanKonsultasi" TEXT,
    "rekomendasiAi" TEXT,
    "catatanKlinis" TEXT,
    "tandaKlinis" JSONB,
    "statusGiziOverride" "StatusGizi",
    "tanggalPemeriksaan" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pemeriksaan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imunisasi" (
    "id" TEXT NOT NULL,
    "balitaId" TEXT NOT NULL,
    "kaderId" TEXT,
    "namaVaksin" VARCHAR(100) NOT NULL,
    "dosisKe" SMALLINT NOT NULL DEFAULT 1,
    "tanggalInjeksi" DATE NOT NULL,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imunisasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp" (
    "id" TEXT NOT NULL,
    "nomorPonsel" VARCHAR(20) NOT NULL,
    "kodeOtp" VARCHAR(6) NOT NULL,
    "tujuan" "TujuanOtp" NOT NULL,
    "sudahDipakai" BOOLEAN NOT NULL DEFAULT false,
    "kedaluwarsaPada" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" "RolePengguna" NOT NULL,
    "aksi" VARCHAR(100) NOT NULL,
    "tabelTerkait" VARCHAR(100),
    "recordId" TEXT,
    "dataSebelum" JSONB,
    "dataSesudah" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wilayah" (
    "id" TEXT NOT NULL,
    "provinsi" VARCHAR(100) NOT NULL,
    "kabupaten" VARCHAR(100) NOT NULL,
    "kecamatan" VARCHAR(100) NOT NULL,
    "kelurahan" VARCHAR(100) NOT NULL,
    "kodePos" VARCHAR(10),

    CONSTRAINT "wilayah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_chat" (
    "id" TEXT NOT NULL,
    "wargaId" TEXT NOT NULL,
    "role" VARCHAR(10) NOT NULL,
    "pesan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_chat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puskesmas_email_key" ON "puskesmas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "warga_nikIbu_key" ON "warga"("nikIbu");

-- CreateIndex
CREATE UNIQUE INDEX "warga_nomorPonsel_key" ON "warga"("nomorPonsel");

-- CreateIndex
CREATE UNIQUE INDEX "balita_nikBalita_key" ON "balita"("nikBalita");

-- CreateIndex
CREATE UNIQUE INDEX "kader_nomorPonsel_key" ON "kader"("nomorPonsel");

-- CreateIndex
CREATE UNIQUE INDEX "jadwal_posyanduId_tanggalPelaksanaan_key" ON "jadwal"("posyanduId", "tanggalPelaksanaan");

-- CreateIndex
CREATE UNIQUE INDEX "slot_sesi_jadwalId_nomorSesi_key" ON "slot_sesi"("jadwalId", "nomorSesi");

-- CreateIndex
CREATE UNIQUE INDEX "antrian_slotId_balitaId_key" ON "antrian"("slotId", "balitaId");

-- CreateIndex
CREATE INDEX "otp_nomorPonsel_tujuan_idx" ON "otp"("nomorPonsel", "tujuan");

-- CreateIndex
CREATE INDEX "audit_log_userId_createdAt_idx" ON "audit_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_tabelTerkait_recordId_idx" ON "audit_log"("tabelTerkait", "recordId");

-- CreateIndex
CREATE INDEX "wilayah_provinsi_kabupaten_idx" ON "wilayah"("provinsi", "kabupaten");

-- CreateIndex
CREATE INDEX "wilayah_kecamatan_kelurahan_idx" ON "wilayah"("kecamatan", "kelurahan");

-- CreateIndex
CREATE INDEX "riwayat_chat_wargaId_createdAt_idx" ON "riwayat_chat"("wargaId", "createdAt");

-- AddForeignKey
ALTER TABLE "posyandu" ADD CONSTRAINT "posyandu_puskesmasId_fkey" FOREIGN KEY ("puskesmasId") REFERENCES "puskesmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warga" ADD CONSTRAINT "warga_posyanduUtamaId_fkey" FOREIGN KEY ("posyanduUtamaId") REFERENCES "posyandu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balita" ADD CONSTRAINT "balita_wargaId_fkey" FOREIGN KEY ("wargaId") REFERENCES "warga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kader" ADD CONSTRAINT "kader_posyanduId_fkey" FOREIGN KEY ("posyanduId") REFERENCES "posyandu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_posyanduId_fkey" FOREIGN KEY ("posyanduId") REFERENCES "posyandu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_puskesmasId_fkey" FOREIGN KEY ("puskesmasId") REFERENCES "puskesmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_sesi" ADD CONSTRAINT "slot_sesi_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "jadwal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antrian" ADD CONSTRAINT "antrian_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slot_sesi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antrian" ADD CONSTRAINT "antrian_balitaId_fkey" FOREIGN KEY ("balitaId") REFERENCES "balita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antrian" ADD CONSTRAINT "antrian_wargaId_fkey" FOREIGN KEY ("wargaId") REFERENCES "warga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pemeriksaan" ADD CONSTRAINT "pemeriksaan_antrianId_fkey" FOREIGN KEY ("antrianId") REFERENCES "antrian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pemeriksaan" ADD CONSTRAINT "pemeriksaan_balitaId_fkey" FOREIGN KEY ("balitaId") REFERENCES "balita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pemeriksaan" ADD CONSTRAINT "pemeriksaan_kaderId_fkey" FOREIGN KEY ("kaderId") REFERENCES "kader"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imunisasi" ADD CONSTRAINT "imunisasi_balitaId_fkey" FOREIGN KEY ("balitaId") REFERENCES "balita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imunisasi" ADD CONSTRAINT "imunisasi_kaderId_fkey" FOREIGN KEY ("kaderId") REFERENCES "kader"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_chat" ADD CONSTRAINT "riwayat_chat_wargaId_fkey" FOREIGN KEY ("wargaId") REFERENCES "warga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
