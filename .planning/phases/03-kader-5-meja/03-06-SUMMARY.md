---
phase: 03-kader-5-meja
plan: "06"
subsystem: meja4-ai-stt
tags: [kader, meja4, google-stt, openai, early-warning, voice-recorder, encryption, audit-log]
dependency_graph:
  requires:
    - 03-05 (updatePemeriksaan, PATCH /api/growth/pemeriksaan/:id, Meja3Page navigation state)
    - 03-02 (growth.service.ts createPemeriksaan)
  provides:
    - backend/src/modules/voice/voice.service.ts (transcribeAudio: Buffer → string via Google STT)
    - backend/src/modules/voice/voice.routes.ts (POST /api/voice/transcribe)
    - backend/src/modules/ai/ai.service.ts (generateEarlyWarning: EarlyWarningInput → {level, ringkasan, rekomendasi})
    - backend/src/modules/ai/ai.routes.ts (POST /api/ai/early-warning)
    - frontend/src/hooks/useVoiceRecorder.ts (React hook: isRecording, audioBlob, startRecording, stopRecording)
    - frontend/src/pages/kader/meja/Meja4Page.tsx (STT recorder UI + AI early warning + catatan save)
  affects:
    - backend/src/app.ts (registered /api/voice and /api/ai routes)
tech_stack:
  added: []
  patterns:
    - Multer memoryStorage + fileSize limit (10 MB) untuk audio upload DoS protection
    - Google Cloud SpeechClient lazy import — graceful degradation when GOOGLE_APPLICATION_CREDENTIALS missing
    - OpenAI GPT-4o temp 0.6 + response_format json_object untuk deterministic Early Warning
    - OpenAI lazy import — graceful degradation when OPENAI_API_KEY missing
    - IDOR guard earlyWarningHandler: kader.posyanduId === pemeriksaan.antrian.slotSesi.jadwal.posyanduId
    - rekomendasiAi encrypted via updatePemeriksaan (AES-256-GCM, UU PDP No. 27/2022)
    - AuditLog written by updatePemeriksaan in same Prisma transaction
    - MediaRecorder Safari fallback: audio/webm;codecs=opus → audio/mp4 → default
    - native textarea (shadcn Textarea not in package.json — same InlineProgress pattern)
key_files:
  created:
    - backend/src/modules/voice/voice.service.ts
    - backend/src/modules/voice/voice.routes.ts
    - backend/src/modules/ai/ai.service.ts
    - backend/src/modules/ai/ai.routes.ts
    - frontend/src/hooks/useVoiceRecorder.ts
  modified:
    - frontend/src/pages/kader/meja/Meja4Page.tsx (stub → full implementation)
    - backend/src/app.ts (added /api/voice and /api/ai route registrations)
decisions:
  - "Native textarea over shadcn Textarea — @/components/ui/textarea.tsx does not exist in package; native <textarea> + Tailwind classes visually identical; consistent with InlineProgress + native checkbox pattern from plans 03-02 and 03-05"
  - "Lazy import for SpeechClient and OpenAI — avoids module-load errors when env vars missing; graceful stub responses enable development without credentials"
  - "IDOR guard duplicated in earlyWarningHandler (not only in updatePemeriksaan) — avoids calling OpenAI API with unauthorized data before the access check in updatePemeriksaan; defense-in-depth for T-03-06-06"
  - "transcribeMutation timeout extended to 15s — Google STT one-shot can take up to 10s for longer audio; default axios 10s timeout too short"
metrics:
  duration: "~25 minutes"
  completed: "2026-07-02"
  tasks_completed: 3
  files_modified: 7
---

# Phase 03 Plan 06: Meja 4 (Konseling + AI Early Warning) Summary

Google Cloud STT backend for voice transcription (POST /api/voice/transcribe with Multer + SpeechClient id-ID), GPT-4o early warning generation backend (POST /api/ai/early-warning, temperature 0.6, IDOR guard, encrypted rekomendasiAi via updatePemeriksaan), and Meja4Page frontend with voice recorder UI (start/stop/indicator), auto-transcribe on stop, AI analysis card (level badge + ringkasan + rekomendasi), catatan konsultasi native textarea with save, and Lanjut ke Meja 5 navigation.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | voice module backend + useVoiceRecorder hook | b7862be | voice.service.ts, voice.routes.ts, useVoiceRecorder.ts |
| 2 | AI module backend + app.ts route registration | 7f56d71 | ai.service.ts, ai.routes.ts, app.ts |
| 3 | Meja4Page — voice recorder UI + AI early warning + catatan save | 90a0b37 | Meja4Page.tsx |

