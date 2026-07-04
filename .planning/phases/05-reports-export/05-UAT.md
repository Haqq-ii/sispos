---
status: testing
phase: 05-reports-export
source: [05-VERIFICATION.md]
started: 2026-07-04T09:35:00Z
updated: 2026-07-04T09:35:00Z
---

## Current Test

number: 1
name: Visual layout — LaporanPage at /puskesmas/laporan
expected: |
  Green header (#008236) with "Laporan e-PPGBM" title and month picker (input[type=month]) in top-right.
  2x2 stat grid below header (Total Diperiksa, Total Balita, Gizi Normal, Bermasalah).
  "Format Laporan" card with two rows: "Laporan e-PPGBM (.xlsx)" and "Laporan Ringkas (.pdf)".
  Amber warning card "Catatan Format e-PPGBM" at the bottom.
awaiting: user response

---

## All Tests

| # | Name | Status |
|---|------|--------|
| 1 | Visual layout at /puskesmas/laporan | pending |
| 2 | Excel download — "Unduh Excel" button opens new tab + prompts download | pending |
| 3 | Auth guard — curl without cookie returns 401 | pending |
| 4 | e-PPGBM format — actual Excel has 17+9 columns, frozen headers, no formula injection | pending |
| 5 | PDF quality — A4 landscape, all posyandus visible, no clipped rows | pending |
