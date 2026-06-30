# SISPOS — GSD State

> Project memory. Updated at every phase transition.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-30)

**Core value:** Countdown antrian adaptif + alur 5 Meja kader end-to-end
**Current focus:** Phase 0 — Infrastructure & Setup

## Current Status

```
Phase aktif  : Phase 0 — Infrastructure & Setup
Last update  : 2026-06-30 (initialization)
Phases done  : 0 / 8
Next command : /gsd-plan-phase 0
```

## Phase History

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| 0 | ○ Pending | — | — |
| 1 | ○ Pending | — | — |
| 2 | ○ Pending | — | — |
| 3 | ○ Pending | — | — |
| 4 | ○ Pending | — | — |
| 5 | ○ Pending | — | — |
| 6 | ○ Pending | — | — |
| 7 | ○ Pending | — | — |

## Key Context for Agents

- **Figma file key**: `4DIazKntakgAGXBDYefjbD` — pull design context sebelum implement setiap screen UI
- **Prisma schema**: sudah final di `prisma/schema.prisma` — jangan redesign model
- **Tech stack**: dikunci di `CLAUDE.md` — tidak ada penggantian library
- **Timeline**: Phase 0-3 harus selesai sesegera mungkin (laporan PSI)
- **AI chatbot scope**: 3 function calls (daftar/batalkan/reschedule) — batalkan + reschedule butuh konfirmasi eksplisit
- **Countdown**: estimasi bukan janji — UI label harus jelas

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-30 | Figma dipakai dari Phase 0 (bukan Phase 3) | Desain sudah lengkap semua screen |
| 2026-06-30 | AI chatbot: 3 function calls (daftar/batalkan/reschedule) | Scope diperluas dari CLAUDE.md awal; batalkan+reschedule butuh konfirmasi |
| 2026-06-30 | Countdown = estimasi (UI responsibility) | Tidak ada fallback notifikasi WA untuk meleset |
| 2026-06-30 | Horizontal Layers (bukan Vertical MVP) | Sesuai struktur 8 phase di docs/ROADMAP.md |
