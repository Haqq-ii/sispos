# SISPOS — Sistem Informasi Posyandu

## What This Is

SISPOS adalah Progressive Web App (PWA) untuk digitalisasi layanan Posyandu di Indonesia. Sistem ini mengelola antrian online dengan countdown queue adaptif berbasis kecepatan pelayanan riil, pencatatan kesehatan balita (BB/TB/Z-Score WHO 2006), Decision Support System deteksi risiko stunting dini, dan AI Chatbot yang bisa menjawab pertanyaan gizi sekaligus mendaftarkan antrian via percakapan. Target pengguna: Citizen (orang tua balita), Kader/Staff Posyandu, dan Puskesmas.

## Core Value

Antrian countdown adaptif yang bergerak realtime + alur 5 Meja kader yang berjalan end-to-end — ini yang harus bekerja sempurna di atas segalanya.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] [INFRA-01] Docker 5 container (nginx, backend, frontend, db, redis) berjalan dengan `docker compose up --build`
- [ ] [INFRA-02] Backend Express + Prisma + Socket.IO + Redis + BullMQ terhubung, `GET /health` return 200
- [ ] [INFRA-03] Frontend React + Vite + PWA manifest valid, semua route placeholder bisa diakses
- [ ] [INFRA-04] Prisma schema ter-migrate, semua tabel tersedia di database
- [ ] [AUTH-01] Citizen bisa register dengan NIK 16 digit, OTP via WhatsApp (BullMQ), verifikasi OTP
- [ ] [AUTH-02] Kader bisa login dengan nomor HP + PIN 6 digit
- [ ] [AUTH-03] Puskesmas bisa login dengan email + password
- [ ] [AUTH-04] Single gateway `/api/auth/login` mendeteksi role dari format identifier, redirect ke dashboard masing-masing
- [ ] [AUTH-05] JWT httpOnly cookie, refresh token, logout
- [ ] [AUTH-06] Data wilayah DIY + Jateng + Jatim terseed, dropdown Provinsi→Kab→Kec→Kel berfungsi
- [ ] [QUEUE-01] Puskesmas bisa buat jadwal pelayanan, SlotSesi auto-create dengan kuota terhitung
- [ ] [QUEUE-02] Citizen bisa ambil antrian dengan SELECT FOR UPDATE (race condition guard) — 2 tab bersamaan di slot sisa 1, hanya 1 berhasil
- [ ] [QUEUE-03] Nomor urut dan estimasi waktu tunggu dikalkulasi: `jamMulai + (nomorUrut - 1) × durasiRata`
- [ ] [QUEUE-04] Countdown bergerak realtime via Socket.IO room `sesi:{slotId}` tanpa refresh
- [ ] [QUEUE-05] `durasiRataAktual` diupdate sebagai moving average setiap antrian selesai di Meja 5
- [ ] [QUEUE-06] Notifikasi WhatsApp via BullMQ (retry 3x exponential backoff) saat ambil antrian
- [ ] [KADER-01] Dashboard kader: monitoring antrian aktif, mulai pelayanan, lock-screen per meja (Redis)
- [ ] [KADER-02] Meja 1: checklist kehadiran per RT, tandai hadir/tangguhkan, daftar manual go-show
- [ ] [KADER-03] Meja 2: numpad kustom BB/TB, validasi biologis, kalkulasi Z-Score WHO 2006 dari tabel LMS
- [ ] [KADER-04] Meja 3: grafik Z-Score otomatis dari data Meja 2, checkbox tanda klinis, override status gizi
- [ ] [KADER-05] Meja 4: GPT-4o early warning (Bahasa Indonesia), Google STT id-ID, enkripsi catatan konsultasi
- [ ] [KADER-06] Meja 5: tandai selesai, hitung durasi aktual, update moving average, broadcast Socket.IO
- [ ] [KADER-07] Rekap harian kader + export Excel (.xlsx) dan PDF setelah selesai pelayanan
- [ ] [DSS-01] Dashboard peta Leaflet stunting per kelurahan, filter bulan, cluster warna status gizi
- [ ] [DSS-02] Manajemen kader: daftar, status kunci, master overrule satu klik (reset gagalLogin), AuditLog
- [ ] [AI-01] AI Chatbot gizi citizen: GPT-4o temperature 0.6, hanya jawab gizi/balita/imunisasi/posyandu, rate limit 20 pesan/hari
- [ ] [AI-02] AI Chatbot pendaftaran antrian: 3 function calls — `daftar_antrian`, `batalkan_antrian` (konfirmasi eksplisit), `reschedule_antrian` (konfirmasi eksplisit)
- [ ] [REPORT-01] Laporan bulanan Puskesmas: agregasi data, export Excel e-PPGBM format standar Kemenkes + PDF ringkas
- [ ] [PWA-01] Offline-First via Workbox Service Worker, IndexedDB untuk input Meja 1-5, auto-sync saat online
- [ ] [SEED-01] Seed data massal: >100 balita, >10 posyandu, riwayat 12 bulan, campuran status gizi
- [ ] [SEED-02] Akun demo siap presentasi: Citizen NIK 3471012345670001, Kader HP 081234560001, Puskesmas demo@puskesmas-mergangsan.go.id

