# SISPOS — GSD Roadmap

> 8 phases | 28 requirements | Horizontal Layers
> Tech stack: dikunci (lihat CLAUDE.md)
> Figma: `4DIazKntakgAGXBDYefjbD` — dipakai mulai Phase 0 untuk semua screen UI
> Deadline: 6-8 hari dari 2026-06-30 | Phase 0-3 KRITIS untuk laporan progres besok

---

## Phase Summary

| # | Phase | Goal | Requirements | Status |
|---|-------|------|-------------|--------|
| 0 | Infrastructure & Setup | 4/4 | Complete   | 2026-06-30 |
| 1 | Auth & Wilayah | 1/4 | In Progress|  |
| 2 | Queue System | Ambil antrian SELECT FOR UPDATE, countdown realtime Socket.IO | QUEUE-01..06 | ○ Pending |
| 3 | Kader — 5 Meja | Dashboard kader, lock-screen, 5 meja pelayanan, rekap + export | KADER-01..07 | ○ Pending |
| 4 | Dashboard & DSS + AI | Peta stunting Leaflet, manajemen kader, AI chatbot gizi + pendaftaran | DSS-01..02, AI-01..03 | ○ Pending |
| 5 | Reports & Export | Laporan bulanan e-PPGBM Excel + PDF via ExcelJS + pdfkit | REPORT-01 | ○ Pending |
| 6 | PWA & Offline | Service Worker Workbox, IndexedDB sync Meja 1-5, auto-sync online | PWA-01 | ○ Pending |
| 7 | Seed Data Demo | Seed wilayah → seed massal → seed akun demo presentasi | SEED-01..03 | ○ Pending |

---

### Phase 0: Infrastructure & Setup

**Goal:** Docker Compose 5 container running, struktur folder backend (modular monolith) + frontend (React/Vite/PWA) lengkap, Prisma schema ter-migrate ke PostgreSQL

**Success Criteria:**

1. `docker compose up --build` → semua 5 container running, tidak ada exit code 1
2. `curl http://localhost/api/health` → `{ success: true, data: { db: "connected", redis: "connected", socket: "ready" } }`
3. Browser buka `http://localhost` → halaman placeholder React muncul, tidak ada console error
4. `npx prisma studio` → semua 14 model tabel ada, bisa query
5. PWA manifest valid (Lighthouse PWA check hijau)

**Wave Structure:**

- Wave 0.1 — Docker Compose + struktur folder backend + frontend (dari Figma: tidak ada UI, pure infra)
- Wave 0.2 — Backend boilerplate: Express router, Prisma client, Socket.IO, Redis adapter, BullMQ
- Wave 0.3 — Frontend boilerplate: React Router v6, Zustand, TanStack Query, Tailwind + shadcn/ui, Workbox PWA
- Wave 0.4 — Prisma migrate dari `prisma/schema.prisma` yang sudah ada; seed wilayah minimal untuk development

**References:**

- `docs/ROADMAP.md` Wave 0.1–0.4
- Figma file key: `4DIazKntakgAGXBDYefjbD` (gunakan untuk semua placeholder UI)

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 00-01-PLAN.md — Prisma schema fix (4 bugs) + Docker Compose 5 container + Nginx + .env.example + .gitignore ✓ (6a8ce11, d8561b5)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 00-02-PLAN.md — Backend scaffold (Dockerfile, package.json, tsconfig) + config layer (env, db, redis, socket) + Express app + GET /api/health ✓ (59a687a, 78ca7d4)
- [x] 00-03-PLAN.md — Frontend scaffold (Dockerfile, package.json, Vite) + Tailwind + shadcn/ui + PWA manifest + React Router v6 + Zustand + placeholder pages ✓ (4a43aa7, 2cb56dc)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 00-04-PLAN.md — docker compose up --build + prisma migrate dev --name init + seed.minimal.ts wilayah seed + human verify all 5 success criteria

---

### Phase 1: Auth & Wilayah