## Key Decisions Made

1. **Native textarea over shadcn Textarea**: `frontend/src/components/ui/textarea.tsx` does not exist. Used native `<textarea>` styled with Tailwind CSS. Consistent with InlineProgress (plan 03-02) and native checkbox (plan 03-05) pattern. No new package install needed.

2. **Lazy import for external SDKs**: Both `@google-cloud/speech` (SpeechClient) and `openai` (OpenAI) are dynamically imported. This prevents module-load-time errors when `GOOGLE_APPLICATION_CREDENTIALS` or `OPENAI_API_KEY` are not set, allowing development to continue with graceful stub responses.

3. **IDOR guard in earlyWarningHandler before OpenAI call**: T-03-06-06 requires verifying `kader.posyanduId === pemeriksaan.antrian.slotSesi.jadwal.posyanduId` before calling `generateEarlyWarning`. Even though `updatePemeriksaan` also has an IDOR guard, adding it before the AI call avoids billing OpenAI for unauthorized requests.

4. **transcribeMutation timeout 15s**: Google STT one-shot recognize can take up to 10s for longer audio files. Default apiClient timeout is 10s — extended to 15s for the transcribe mutation to avoid premature timeouts.

## Deviations from Plan

### Auto-fixed: shadcn Textarea not available (Rule 3 — Blocking)
- **Found during:** Task 3 TypeScript compilation
- **Issue:** `import { Textarea } from '@/components/ui/textarea'` — file does not exist in `frontend/src/components/ui/`
- **Fix:** Replaced with native `<textarea>` styled with Tailwind CSS classes. Functionally and visually equivalent.
- **Files modified:** `frontend/src/pages/kader/meja/Meja4Page.tsx`
- **Commit:** 90a0b37

## Known Stubs

None — all features implemented with real API integrations (with graceful degradation stubs when env vars are missing).

## Threat Flags

No new threat surface beyond what the plan's threat model covers:
- T-03-06-01 (DoS audio upload): Multer `fileSize: 10 MB` applied in voice.routes.ts
- T-03-06-02 (Prompt injection): namaBalita from DB, system prompt hardcoded server-side
- T-03-06-03 (API key in browser): OPENAI_API_KEY process.env server-side only
- T-03-06-04 (STT credentials in browser): GOOGLE_APPLICATION_CREDENTIALS server-side only
- T-03-06-05 (rekomendasiAi plaintext): updatePemeriksaan encrypts AES-256-GCM before DB write
- T-03-06-06 (IDOR): earlyWarningHandler verifies posyanduId before AI call AND updatePemeriksaan verifies again

## Pre-existing TypeScript Errors (Out of Scope)

Backend `npx tsc --noEmit` shows pre-existing errors in:
- `src/modules/antrian/antrian.controller.ts` — PrismaClientKnownRequestError type issue
- `src/modules/auth/auth.service.ts` — RolePengguna import
- `src/modules/jadwal/*.ts` — various tx type issues
- `src/shared/middleware/auth.middleware.ts` — RolePengguna import

Frontend `npx tsc --noEmit` shows pre-existing errors in:
- `src/components/ui/tabs.tsx`, `toast.tsx`, `tooltip.tsx` — @radix-ui missing packages
- `src/hooks/use-toast.ts` — implicit any
- `src/pages/auth/RegisterPage.tsx` — property type mismatch

None of these caused by Plan 03-06 changes. Files created/modified in this plan: **0 TypeScript errors**.

## Self-Check: PASSED

- backend/src/modules/voice/voice.service.ts: FOUND (commit b7862be)
- backend/src/modules/voice/voice.routes.ts: FOUND (commit b7862be)
- frontend/src/hooks/useVoiceRecorder.ts: FOUND (commit b7862be)
- backend/src/modules/ai/ai.service.ts: FOUND (commit 7f56d71)
- backend/src/modules/ai/ai.routes.ts: FOUND (commit 7f56d71)
- backend/src/app.ts /api/voice and /api/ai registered: FOUND (commit 7f56d71)
- frontend/src/pages/kader/meja/Meja4Page.tsx: FOUND (commit 90a0b37)
- TypeScript errors in new/modified files: 0
- Commits verified: b7862be, 7f56d71, 90a0b37
- No file deletions in any commit