### Out of Scope

- Multi-tenancy / SaaS — satu instance untuk satu wilayah Puskesmas
- Push notification browser (Web Push API) — digantikan notif WhatsApp via Fonnte
- Mobile native app (Android/iOS) — PWA cukup untuk konteks akademik
- Integrasi BPJS / SATU SEHAT — fase selanjutnya post-akademik
- Maps editing / input koordinat Posyandu manual — data wilayah statis dari DB

## Context

- Proyek akademik untuk mata kuliah **Pengembangan Sistem Informasi (PSI)** — ada laporan progres dalam 1 hari, sidang dalam 6-8 hari
- Tech stack **dikunci** di CLAUDE.md — tidak boleh diganti (React/Vite/Express/Prisma/PostgreSQL/Redis/Socket.IO/BullMQ)
- Prisma schema **sudah final** di `prisma/schema.prisma` (14 model, semua enum terdefinisi)
- Roadmap 8 phase sudah ada di `docs/ROADMAP.md` — dipakai sebagai referensi wave
- Figma design **sudah lengkap** untuk semua 3 role — file key: `4DIazKntakgAGXBDYefjbD`
- Figma MCP sudah terhubung — dipakai mulai Phase 0 untuk semua screen UI
- AI boleh adjust desain Figma untuk konsistensi (warna, posisi) selama implementasi

## Constraints

- **Tech Stack**: Fixed sesuai CLAUDE.md — tidak ada negosiasi
- **Timeline**: 6-8 hari total; Phase 0-3 KRITIS untuk laporan besok
- **Database**: PostgreSQL 16, schema sudah ada — jangan redesign model yang sudah ada
- **Security**: UU PDP No. 27/2022 — kolom `catatanKonsultasi` dan `rekomendasiAi` WAJIB dienkripsi
- **AI Scope**: Chatbot gizi hanya jawab 4 topik; chatbot pendaftaran hanya 3 function calls dengan konfirmasi eksplisit untuk batalkan/reschedule
- **Queue**: Countdown adalah estimasi, bukan janji — UI harus jelas menyatakan ini
- **Figma**: Design sudah ada, implement as-is; AI boleh adjust untuk konsistensi

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Countdown = estimasi, bukan janji | UI responsibility — citizen harus tau ini perkiraan | — Pending |
| AI chatbot: 3 function calls (daftar/batalkan/reschedule) | Lebih powerful dari spec awal; batalkan & reschedule butuh konfirmasi eksplisit | — Pending |
| Figma dipakai dari Phase 0 (bukan Phase 3) | Desain sudah lengkap untuk semua screen — langsung pakai sebagai referensi implementasi | — Pending |
| SELECT FOR UPDATE untuk ambil antrian | Race condition guard agar slot tidak double-booked | — Pending |
| WhatsApp via BullMQ (jangan langsung) | Retry reliability + decoupling dari request cycle | — Pending |
| Wilayah dari DB statis (bukan API eksternal) | Menghindari dependency runtime pada third-party | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-30 after initialization*
