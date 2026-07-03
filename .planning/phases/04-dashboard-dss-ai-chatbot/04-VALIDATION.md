---
phase: 4
slug: dashboard-dss-ai-chatbot
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-03
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed Phase 03-01) |
| **Config file** | `backend/vitest.config.ts` |
| **Quick run command** | `cd backend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd backend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd backend && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 | DASH-01 | T-04-01-03 (IDOR map data) | Prisma query filters by puskesmasId from JWT | unit | `cd backend && npx tsc --noEmit 2>&1 \| head -20` | ✅ | ⬜ pending |
| 04-01-T2 | 01 | 1 | DASH-02 | — | Leaflet map renders; filter bulan refetches | smoke | manual browser check | ✅ | ⬜ pending |
| 04-02-T1 | 02 | 2 | KADER-MGT-01 | T-04-02-01 (IDOR unlock) | PATCH unlock: gagalLogin=0, terkunciSampai=null, AuditLog MASTER_OVERRULE | unit | `cd backend && npx vitest run src/modules/users/__tests__/users.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-02-T2 | 02 | 2 | KADER-MGT-01 | — | ManajemenPenggunaPage renders kader list + unlock button | smoke | `cd frontend && npx tsc --noEmit 2>&1 \| head -20` | ✅ | ⬜ pending |
| 04-03-T1 | 03 | 3 | CHAT-01, CHAT-02, CHAT-03 | T-04-03-01 (prompt injection), T-04-03-02 (rate limit bypass) | On-topic answered; off-topic rejected; 21st msg → 429 | unit | `cd backend && npx vitest run src/modules/ai/__tests__/ai-gizi.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-03-T2 | 03 | 3 | CHAT-01 | — | ChatGiziPage renders; sends pesan; displays response | smoke | `cd frontend && npx tsc --noEmit 2>&1 \| head -20` | ✅ | ⬜ pending |
| 04-04-T1 | 04 | 4 | QUEUE-AI-01, QUEUE-AI-02, QUEUE-AI-03 | T-04-04-01 (confirmation bypass), T-04-04-03 (IDOR antrian) | daftar_antrian not called before explicit confirm; parallel_tool_calls:false enforced | unit | `cd backend && npx vitest run src/modules/ai/__tests__/ai-pendaftaran.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-04-T2 | 04 | 4 | QUEUE-AI-01 | — | ChatPendaftaranPage renders; function call flow works | smoke | `cd frontend && npx tsc --noEmit 2>&1 \| head -20` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/modules/users/__tests__/users.test.ts` — stubs for KADER-MGT-01 (unlock + AuditLog)
- [ ] `backend/src/modules/ai/__tests__/ai-gizi.test.ts` — stubs for CHAT-01/02/03 (guardrail + rate limit)
- [ ] `backend/src/modules/ai/__tests__/ai-pendaftaran.test.ts` — stubs for QUEUE-AI-01/02/03 (confirmation gate)

Wave 0 test stubs are created in Plan 04-02 Task 1 (users.test.ts) and Plan 04-03 Task 1 (ai-gizi.test.ts) and Plan 04-04 Task 1 (ai-pendaftaran.test.ts) as part of each plan's TDD cycle — not in a separate Wave 0 plan.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Peta Leaflet renders colored markers per posyandu | DASH-01 | Browser rendering cannot be automated in vitest | Open /puskesmas/dashboard; verify markers appear; change bulan filter; verify data updates without reload |
| Filter bulan update tanpa reload | DASH-02 | UI interaction cannot be automated | Open dashboard; change month; verify map markers update without full page reload |
| AI chatbot pendaftaran: end-to-end conversation + antrian terdaftar | QUEUE-AI-03 | Integration test requires OpenAI API + DB transaction | Login as citizen; open chatbot; type "mau daftar selasa jam 9"; verify AI asks confirmation; type "ya"; verify antrian created in DB |
| AI rate limit UI: 21st message shows error | CHAT-03 | Requires 20 real Redis increments | Manually send 20 messages; 21st should show error message in UI |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING (❌) references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
