# SISPOS — Requirements v1

> Generated: 2026-06-30
> Source: CLAUDE.md spec + docs/ROADMAP.md + questioning session
> Tech stack: Fixed (lihat CLAUDE.md — tidak boleh diganti)

---

## v1 Requirements

### Infrastructure & Setup

- [ ] **INFRA-01**: Docker Compose 5 container (nginx, backend, frontend, db, redis) berjalan; `docker compose up --build` sukses; `curl http://localhost` response
- [ ] **INFRA-02**: Backend Express + Prisma + Socket.IO + Redis + BullMQ terhubung; `GET /api/health` return 200 dengan status semua service
- [ ] **INFRA-03**: Frontend React + Vite berjalan di container; PWA manifest valid; semua route placeholder bisa diakses
- [ ] **INFRA-04**: Prisma schema ter-migrate dari `prisma/schema.prisma`; semua 14 model + tabel ada di database; `npx prisma studio` bisa dibuka

### Authentication & Wilayah

- [ ] **AUTH-01**: Citizen bisa register dengan NIK 16 digit + password + nomor HP; OTP dikirim ke WA via BullMQ; citizen bisa verifikasi OTP untuk aktivasi akun
- [ ] **AUTH-02**: Citizen bisa login dengan NIK + password; JWT httpOnly cookie di-set; redirect ke `/citizen/dashboard`
- [ ] **AUTH-03**: Kader bisa login dengan nomor HP + PIN 6 digit; redirect ke `/kader/dashboard`
- [ ] **AUTH-04**: Puskesmas bisa login dengan email + password; redirect ke `/puskesmas/dashboard`
- [ ] **AUTH-05**: Single gateway `POST /api/auth/login` mendeteksi role dari format identifier (NIK 16 digit → citizen, HP → kader, email → puskesmas)
- [ ] **AUTH-06**: Refresh token berfungsi; logout menghapus cookie; kader gagal PIN 10x → terkunci 30 menit
- [ ] **AUTH-07**: Data wilayah DIY + Jateng + Jatim terseed; dropdown Provinsi → Kabupaten → Kecamatan → Kelurahan berfungsi di frontend

### Queue System

- [ ] **QUEUE-01**: Puskesmas bisa membuat jadwal pelayanan untuk Posyandu; SlotSesi ter-generate otomatis dengan kuota `floor(60 / estimasiDurasiMenit)`
- [ ] **QUEUE-02**: Citizen bisa ambil antrian; `SELECT FOR UPDATE` aktif — 2 tab bersamaan di slot sisa 1 hanya 1 yang berhasil
- [ ] **QUEUE-03**: Nomor urut dikalkulasi otomatis; estimasi waktu tunggu menggunakan formula `jamMulai + (nomorUrut - 1) × durasiRata`; UI menampilkan "estimasi" bukan "jadwal pasti"
- [ ] **QUEUE-04**: Status antrian realtime via Socket.IO room `sesi:{slotId}`; countdown bergerak di client tanpa refresh halaman
- [ ] **QUEUE-05**: `durasiRataAktual` diupdate sebagai moving average setiap kader klik "Selesai" di Meja 5; broadcast ke semua client di room yang sama
- [ ] **QUEUE-06**: Notifikasi WhatsApp dikirim via BullMQ (bukan langsung ke Fonnte); retry 3x dengan exponential backoff (1s, 5s, 30s)

### Kader — 5 Meja

- [ ] **KADER-01**: Dashboard kader menampilkan antrian aktif; kader bisa mulai pelayanan; lock-screen per meja tersimpan di Redis (reload → tetap lock-screen)
- [ ] **KADER-02** *(Meja 1)*: Checklist kehadiran per RT/balita; kader bisa tandai Hadir / Tangguhkan; daftar manual go-show untuk balita baru
- [ ] **KADER-03** *(Meja 2)*: Numpad kustom input BB dan TB; validasi biologis (BB 0.5-30 kg, TB 40-130 cm) dengan konfirmasi; Z-Score BB/U, TB/U, BB/TB dikalkulasi dari tabel LMS WHO 2006 di `backend/src/shared/data/who-growth-tables.json`; AuditLog tertulis
- [ ] **KADER-04** *(Meja 3)*: Grafik Z-Score tampil otomatis dari data Meja 2; checkbox tanda klinis (rambut kemerahan, perut buncit, edema, pucat, lainnya) tersimpan ke DB; kader bisa override status gizi
- [ ] **KADER-05** *(Meja 4)*: GPT-4o early warning muncul dalam Bahasa Indonesia; Google Cloud STT id-ID bisa rekam suara → transkrip < 5 detik; catatan konsultasi dan rekomendasi AI dienkripsi sebelum simpan
- [ ] **KADER-06** *(Meja 5)*: Kader tandai "Selesai"; durasi aktual dihitung dari `waktuMulaiLayanan` ke `waktuSelesai`; `durasiRataAktual` diupdate; Socket.IO broadcast ke room `sesi:{slotId}`
- [ ] **KADER-07**: Setelah selesai pelayanan, halaman rekap harian tampil; kader bisa download rekap Excel (.xlsx) dan PDF

