---
phase: 03-kader-5-meja
plan: "07"
subsystem: meja5-selesai-rekap-harian
tags: [kader, meja5, selesaikan-antrian, moving-average, socket-io, rekap-harian, exceljs, pdfkit, stt-fix, immunization-fix]
dependency_graph:
  requires:
    - 03-06 (Meja4Page, useVoiceRecorder, voice.service.ts, ai.service.ts)
    - 03-01 (vitest scaffold, moving average test stubs)
  provides:
    - backend/src/modules/antrian/antrian.service.ts (selesaikanAntrian: CMA durasiRataAktual + Socket.IO broadcast)
    - backend/src/modules/reports/rekap-harian.service.ts (generateRekapHarianXlsx + generateRekapHarianPdf)
    - backend/src/modules/reports/rekap-harian.routes.ts (GET /api/reports/rekap-harian?slotId&format=xlsx|pdf)
    - frontend/src/pages/kader/meja/Meja5Page.tsx (imunisasi list + tambah + Selesai button)
    - frontend/src/pages/kader/RekapHarianPage.tsx (download links xlsx/pdf)
    - frontend/src/hooks/useVoiceRecorder.ts (45s auto-stop countdown — STT sync limit fix)
  affects:
    - backend/src/server.ts (registered /api/reports route)
    - frontend/src/router/index.tsx (/kader/rekap → RekapHarianPage)
    - frontend/src/stores/useKaderMejaStore.ts (reset on selesai)
tech_stack:
  added: []
  patterns:
    - Cumulative Moving Average (CMA) untuk durasiRataAktual update setiap selesaikanAntrian
    - SELECT FOR UPDATE di prisma.$transaction — double-selesai protection (T-03-07-01)
    - broadcastQueueUpdate dipanggil OUTSIDE tx (setelah commit) — CLAUDE.md §Antrian
    - ExcelJS workbook.xlsx.writeBuffer() → Buffer → res.send() tanpa disk write
    - pdfkit collect chunks via 'data'/'end' event pattern → Buffer.concat
    - Excel formula injection guard: namaBalita prefixed with ' jika diawali =+-@
    - IDOR guard di rekapHarianHandler: slotSesi.jadwal.posyanduId === kader.posyanduId
    - useVoiceRecorder 45s auto-stop: setInterval countdown + setTimeout auto-call stopRecording
    - tanggalInjeksi full ISO 8601 datetime (new Date().toISOString()) — bukan date-only
key_files:
  created:
    - frontend/src/pages/kader/RekapHarianPage.tsx
    - prisma/seed.today.ts
    - .planning/phases/03-kader-5-meja/03-PATTERNS.md
  modified:
    - backend/src/modules/antrian/antrian.service.ts (selesaikanAntrian)
    - backend/src/modules/reports/rekap-harian.service.ts
    - backend/src/modules/voice/voice.service.ts (existsSync removed → try-catch)
    - frontend/src/pages/kader/meja/Meja4Page.tsx (secondsLeft countdown display)
    - frontend/src/pages/kader/meja/Meja5Page.tsx (tanggalInjeksi fix + imunisasi UI)
    - frontend/src/hooks/useVoiceRecorder.ts (45s auto-stop + secondsLeft state)
    - backend/src/server.ts (reports route registration)
decisions:
  - "selesaikanAntrian di antrian.service.ts bukan queue-kader.service.ts — antrian module sudah handle semua antrian mutations; tidak perlu pisah service"
  - "CMA formula: n<=1 ? durasiLayanan : (oldAvg*(n-1)+durasiLayanan)/n — n dihitung setelah update (COUNT selesai termasuk yang baru)"
  - "pdfkit simple text layout — no pdf-table library; kuota per slot maksimal ~36 antrian, layout manual cukup untuk laporan harian"
  - "window.open untuk download rekap — JWT di httpOnly cookie dikirim otomatis same-origin; tidak perlu token di URL"
  - "seed.today.ts: reset antrian selesai ke menunggu, slot_sesi.terisi=0 — untuk daily demo reset tanpa full re-seed"
metrics:
  duration: "~2 sessions (split context)"
  completed: "2026-07-03"
  tasks_completed: 3
  files_modified: 11
  bugs_fixed_post_verify: 3
---

# Phase 03 Plan 07: Meja 5 (Selesai) + Rekap Harian Summary

Final wave Phase 03: `selesaikanAntrian` dengan Cumulative Moving Average update `durasiRataAktual` + Socket.IO broadcast (QUEUE-05), rekap harian export via ExcelJS (.xlsx) + pdfkit (.pdf) (KADER-07), Meja5Page dengan imunisasi list + tambah + Selesai button, RekapHarianPage dengan download links, dan tiga bug fix post-verify: STT 45s auto-stop limit, `tanggalInjeksi` datetime format, `voice.service.ts` credential check.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | selesaikanAntrian CMA + moving average tests + Meja5Page | 48f0ad4 | antrian.service.ts, Meja5Page.tsx |
| 2 | rekap harian ExcelJS + pdfkit + RekapHarianPage + server.ts | eeaeb47 | rekap-harian.service.ts, rekap-harian.routes.ts, RekapHarianPage.tsx, server.ts |
| 3 | checkpoint:human-verify — full 5-meja smoke test APPROVED | — | (human review) |
| 4 (fix) | STT 45s auto-stop + tanggalInjeksi datetime + voice.service.ts | 3848735 | useVoiceRecorder.ts, Meja4Page.tsx, Meja5Page.tsx, voice.service.ts |

