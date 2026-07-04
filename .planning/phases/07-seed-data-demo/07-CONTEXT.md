# Phase 7: Seed Data Demo - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Mengisi database dengan data yang cukup untuk presentasi dan pengujian penuh: wilayah DIY+Jateng+Jatim lengkap, 375-525 balita massal tersebar di 15 posyandu (3 Puskesmas), riwayat pemeriksaan 12-15 bulan dengan distribusi status gizi bertingkat per posyandu, dan akun demo siap login dengan antrian aktif hari ini. Tidak ada screen baru — hanya seed scripts dan konfigurasi `prisma db seed`.

</domain>

<decisions>
## Implementation Decisions

### Seed Orchestration
- **D-01:** `seed.ts` adalah orchestrator tunggal yang dipasang di `package.json` prisma.seed — `npx prisma db seed` menjalankan semua fase secara berurutan: wilayah → massal → demo → today
- **D-02:** Urutan eksekusi: `seed.wilayah.ts` → inline massal logic → `seed.demo.ts` → `seed.today.ts` (atau semua inline dalam `seed.ts` dengan fungsi terpisah per fase)
- **D-03:** Semua seed bersifat **idempotent via upsert** — aman dijalankan berkali-kali tanpa duplicate data, hanya update yang berubah
- **D-04:** `package.json` (backend) prisma block diupdate: tambah `"seed": "ts-node --project ./tsconfig.json ./prisma/seed.ts"`

### Data Massal — Posyandu & Puskesmas
- **D-05:** 3 Puskesmas: Puskesmas Mergangsan (demo), + 2 Puskesmas dummy (masing-masing 5 posyandu)
- **D-06:** Total 15 posyandu di bawah 3 Puskesmas, Puskesmas Mergangsan mendapat 5 posyandu termasuk "Posyandu Mawar" (demo)
- **D-07:** 375-525 balita total, 25-35 balita per posyandu (acak), semua tersebar realistis

### Data Massal — Distribusi Status Gizi (berbeda per posyandu)
- **D-08:** 3 posyandu "sehat": 80% normal, 10% kurang, 5% pendek, 5% lebih
- **D-09:** 4 posyandu "sedang": 60% normal, 25% kurang, 10% pendek, 5% buruk
- **D-10:** 3 posyandu "rawan": 40% normal, 30% kurang, 20% pendek, 10% buruk
- **D-11:** 3 posyandu "kritis": 30% normal, 25% kurang, 25% pendek, 15% buruk, 5% gizi buruk
- **D-12:** 2 posyandu "outlier": mayoritas lebih/obesitas (pola urban)
- **D-13:** Satu cluster RW di posyandu kritis dengan stunting >35% untuk demo peta sebaran yang dramatis (koordinat di kelurahan Mergangsan atau sekitarnya)

### Data Massal — Riwayat Pemeriksaan
- **D-14:** 12-15 bulan riwayat pemeriksaan per balita (acak), lookback dari hari ini
- **D-15:** 70-80% balita hadir tiap bulan; sisanya skip 1-2 bulan (realistis, bukan semua disiplin)
- **D-16:** Tren bervariasi: sebagian balita membaik (kurang → normal), sebagian memburuk (normal → kurang), sebagian stabil
- **D-17:** Nama balita dan ibu khas daerah posyandu masing-masing (nama Jawa/Yogyakarta)

### Data Massal — Imunisasi
- **D-18:** Seed massal include riwayat imunisasi dasar: BCG, Polio (1-4), DPT (1-3), Campak — sesuai jadwal usia balita masing-masing
- **D-19:** Tidak semua balita imunisasi lengkap (realistis: 70-80% lengkap, sisanya sebagian)

### Demo Account — Citizen Dewi Rahayu
- **D-20:** Tambah 1 balita ke-2 ke citizen Dewi Rahayu: usia 18-24 bulan, nama khas Jawa — total 2 balita (Budi Santoso + 1 baru)
- **D-21:** seed.demo.ts di-update via upsert untuk idempotency

### Demo Account — Jadwal & Antrian Hari Ini
- **D-22:** 4 sesi per jadwal hari ini: Sesi 1 (08:00–09:00), Sesi 2 (09:00–10:00), Sesi 3 (10:00–11:00), Sesi 4 (11:00–12:00)
- **D-23:** `estimasiDurasiMenit` = 10 menit → kuota per sesi = `floor(60/10)` = 6 orang
- **D-24:** Dewi Rahayu masuk Sesi 1, posisi ke-3 (nomorUrut 3); ada 2 antrian dummy sebelumnya di Sesi 1
- **D-25:** Semua antrian berstatus `menunggu`, `durasiRataAktual` flat 10 menit — **efek GoFood (countdown turun realtime) terjadi saat demo live** ketika kader tandai selesai di Meja 5
- **D-26:** Semua 4 sesi diisi antrian dummy (tidak hanya Sesi 1) agar dashboard kader terlihat penuh
- **D-27:** Antrian dummy menggunakan balita dari warga massal (bukan akun demo), agar data posyandu Mawar realistis