### Dashboard & DSS

- [ ] **DSS-01**: Dashboard Puskesmas menampilkan peta Leaflet + OpenStreetMap dengan cluster warna status gizi per kelurahan; filter bulan mengupdate peta tanpa reload
- [ ] **DSS-02**: Manajemen kader: daftar kader, status aktif/kunci, tombol "Buka Kunci" (reset `gagalLogin`, hapus `terkunciSampai`); AuditLog `MASTER_OVERRULE` tertulis

### AI Chatbot

- [ ] **AI-01**: AI Chatbot gizi: GPT-4o temperature 0.6, max_tokens 300; hanya jawab topik gizi balita/tumbuh kembang/imunisasi/posyandu; topik lain ditolak dengan pesan sopan Bahasa Indonesia; rate limit 20 pesan/hari per citizen
- [ ] **AI-02**: AI Chatbot pendaftaran antrian: GPT-4o temperature 0.4; 3 function calls aktif — `get_jadwal_tersedia`, `get_profil_balita`, `daftar_antrian`; `daftar_antrian` hanya dipanggil setelah konfirmasi eksplisit citizen
- [ ] **AI-03**: AI Chatbot pendaftaran diperluas: `batalkan_antrian` dan `reschedule_antrian` tersedia; kedua aksi ini WAJIB minta konfirmasi eksplisit citizen sebelum dieksekusi

### Reports & Export

- [x] **REPORT-01**: Laporan bulanan Puskesmas mengagregasi data pemeriksaan; export Excel (.xlsx) format e-PPGBM standar Kemenkes; export PDF ringkas; dihasilkan via ExcelJS + pdfkit (bukan puppeteer)

### PWA & Offline

- [ ] **PWA-01**: Service Worker via Workbox; input Meja 1-5 tersimpan ke IndexedDB saat offline; auto-sync ke server saat koneksi kembali; matikan internet → input Meja 2 → IndexedDB, online → tersync ke DB

### Seed Data

- [ ] **SEED-01**: `prisma/seed.wilayah.ts` — data wilayah DIY + Jateng + Jatim (PERTAMA dijalankan)
- [ ] **SEED-02**: `prisma/seed.ts` — >100 balita, >10 posyandu, riwayat pemeriksaan 12 bulan, campuran status gizi
- [ ] **SEED-03**: `prisma/seed.demo.ts` — akun presentasi terhubung ke seed massal; Citizen NIK `3471012345670001` (password `Demo1234!`), Kader HP `081234560001` (PIN `123456`), Puskesmas `demo@puskesmas-mergangsan.go.id` (password `Demo1234!`); antrian aktif hari ini tersedia saat login

### UI Alignment

- [ ] **UI-01**: Semua screen Citizen (Login, Register, Dashboard, Antrian, Chat) tampil visual sesuai Figma file `4DIazKntakgAGXBDYefjbD`; tidak ada spacing/warna/komponen yang berbeda signifikan dari design
- [ ] **UI-02**: Semua screen Kader (Dashboard, Lock-screen, Meja 1–5, Rekap Harian) dan Puskesmas (Dashboard, Peta Stunting, Manajemen Pengguna, Laporan) align ke Figma
- [ ] **UI-03**: Fitur yang belum optimal berfungsi baik end-to-end: countdown citizen realtime, grafik Z-Score Meja 3 terbaca, AI Chatbot respon Bahasa Indonesia; tidak ada console error di halaman manapun

---

## v2 Requirements (Deferred)

- Notifikasi "hampir dipanggil" push notification browser (Web Push API)
- Integrasi BPJS / SATU SEHAT API
- Multi-language support (selain Bahasa Indonesia)
- Admin super untuk manajemen multi-Puskesmas
- Kader bisa cancel jadwal pelayanan yang sudah terkunci

---

## Out of Scope (v1)

- **Multi-tenancy / SaaS** — satu instance, satu wilayah Puskesmas
- **Mobile native app** — PWA cukup untuk konteks akademik
- **Maps editing** — koordinat Posyandu statis, tidak perlu input manual
- **Laporan real-time streaming** — export batch cukup
- **2FA / MFA** — PIN kader + JWT citizen cukup

---

## Traceability

| Requirement | Phase | Plan |
|-------------|-------|------|
| INFRA-01..04 | Phase 0 | Wave 0.1, 0.2, 0.3, 0.4 |
| AUTH-01..07 | Phase 1 | Wave 1.1, 1.2, 1.3 |
| QUEUE-01..06 | Phase 2 | Wave 2.1, 2.2, 2.3 |
| KADER-01..07 | Phase 3 | Wave 3.1–3.7 |
| DSS-01..02 | Phase 4 | Wave 4.1, 4.2 |
| AI-01..03 | Phase 4 | Wave 4.3, 4.4 |
| REPORT-01 | Phase 5 | Wave 5.1 |
| PWA-01 | Phase 6 | Wave 6.1 |
| SEED-01..03 | Phase 7 | Wave 7.1, 7.2, 7.3 |