## Key Decisions Made

1. **selesaikanAntrian di `antrian.service.ts`**: Plan menyebut `queue-kader.service.ts`, tapi antrian module sudah menangani semua mutation antrian (hadir, panggil, selesai). Konsisten dengan pola yang ada; tidak perlu service baru.

2. **CMA n dihitung setelah update antrian**: `COUNT({slotId, statusAntrian:'selesai'})` dipanggil setelah `antrian.update` di dalam tx yang sama. Ini memastikan antrian yang baru selesai sudah terhitung dalam denominator moving average.

3. **pdfkit manual layout tanpa library tabel**: Kuota antrian per sesi maksimal ~36 baris (floor(60/7) × 3 sesi). Manual `doc.text()` dengan X positioning cukup. Tidak perlu install `pdfkit-table` atau library tambahan.

4. **`window.open` untuk download**: JWT disimpan di httpOnly cookie. Same-origin request ke `/api/reports/rekap-harian` otomatis membawa cookie. Tidak perlu Authorization header atau token di URL query param.

5. **`seed.today.ts` untuk daily reset**: Re-run `prisma/seed.ts` terlalu lambat untuk demo. `seed.today.ts` hanya reset data hari ini (`DELETE WHERE createdAt::date = CURRENT_DATE`) + reset `slot_sesi.terisi = 0` via join ke `jadwal.tanggalPelaksanaan = CURRENT_DATE`.

## Post-Verify Bug Fixes

### Fix 1: STT "Sync input too long"
- **Root cause**: Google STT synchronous `recognize()` API limit 60 detik. Kader merekam > 60s → `3 INVALID_ARGUMENT: Sync input too long`.
- **Fix**: `useVoiceRecorder.ts` — tambah `secondsLeft` countdown state, `setInterval` mundur setiap 1s, `setTimeout` auto-call `stopRecording()` di 45s.
- **UI**: `Meja4Page.tsx` tampilkan `secondsLeft` saat merekam; merah tua di ≤ 10 detik.

### Fix 2: Imunisasi save 400 VALIDASI_GAGAL
- **Root cause**: Frontend mengirim `tanggalInjeksi: new Date().toISOString().split('T')[0]` (format `"2026-07-03"`). Backend Zod schema `z.string().datetime()` rejects date-only string.
- **Fix**: `Meja5Page.tsx` — `tanggalInjeksi: new Date().toISOString()` (full ISO 8601 dengan waktu).

### Fix 3: STT "file kredensial tidak ditemukan"
- **Root cause**: `existsSync(credPath)` return `false` meski file sudah di-mount di Docker volume — path resolusi berbeda di dalam container.
- **Fix**: `voice.service.ts` — hapus `existsSync` check, wrap `SpeechClient` dalam try-catch. Jika gagal, return pesan stub. Credentials divalidasi saat `recognize()` dipanggil, bukan saat file check.

## Smoke Test Result (checkpoint:human-verify)

Semua 7 step dari `03-07-PLAN.md §checkpoint:human-verify` **APPROVED** oleh reviewer:

| Step | Feature | Status |
|------|---------|--------|
| 1 | Dashboard + Lock-Screen + Redis persist | ✅ |
| 2 | Meja 1 Hadir + Socket.IO countdown citizen | ✅ |
| 3 | Meja 2 BB/TB + Z-Score + biological gate | ✅ |
| 4 | Meja 3 Z-Score chart + tanda klinis + AuditLog | ✅ |
| 5 | Meja 4 STT transcript + AI Early Warning (level kritis) | ✅ |
| 6 | Meja 5 Selesai + durasiRataAktual=2.43 + Socket.IO broadcast | ✅ |
| 7 | Rekap Harian .xlsx download + .pdf download | ✅ |

## Deviations from Plan

### Auto-fixed: selesaikanAntrian location
- **Plan:** `queue-kader.service.ts` dan `queue-kader.routes.ts`
- **Actual:** `antrian.service.ts` dan routing via `antrian.routes.ts` (existing module)
- **Reason:** Meja5Page.tsx dan Meja1Page.tsx sudah menggunakan `apiClient.patch('/antrian/:id/...')`. Konsisten dengan pola existing; tidak perlu split ke module baru.

## Phase 03 Complete

Semua requirements Phase 03 terpenuhi:

- **KADER-01**: Lock-screen + Redis persist aktif meja
- **KADER-02**: Hadir + Socket.IO countdown realtime
- **KADER-03**: Z-Score WHO 2006 LMS + AuditLog + encrypt
- **KADER-04**: Z-Score chart recharts + tanda klinis
- **KADER-05**: STT (Google id-ID, 45s limit) + GPT-4o Early Warning + rekomendasiAi encrypted
- **KADER-06**: selesaikanAntrian → statusAntrian=selesai + CMA durasiRataAktual
- **KADER-07**: Rekap harian .xlsx (ExcelJS) + .pdf (pdfkit)
- **QUEUE-05**: Moving average update + Socket.IO broadcast ke citizen