### Claude's Discretion
- NIK/field values spesifik untuk balita dan warga dummy — Claude generate realistis
- Angka pastinya (misal 375 vs 450 balita) dalam rentang 375-525 — Claude pilih angka round yang mudah di-generate
- Distribusi imunisasi per usia balita — ikuti jadwal Kemenkes standar
- Koordinat posyandu untuk Leaflet map — ambil dari data wilayah Mergangsan yang sudah terseed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Seed Files
- `prisma/seed.wilayah.ts` — 568 baris, wilayah DIY+Jateng+Jatim sudah ada, **jangan diubah isinya**; cukup dipanggil dari orchestrator
- `prisma/seed.demo.ts` — 111 baris, akun demo existing; perlu **diupdate**: tambah balita ke-2 + integrate antrian hari ini
- `prisma/seed.today.ts` — 138 baris, logic jadwal+slot+antrian hari ini; **merge ke seed.demo.ts** atau panggil dari orchestrator
- `prisma/seed.minimal.ts` — Phase 0 only, **jangan disentuh**

### Schema & Data Requirements
- `prisma/schema.prisma` — model Puskesmas, Posyandu, Warga, Balita, Kader, Jadwal, SlotSesi, Antrian, Pemeriksaan, Imunisasi, Wilayah — baca sebelum generate seed data
- `.planning/REQUIREMENTS.md` §Seed Data — SEED-01, SEED-02, SEED-03 (>100 balita, >10 posyandu, demo accounts)
- `backend/src/shared/data/who-growth-tables.json` — tabel LMS WHO untuk generate Z-Score pemeriksaan yang valid

### Queue & Schedule Logic
- `CLAUDE.md` §Antrian — formula estimasi `jamMulai + (nomorUrut - 1) × durasiRata`, kuota = `floor(60 / estimasiDurasiMenit)`
- `CLAUDE.md` §Seed Data — akun demo credentials yang wajib dipertahankan

### Backend Package Config
- `backend/package.json` — perlu tambah `"seed"` entry di `"prisma"` block

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prisma/seed.demo.ts` — pola upsert yang sudah proven; extend dengan tambah balita ke-2 + jadwal/antrian
- `prisma/seed.today.ts` — logic SlotSesi creation sudah handle `new Date(Date.UTC(1970, 0, 1, hour, 0, 0))` untuk @db.Time pitfall; reuse pattern ini
- `prisma/seed.wilayah.ts` — sudah ada `upsert`-style dengan `skipDuplicates`; referensi untuk pattern idempotent

### Established Patterns
- `bcrypt.hash('Demo1234!', ROUNDS)` dengan `ROUNDS = 10` sudah dipakai di seed.demo.ts — konsisten di semua seed files
- `new Date(Date.UTC(...))` untuk field `@db.Time` — wajib dipakai untuk `jamMulai`/`jamSelesai` SlotSesi
- WIB offset `+7h` pattern untuk menghitung `todayStart` sudah ada di seed.today.ts — reuse
- `prisma.balita.findFirst` + conditional create (bukan upsert) untuk balita — karena balita tidak punya unique field selain NIK

### Integration Points
- `package.json` `"prisma"` block — tambah `"seed"` key pointing ke `prisma/seed.ts`
- `seed.ts` orchestrator memanggil: `seedWilayah()` → `seedMassal()` → `seedDemo()` → `seedToday()` sebagai async functions
- Data massal posyandu harus include posyandu `id` yang bisa di-referensi seed.demo.ts untuk `posyanduUtamaId` warga demo

</code_context>

<specifics>
## Specific Ideas

- Jadwal hari ini: 4 sesi × 1 jam (08:00–09:00, 09:00–10:00, 10:00–11:00, 11:00–12:00) — ini standar pelayanan Posyandu Indonesia
- GoFood effect demo: semua antrian mulai sebagai `menunggu` → efek countdown turun terjadi live saat demo kader tandai selesai
- Cluster stunting dramatis di 1 RW untuk peta Leaflet — buat memorable untuk penguji
- Nama khas Jawa/Yogyakarta untuk data: Siti, Dewi, Sari, Budi, Andi, Rini, dst.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 08 — UI Figma Alignment:** Perbaikan keseluruhan design seluruh screen agar sesuai dengan Figma file `4DIazKntakgAGXBDYefjbD`, termasuk perbaikan cara kerja fitur yang belum optimal. Ini adalah phase tersendiri setelah Phase 07 selesai.
- Imunisasi riwayat yang lebih complex (booster, KIPI tracking) — cukup imunisasi dasar untuk v1
- Seed data untuk multi-puskesmas statistics comparison — belum ada requirement

</deferred>

---

*Phase: 7-seed-data-demo*
*Context gathered: 2026-07-04*