**Goal:** Tiga role (Citizen, Kader, Puskesmas) bisa login dan diarahkan ke dashboard masing-masing; OTP WhatsApp via BullMQ; seed wilayah DIY + Jateng + Jatim lengkap

**Success Criteria:**

1. Register citizen NIK → OTP WA terkirim/fallback → verifikasi → status `terverifikasi`
2. Login NIK 16 digit → JWT cookie → redirect `/citizen/dashboard`
3. Login nomor HP → `/kader/dashboard`; Login email → `/puskesmas/dashboard`
4. Kader salah PIN 10x → akun terkunci 30 menit
5. Dropdown Provinsi → Kab → Kec → Kel berfungsi di frontend (data dari DB)

**Wave Structure:**

- Wave 1.1 — Register Citizen + OTP WA (BullMQ job) + verifikasi OTP + onboarding lokasi
- Wave 1.2 — Login single gateway + JWT httpOnly cookie + refresh token + logout
- Wave 1.3 — Seed wilayah DIY + Jateng + Jatim + endpoint dropdown wilayah

**Figma screens:** Login (Citizen/Kader/Puskesmas), Register, Verifikasi OTP, Pengaturan Lokasi, Lokasi dikonfirmasi

**References:**

- `docs/ROADMAP.md` Wave 1.1–1.3
- Figma frames: `5:5654`, `5:5731` (Login), `5:5809`, `5:5886` (Kader Login), `5:13077` (Puskesmas Login), `4:87`, `4:142` (Register), `5:1327` (OTP)

**Plans:** 1/4 plans executed

**Wave 1** *(register + OTP backend)*

- [x] 01-01-PLAN.md — Shared Zod schemas + BullMQ notification module + auth register/OTP/lokasi backend (9 files)

**Wave 2** *(login + wilayah seed + frontend register flow, all parallel after Wave 1)*

- [ ] 01-02-PLAN.md — Login single gateway + authMiddleware + Kader PIN lock + refresh/logout + LoginPage + RoleBadge + KaderLockScreen + ProtectedRoute
- [ ] 01-03-PLAN.md — seed.wilayah.ts DIY+Jateng+Jatim (1500+ records) + wilayah module 4 cascade GET endpoints *(checkpoint: human verify)*
- [ ] 01-04-PLAN.md — Frontend register flow: RegisterPage + VerifikasiOtpPage + OnboardingLokasiPage + LokasiDikonfirmasiPage + WilayahSelect + hooks *(depends_on: 01-01, 01-02)*

---

### Phase 2: Queue System

**Goal:** Citizen bisa ambil antrian dengan race condition guard; estimasi waktu tunggu adaptif; countdown bergerak realtime via Socket.IO

**Success Criteria:**

1. Puskesmas buat jadwal 7 menit/orang → 3 SlotSesi kuota 8 ter-generate otomatis
2. 2 tab bersamaan ambil slot sisa 1 → hanya 1 berhasil (test race condition)
3. Nomor antrian + estimasi waktu tampil di screen citizen
4. Kader tandai selesai → countdown citizen bergerak tanpa refresh
5. WA notifikasi terkirim via BullMQ (log queue visible)

**Wave Structure:**

- Wave 2.1 — Jadwal + SlotSesi (Puskesmas): buat jadwal, auto-create slot, kuota terhitung
- Wave 2.2 — Ambil antrian (Citizen): SELECT FOR UPDATE, nomor urut, estimasi, notif WA
- Wave 2.3 — Countdown realtime: Socket.IO room `sesi:{slotId}`, adaptif moving average

**Figma screens:** Citizen antrian flow — Pilih tanggal, Pilih sesi jam, Konfirmasi, Cetak antrian; Puskesmas manajemen jadwal

**References:**

- `docs/ROADMAP.md` Wave 2.1–2.3
- Figma frames: `5:2314` (Pilih tanggal), `5:2630` (Pilih sesi), `5:2902` (Konfirmasi), `5:3116` (Cetak), `5:15526` (Manajemen Jadwal)

