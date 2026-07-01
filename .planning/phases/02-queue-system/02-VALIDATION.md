---
phase: 02
slug: queue-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — manual verification only |
| **Config file** | None |
| **Quick run command** | Open browser, verify page renders + API call succeeds |
| **Full suite command** | Walk through all 5 Phase 02 success criteria manually |
| **Estimated runtime** | ~10–15 minutes (manual walkthrough) |

---

## Sampling Rate

- **After every task commit:** Open browser, verify the page/API being implemented renders/responds correctly
- **After every plan wave:** Walk through full user flow for that wave
- **Before `/gsd-verify-work`:** All 5 success criteria verified manually

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| schema-migration | W0 | Wave 0 | QUEUE-01/02 | N/A | manual | `npx prisma migrate dev` then `npx prisma studio` | ⬜ pending |
| jadwal-backend | 01 | 2.1 | QUEUE-01 | requireRole('puskesmas') on POST /api/jadwal | manual | `curl -X POST /api/jadwal` + Prisma Studio verify 3 SlotSesi | ⬜ pending |
| antrian-select-for-update | 01 | 2.2 | QUEUE-02 | SELECT FOR UPDATE in $transaction | manual | Open 2 tabs → ambil slot sisa 1 → 1 berhasil, 1 → 409 | ⬜ pending |
| countdown-formula | 02 | 2.2 | QUEUE-03 | nomorUrut × estimasiDurasiMenit (Phase 2, nomorAktif=0) | manual | Visual: tiket menampilkan "±N menit" bukan angka absolut | ⬜ pending |
| socket-broadcast | 02 | 2.2 | QUEUE-04 | Broadcast di luar Prisma transaction | manual | Tab A ambil antrian → Tab B (same slotId) update tanpa refresh | ⬜ pending |
| bullmq-wa | 03 | 2.3 | QUEUE-06 | Job enqueue, never direct Fonnte call | manual | `docker compose logs backend \| grep antrian_whatsapp` | ⬜ pending |
| batalkan-antrian | 01 | 2.2 | D-06 | PATCH only when statusAntrian=menunggu | manual | Tombol batalkan muncul → dialog konfirmasi → status berubah | ⬜ pending |
| puskesmas-jadwal-ui | 03 | 2.3 | QUEUE-01 | requireRole('puskesmas') enforced | manual | Login citizen → akses /puskesmas/jadwal → redirect/403 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Schema migration: `npx prisma migrate dev --name add-aktif-dan-dibatalkan-status` — adds `StatusJadwal.aktif` + `StatusAntrian.dibatalkan`
- [ ] shadcn components: `npx shadcn add calendar dialog progress toast table tooltip tabs radio-group` (inside frontend container or with correct working dir)
- [ ] `frontend/src/lib/socket.ts` — socket singleton must exist before any hook imports it

*These are blocking prerequisites — Wave 2.1 cannot start until all 3 are done.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Race condition guard (SELECT FOR UPDATE) | QUEUE-02 | No test framework; concurrent request simulation | Open 2 browser tabs simultaneously on KonfirmasiAntrianPage for slot with kuota=1; submit both at same instant; verify exactly 1 succeeds (200) and 1 fails (409) |
| Socket.IO countdown realtime | QUEUE-04 | Requires live WebSocket connection | Tab A = TiketAntrianPage; Tab B = same sesi; trigger any queue change → Tab A updates without browser refresh |
| WA BullMQ enqueue (not direct Fonnte) | QUEUE-06 | Requires live Docker stack | After ambil antrian: `docker compose logs backend \| grep antrian_whatsapp` must show job enqueued; Fonnte NOT called synchronously |
| "±" prefix on countdown | QUEUE-03 | Visual/string assertion | TiketAntrianPage: countdown must show "±14 menit" format, never absolute time |
| Cancel only when menunggu | D-06 | State-dependent UI | Change statusAntrian to 'dipanggil' in DB → reload tiket → batalkan button must not appear |

---

## Validation Sign-Off

- [ ] Wave 0 schema migration verified (Prisma Studio shows StatusJadwal.aktif + StatusAntrian.dibatalkan)
- [ ] Wave 0 shadcn components added (no import errors in frontend)
- [ ] QUEUE-01: Jadwal POST → 3 SlotSesi auto-generated with correct kuota
- [ ] QUEUE-02: Race condition test — 2 concurrent requests, 1 wins
- [ ] QUEUE-03: Countdown shows "±N menit" (not absolute time)
- [ ] QUEUE-04: Socket.IO update without page refresh
- [ ] QUEUE-06: BullMQ log shows WA job (not direct Fonnte call)
- [ ] `nyquist_compliant: true` set in frontmatter after all checks pass

**Approval:** pending
