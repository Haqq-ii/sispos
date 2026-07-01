# Phase 2: Queue System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 02-queue-system
**Areas discussed:** Posyandu scope in antrian flow, Phase 2 ↔ 3 countdown boundary, Cancel antrian scope, Puskesmas jadwal UI placement

---

## Posyandu Scope in Antrian Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Hanya posyandu terpilih | Filter jadwal berdasarkan Warga.posyanduId. Tidak bisa switch posyandu di flow ini. | ✓ |
| Citizen bisa ganti posyandu | Dropdown pilih posyandu sebelum pilih tanggal — menambah 1 screen. | |

**User's choice:** Hanya posyandu terpilih (Recommended)

**Null posyandu handling:**

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect ke halaman pilih posyandu | Citizen diarahkan ke onboarding lokasi ulang. | ✓ |
| Tampilkan semua posyandu | Fallback ke daftar semua posyandu. | |

**User's choice:** Redirect ke halaman pilih posyandu (Recommended)

---

## Phase 2 ↔ 3 Countdown Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| estimasiDurasiMenit saja | Countdown Phase 2 = estimasiDurasiMenit. durasiRataAktual aktif setelah Phase 3. | ✓ |
| Stub endpoint update durasiRataAktual | Buat endpoint selesai di Phase 2 sebagai stub. | |

**User's choice:** estimasiDurasiMenit dari Jadwal saja (Recommended)

**Socket.IO broadcast scope:**

| Option | Description | Selected |
|--------|-------------|----------|
| Hanya saat antrian baru | Broadcast saat ada antrian masuk saja. | |
| Juga saat antrian dibatalkan | Broadcast saat antrian masuk + dibatalkan. | ✓ |

**User's choice:** Juga saat antrian dibatalkan — countdown refresh realtime untuk semua citizen di sesi saat ada pembatalan.

---

## Cancel Antrian Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2 — implement sekarang | PATCH /api/antrian/:id/batalkan + dialog konfirmasi di tiket screen. UI-SPEC sudah define. | ✓ |
| Phase 3 — defer | Tiket screen tanpa tombol batalkan. | |

**User's choice:** Phase 2 — implement sekarang (Recommended)

---

## Puskesmas Jadwal UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone page /puskesmas/jadwal | Route terpisah, sesuai UI-SPEC. Dashboard Puskesmas di Phase 4. | ✓ |
| Tab di PuskesmasDashboardPage | Embed sebagai tab di dashboard placeholder. | |

**User's choice:** Standalone page /puskesmas/jadwal (Recommended)

**Posyandu scope untuk dropdown jadwal:**

| Option | Description | Selected |
|--------|-------------|----------|
| Hanya posyandu yang di-assign | Via Puskesmas.posyandu relation di schema. | ✓ |
| Semua posyandu | Tidak sesuai model relasi di schema. | |

**User's choice:** Hanya posyandu yang di-assign (Recommended)

---

## Claude's Discretion

- Error handling detail di Socket.IO (retry, timeout)
- Pagination/sorting di tabel jadwal Puskesmas
- Moving average formula (Phase 3 scope)

## Deferred Ideas

- `durasiRataAktual` update → Phase 3 (Meja 5)
- `queue:almost` Socket.IO event → Phase 3
- Puskesmas dashboard utama → Phase 4
- Sidebar/navbar Puskesmas permanen → Phase 4
- Detail jadwal `/puskesmas/jadwal/:jadwalId` → Phase 3
