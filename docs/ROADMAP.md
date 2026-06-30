# SISPOS — GSD Roadmap
> File ini dibaca GSD saat menjalankan /gsd:new-project dan antar phase.
> GSD menggunakan file ini sebagai referensi spec, BUKAN sebagai pengganti interview.
> Update file ini setiap kali phase selesai — GSD subagent akan membacanya.

---

## Status Project

```
Phase aktif  : Belum dimulai
Last update  : -
GSD version  : latest
```

---

## Ringkasan Phase

| Phase | Nama | Wave | Status |
|---|---|---|---|
| 0 | Infrastructure & Setup | 0.1–0.4 | Belum dimulai |
| 1 | Auth & Wilayah | 1.1–1.3 | Belum dimulai |
| 2 | Queue System | 2.1–2.3 | Belum dimulai |
| 3 | Kader — 5 Meja | 3.1–3.7 | Belum dimulai |
| 4 | Dashboard & DSS | 4.1–4.4 | Belum dimulai |
| 5 | Reports & Export | 5.1 | Belum dimulai |
| 6 | PWA & Offline | 6.1 | Belum dimulai |
| 7 | Seed Data | 7.1–7.3 | Belum dimulai |

---

## Phase 0 — Infrastructure & Setup

### Wave 0.1 — Docker + Folder Structure
**Target**: Docker compose 5 container berjalan, struktur folder lengkap
**Acceptance**: `docker compose up --build` semua running, `curl http://localhost` response

### Wave 0.2 — Backend Boilerplate
**Target**: Express + Prisma + Socket.IO + Redis + BullMQ terhubung
**Acceptance**: `GET /health` return 200 dengan db, redis, socket connected

### Wave 0.3 — Frontend Boilerplate
**Target**: React + Vite + PWA + routing + Zustand + TanStack berjalan
**Acceptance**: Semua halaman placeholder bisa diakses, PWA manifest valid

### Wave 0.4 — Prisma Schema + Migrasi
**Target**: Semua model Prisma terbuat, `schema.prisma` sudah ada di `prisma/`
**Acceptance**: `npx prisma migrate dev` sukses, semua tabel ada di Prisma Studio

---

## Phase 1 — Auth & Wilayah

### Wave 1.1 — Register Citizen + OTP
**Target**: Registrasi NIK, OTP WA via BullMQ, verifikasi OTP, onboarding lokasi
**Acceptance**: Register → OTP terkirim/fallback, verifikasi → status terverifikasi

### Wave 1.2 — Login Single Gateway + JWT
**Target**: Login NIK/HP/Email, JWT cookie, redirect per role, logout
**Acceptance**: Login NIK → /citizen, HP → /kader, email → /puskesmas

### Wave 1.3 — Seed Wilayah
**Target**: Data wilayah DIY + Jateng + Jatim terseed di database
**Acceptance**: Dropdown Provinsi → Kab → Kec → Kel berfungsi di frontend

---

## Phase 2 — Queue System (INTI)

### Wave 2.1 — Jadwal & Slot Sesi
**Target**: Puskesmas buat jadwal, slot sesi auto-create dengan kuota terhitung
**Acceptance**: Jadwal 7 menit/orang → 3 SlotSesi kuota 8 terbuat otomatis

### Wave 2.2 — Ambil Antrian + Race Condition Guard
**Target**: Citizen ambil antrian, SELECT FOR UPDATE, nomor urut, notif WA
**Acceptance**: Dua tab bersamaan di slot sisa 1 → hanya 1 berhasil

### Wave 2.3 — Countdown Realtime
**Target**: Status antrian live, countdown adaptif via Socket.IO
**Acceptance**: Kader tandai selesai → countdown citizen bergerak tanpa refresh

---

## Phase 3 — Kader 5 Meja

### Wave 3.1 — Dashboard Kader + Lock-Screen
**Target**: Dashboard monitoring, mulai pelayanan, lock-screen Redis, tukar meja
**Acceptance**: Pilih meja → navbar hilang, reload tetap lock-screen

### Wave 3.2 — Meja 1: Checklist Kehadiran
**Target**: Checklist per RT, hadir, tangguhkan, daftar manual go-show
**Acceptance**: Klik Hadir → status DB berubah, Socket.IO update countdown

### Wave 3.3 — Meja 2: BB/TB + Z-Score
**Target**: Numpad kustom, validasi biologis, kalkulasi Z-Score WHO 2006
**Acceptance**: BB 85kg → konfirmasi. BB 8.5kg → Z-Score terhitung + AuditLog

