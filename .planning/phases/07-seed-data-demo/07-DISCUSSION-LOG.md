# Phase 7: Seed Data Demo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 07-seed-data-demo
**Areas discussed:** Seed orchestration, Data massal scope, Demo account readiness

---

## Seed Orchestration

| Option | Description | Selected |
|--------|-------------|----------|
| 1 command `npx prisma db seed` | Buat seed.ts sebagai orchestrator, update package.json prisma.seed | ✓ |
| 3 script terpisah manual | ts-node seed.wilayah.ts, lalu ts-node seed.ts, lalu ts-node seed.demo.ts | |
| Makefile / npm script helper | npm run seed:all yang chainkan ketiga command | |

**User's choice:** 1 command `npx prisma db seed` (recommended)
**Notes:** Semua seed terintegrasi dalam 1 command — wilayah → massal → demo → today.

| Option | Description | Selected |
|--------|-------------|----------|
| Wilayah → Massal → Demo → Today (semua terintegrasi) | 1 command = database siap penuh | ✓ |
| Wilayah → Massal → Demo saja (tanpa today) | seed.today.ts terpisah dijalankan tiap hari presentasi | |

**User's choice:** Semua terintegrasi termasuk seed.today.ts logic

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent via upsert — aman dijalankan berkali-kali | Semua create pakai upsert/findFirst-create | ✓ |
| Skip kalau data sudah ada | Cek di awal, langsung exit jika DB sudah ada data | |

**User's choice:** Idempotent via upsert

---

## Data Massal Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Semua di bawah Puskesmas demo (Mergangsan) | 10+ posyandu semua linked ke Puskesmas Mergangsan | |
| Puskesmas demo + 1-2 Puskesmas dummy | Lebih realistis multi-puskesmas | ✓ |

**User's choice:** Puskesmas Mergangsan + 2 Puskesmas dummy, masing-masing 5 posyandu

| Option | Description | Selected |
|--------|-------------|----------|
| 120 balita, 12 posyandu (10 per posyandu) | Memenuhi >100 dan >10 requirements | |
| User specified detail | 375-525 balita total, 15 posyandu, 25-35 balita per posyandu (acak) | ✓ |

**User's choice (freeform):**
> "375-525 balita total, 15 posyandu (25-35 balita per posyandu, acak), semua di bawah Puskesmas Mergangsan + 2 Puskesmas dummy masing-masing 5 posyandu. Distribusi status gizi berbeda tiap posyandu — jangan rata: 3 posyandu 'sehat' (80% normal), 4 posyandu 'sedang' (60% normal), 3 posyandu 'rawan' (40% normal), 3 posyandu 'kritis' (30% normal, 5% gizi buruk), 2 posyandu 'outlier' (mayoritas lebih/obesitas). Satu cluster RW di posyandu kritis dengan stunting >35% untuk demo peta sebaran yang dramatis."

| Option | Description | Selected |
|--------|-------------|----------|
| Ada gap realistis (70-80% hadir tiap bulan) | Lebih realistis, sebagian skip 1-2 bulan | ✓ |
| Konsisten tiap bulan semua balita | Lebih mudah generate tapi kurang realistis | |

**User's choice:** Gap realistis — 70-80% balita hadir tiap bulan

| Option | Description | Selected |
|--------|-------------|----------|
| Skip imunisasi | Tidak ada requirement eksplisit | |
| Include imunisasi dasar (BCG, Polio, DPT, Campak) | Lebih lengkap untuk demo | ✓ |

**User's choice:** Include imunisasi dasar

---

## Demo Account Readiness

| Option | Description | Selected |
|--------|-------------|----------|
| 2 balita — Budi (sudah ada) + 1 baru usia 18-24 bulan | Memenuhi success criteria "minimal 2 balita" | ✓ |
| 3 balita | Lebih lengkap multi-profil | |

**User's choice:** 2 balita (Budi + 1 baru usia 18-24 bulan)

**Klarifikasi jadwal dari user:** Pelayanan Posyandu dimulai jam 8 pagi selesai jam 12 siang → **4 sesi × 1 jam** (bukan 3 sesi). Kuota per sesi bisa diubah-ubah.

| Option | Description | Selected |
|--------|-------------|----------|
| Sesi 1 (08:00-09:00), posisi ke-3 dari 6 | Ada 2 antrian dummy sebelumnya | ✓ |
| Sesi 2 (09:00-10:00), posisi ke-1 | Citizen pertama di sesi 2 | |
| Sesi 1, posisi ke-1 | Giliran pertama, countdown singkat | |

**User's choice:** Sesi 1, posisi ke-3

| Option | Description | Selected |
|--------|-------------|----------|
| 6 orang per sesi (estimasiDurasi 10 menit) | floor(60/10) = 6 slot per sesi | ✓ |
| Variasi: 8 orang Sesi 1-2, 6 orang Sesi 3-4 | Lebih realistis pagi lebih padat | |

**Klarifikasi GoFood effect dari user:** User bertanya apakah sistem seperti GoFood (countdown berkurang realtime). Dijawab: ya — `durasiRataAktual` moving average broadcast via Socket.IO. Pertanyaan lanjutan: apakah antrian dummy sebelumnya sudah selesai atau semua menunggu?

| Option | Description | Selected |
|--------|-------------|----------|
| Semua 'menunggu', flat 10 menit — efek GoFood terjadi saat demo live | Kader tandai selesai → countdown citizen turun | ✓ |
| Ke-1 sudah 'selesai', ke-2 'sedang_dilayani' | Moving average sudah aktif dari seed | |

**User's choice:** Semua menunggu — GoFood effect ditunjukkan live saat demo

| Option | Description | Selected |
|--------|-------------|----------|
| Isi semua 4 sesi dengan antrian dummy | Dashboard kader terlihat penuh | ✓ |
| Cukup Sesi 1 saja | Lebih simpel | |

**User's choice:** Semua 4 sesi diisi antrian dummy

---

## Claude's Discretion

- NIK/field values spesifik untuk balita dan warga dummy
- Angka pastinya dalam rentang 375-525 balita
- Distribusi imunisasi per usia balita (ikuti jadwal Kemenkes)
- Koordinat posyandu untuk Leaflet map

## Deferred Ideas

- **Phase 08 — UI Figma Alignment:** User ingin perbaikan keseluruhan design agar sesuai Figma, serta cara kerja fitur. Diangkat saat diskusi demo readiness. Scope terlalu besar untuk Phase 07 → dicatat untuk Phase 08 tersendiri.