---

### Phase 3: Kader — 5 Meja

**Goal:** Alur pelayanan kader end-to-end: dashboard monitoring → lock-screen meja → Meja 1 (hadir) → Meja 2 (BB/TB/Z-Score) → Meja 3 (grafik + klinis) → Meja 4 (AI + STT) → Meja 5 (selesai + trigger countdown) → rekap + export

**Success Criteria:**

1. Kader pilih meja → navbar hilang (lock-screen aktif), reload → tetap lock-screen
2. Meja 1: klik Hadir → status DB berubah, Socket.IO update countdown citizen
3. Meja 2: BB 8.5 kg → Z-Score terhitung dari tabel WHO 2006 + AuditLog; BB 85 kg → konfirmasi muncul
4. Meja 3: grafik Z-Score muncul dari data Meja 2; checkbox tanda klinis tersimpan ke DB
5. Meja 4: rekam suara → transkrip < 5 detik; AI early warning muncul Bahasa Indonesia; catatan tersimpan terenkripsi
6. Meja 5: klik Selesai → `durasiRataAktual` update, countdown citizen bergerak
7. Rekap harian: download .xlsx dan .pdf berhasil

**Wave Structure:**

- Wave 3.1 — Dashboard kader + lock-screen Redis + mulai pelayanan
- Wave 3.2 — Meja 1: checklist kehadiran per RT, hadir/tangguhkan, daftar manual
- Wave 3.3 — Meja 2: numpad BB/TB, validasi biologis, Z-Score WHO 2006, AuditLog
- Wave 3.4 — Meja 3: grafik Z-Score, checkbox tanda klinis, override status gizi
- Wave 3.5 — Meja 4: GPT-4o early warning + Google STT id-ID + enkripsi catatan
- Wave 3.6 — Meja 5: selesai + durasi aktual + moving average update + broadcast
- Wave 3.7 — Rekap harian kader + export Excel + PDF

**UI hint**: yes (Figma MCP wajib di setiap wave)

**Figma screens:** Dashboard kader, semua 5 meja, rekap harian

**References:**

- `docs/ROADMAP.md` Wave 3.1–3.7
- Figma frames: `5:9717` (Dashboard kader), `5:9785`, `5:9865` (Meja 2), `5:11874`, `5:11942` (Meja 5), `5:12010` (Imunisasi), `27:*` dan `2001:*` frames (Final screens)

---

### Phase 4: Dashboard & DSS + AI Chatbot

**Goal:** Peta stunting Leaflet untuk Puskesmas, manajemen kader + master overrule, AI Chatbot gizi citizen, AI Chatbot pendaftaran antrian dengan 3 function calls

**Success Criteria:**

1. Peta Leaflet menampilkan cluster warna status gizi per kelurahan; filter bulan update tanpa reload
2. Klik "Buka Kunci" kader → `gagalLogin` reset, `terkunciSampai` null, AuditLog `MASTER_OVERRULE` tertulis
3. Citizen tanya gizi → dijawab; tanya presiden → ditolak sopan; counter mencapai 20/hari → rate limited
4. Chat "mau daftar selasa jam 9" → AI tanya konfirmasi → citizen konfirmasi → antrian terdaftar di DB
5. Chat "mau batalkan antrian" → AI minta konfirmasi eksplisit → citizen konfirmasi → antrian dibatalkan

**Wave Structure:**

- Wave 4.1 — Dashboard Puskesmas + peta Leaflet stunting + filter bulan
- Wave 4.2 — Manajemen kader: daftar, status, overrule, AuditLog
- Wave 4.3 — AI Chatbot gizi citizen: GPT-4o temperature 0.6, guardrail, rate limit
- Wave 4.4 — AI Chatbot pendaftaran: 3 function calls (daftar/batalkan/reschedule), konfirmasi eksplisit

**Figma screens:** Puskesmas dashboard utama, manajemen pengguna, AI chatbot citizen