### Wave 3.4 — Meja 3: Grafik + Tanda Klinis
**Target**: Grafik Z-Score otomatis, checkbox tanda klinis, override status gizi
**Acceptance**: Grafik muncul dari data Meja 2, checkbox tersimpan ke DB

### Wave 3.5 — Meja 4: AI Early Warning + Voice-to-Text
**Target**: GPT-4o early warning, Google STT id-ID, enkripsi catatan
**Acceptance**: Rekam suara → transkrip < 5 detik. AI muncul Bahasa Indonesia

### Wave 3.6 — Meja 5: Selesai + Trigger Countdown
**Target**: Tandai selesai, hitung durasi aktual, update moving average, broadcast
**Acceptance**: Klik Selesai → durasiRataAktual update, countdown citizen bergerak

### Wave 3.7 — Rekap Harian Kader + Export
**Target**: Halaman rekap setelah selesai pelayanan, export Excel + PDF
**Acceptance**: Selesai pelayanan → rekap muncul, download xlsx dan pdf berhasil

---

## Phase 4 — Dashboard & DSS

### Wave 4.1 — Dashboard Monitoring Puskesmas
**Target**: Peta Leaflet stunting, filter bulan, cluster warna, statistik makro
**Acceptance**: Peta tampil dengan cluster, filter bulan update tanpa reload

### Wave 4.2 — Manajemen Kader + Master Overrule
**Target**: Daftar kader, status kunci, overrule satu klik, audit log
**Acceptance**: Klik Buka Kunci → gagalLogin reset, AuditLog MASTER_OVERRULE tertulis

### Wave 4.3 — AI Chatbot Gizi Citizen
**Target**: GPT-4o chatbot guardrail gizi, rate limit, riwayat chat
**Acceptance**: Tanya gizi → jawab. Tanya presiden → tolak dengan pesan sopan

### Wave 4.4 — AI Chatbot Pendaftaran Antrian (Function Calling)
**Target**: Chatbot bisa daftarkan antrian via percakapan dengan function calling
**Acceptance**: Chat "mau daftar selasa jam 9" → flow konfirmasi → antrian terdaftar di DB

---

## Phase 5 — Reports & Export

### Wave 5.1 — Laporan Bulanan Puskesmas + Export e-PPGBM
**Target**: Agregasi data bulanan, export Excel e-PPGBM + PDF ringkas
**Acceptance**: Export .xlsx dengan kolom e-PPGBM standar Kemenkes

---

## Phase 6 — PWA & Offline

### Wave 6.1 — Service Worker + IndexedDB Sync
**Target**: Offline-First, IndexedDB untuk Meja 1-5, auto-sync saat online
**Acceptance**: Matikan internet, input Meja 2 → IndexedDB. Online → tersync

---

## Phase 7 — Seed Data (TERAKHIR)

### Wave 7.1 — Seed Wilayah
**Target**: Data wilayah DIY + Jateng + Jatim tersedia di DB
**Acceptance**: Dropdown di frontend berfungsi sampai level kelurahan

### Wave 7.2 — Seed Data Massal
**Target**: >100 balita, >10 posyandu, riwayat 12 bulan, campuran status gizi
**Acceptance**: Prisma Studio: >100 balita, riwayat 12 bulan ada

### Wave 7.3 — Seed Akun Demo
**Target**: 3 akun presentasi dengan antrian aktif hari ini
**Acceptance**: Login NIK 3471012345670001 → dashboard dengan 2 balita + countdown

---

## Keputusan Teknis Global

- Dropdown wilayah: statis dari DB (bukan API eksternal)
- Export: ExcelJS (.xlsx) + pdfkit (.pdf) — bukan puppeteer
- AI Chatbot gizi: temperature 0.6
- AI Chatbot pendaftaran antrian: temperature 0.4, function calling
- daftar_antrian hanya dipanggil setelah konfirmasi eksplisit citizen
- Redis: Socket.IO adapter + BullMQ + sesi lock-screen kader
- Peta stunting: kumulatif default + filter bulan, granularitas kelurahan
- Meja 3: visualisasi grafik + tanda klinis (bukan input timbangan ulang)
- Cold start countdown: estimasiDurasiMenit dari Jadwal (diisi Puskesmas)
- Figma MCP: dipakai mulai Phase 3, setup via claude plugin install figma@claude-plugins-official