**References:**

- `docs/ROADMAP.md` Wave 4.1–4.4
- Figma frames: `5:13232` (Puskesmas Utama), `5:14204` (Manajemen Pengguna), `5:14838` (Reset PIN), `5:15180` (Blokir)

---

### Phase 5: Reports & Export

**Goal:** Puskesmas bisa generate laporan bulanan dan export ke format Excel e-PPGBM standar Kemenkes + PDF ringkas

**Success Criteria:**

1. Pilih bulan → data teragregasi benar (jumlah balita diperiksa, status gizi breakdown)
2. Download .xlsx dengan kolom e-PPGBM sesuai standar Kemenkes (100% format compliance)
3. Download .pdf ringkas dengan layout yang bersih
4. Export via ExcelJS + pdfkit (bukan puppeteer — sesuai constraint CLAUDE.md)

**Wave Structure:**

- Wave 5.1 — Laporan bulanan: agregasi query, ExcelJS template e-PPGBM, pdfkit layout

**Figma screens:** Puskesmas laporan e-PPGBM

**References:**

- `docs/ROADMAP.md` Wave 5.1
- Figma frames: `5:16705` (Laporan e-PPGBM)

---

### Phase 6: PWA & Offline

**Goal:** Aplikasi bisa dipakai tanpa internet di Posyandu (koneksi sering tidak stabil); data Meja 1-5 tersimpan IndexedDB dan auto-sync saat online

**Success Criteria:**

1. Matikan internet → input di Meja 2 (BB/TB) → tersimpan di IndexedDB, tidak error
2. Hidupkan internet → data auto-sync ke PostgreSQL tanpa tindakan manual
3. Service Worker Workbox teregister, cache assets utama untuk offline access
4. PWA bisa di-install di HP Android (install prompt muncul)

**Wave Structure:**

- Wave 6.1 — Service Worker Workbox + IndexedDB schema + sync queue + offline handling Meja 1-5

**References:**

- `docs/ROADMAP.md` Wave 6.1

---

### Phase 7: Seed Data Demo

**Goal:** Database berisi data yang cukup untuk presentasi dan pengujian penuh; akun demo siap login dan punya antrian aktif hari ini

**Success Criteria:**

1. `npx prisma db seed` (wilayah) → Prisma Studio: data wilayah tersedia sampai level kelurahan
2. `npx prisma db seed` (massal) → >100 balita, >10 posyandu, riwayat 12 bulan ada
3. Login Citizen NIK `3471012345670001` → dashboard dengan minimal 2 balita + countdown antrian aktif
4. Login Kader HP `081234560001` PIN `123456` → antrian siap dilayani hari ini
5. Login Puskesmas `demo@puskesmas-mergangsan.go.id` → dashboard dengan data statistik

**Wave Structure:**

- Wave 7.1 — `prisma/seed.wilayah.ts` (DIY + Jateng + Jatim)
- Wave 7.2 — `prisma/seed.ts` (massal: balita, posyandu, riwayat pemeriksaan)
- Wave 7.3 — `prisma/seed.demo.ts` (akun presentasi + antrian aktif hari ini)

**References:**

- `docs/ROADMAP.md` Wave 7.1–7.3
- CLAUDE.md § Seed Data

---

## Execution Notes

- **Phase 0-3 adalah PRIORITAS UTAMA** — laporan progres PSI besok
- **Figma dipakai di semua phase** yang ada UI — pull screenshot/design context sebelum implement setiap screen
- **AI chatbot (Phase 4)** scope lebih luas dari CLAUDE.md awal: 3 function calls termasuk batalkan + reschedule
- **Countdown = estimasi** — UI wajib menampilkan label "estimasi" bukan "jadwal pasti"
- **SELECT FOR UPDATE** di queue — jangan gunakan pendekatan lain untuk race condition
- **Enkripsi** `catatanKonsultasi` dan `rekomendasiAi` di application layer sebelum simpan ke DB
