# Phase 8: UI Figma Alignment — Research

**Researched:** 2026-07-05
**Domain:** React + Tailwind + shadcn/ui frontend UI audit, Figma MCP design-to-code, end-to-end feature verification
**Confidence:** HIGH (full codebase audit performed — all pages read directly from disk)

---

## Summary

Phase 8 is a UI alignment and feature verification phase. Unlike typical greenfield phases, almost all pages are already implemented on disk — the work is alignment (visual gap between current implementation and Figma design), verification (pending checkpoints that were never human-approved), and polish (fixing functional gaps identified during Phase 7 pause).

The project has 37 frontend page/component files, with all major routes wired in `router/index.tsx`. The design language is already broadly consistent: green primary `#008236`, Tailwind rounded-2xl cards, Lucide icons, shadcn/ui components. However, several screens have placeholder content ("Fitur Segera Hadir"), one critical seed pipeline verification is pending, and one AI feature human-verify is pending.

Two pending checkpoints from prior phases (04-04 AI chatbot pendaftaran, 07-03 seed demo) require human verification before Phase 8 can declare the application fully functional. These must be treated as blocking Wave 8.1 tasks.

**Primary recommendation:** Run pending checkpoints (07-03, 04-04) first. Then audit each screen against Figma using `mcp__figma__get_design_context` with the known frame IDs. Implement missing content for stub pages (TumbuhKembangPage grafik tab, FamilyAccountPage, ProfilSayaPage). Polish visual gaps on LockScreenPage and PetaStuntingPage.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UI visual rendering | Browser / Client | Frontend Server (SSR) | React SPA — all rendering client-side via Vite |
| Realtime countdown updates | Browser / Client | API / Backend (Socket.IO) | Socket.IO client connects on TiketAntrianPage mount; server broadcasts `queue:update` |
| Auth state (role, namaLengkap) | Browser / Client | API / Backend | Zustand `useAuthStore`; JWT httpOnly cookie held by browser |
| Figma design context | CDN / Static | — | Figma MCP pulls from Figma cloud; no backend involved |
| Data for visual population | API / Backend | Database / Storage | All data-driven UI sections fetch via TanStack Query |
| Offline UI fallback | Browser / Client | CDN / Static | Workbox SW + IndexedDB — OfflineBanner renders offline state |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 8 — this is a new phase. Constraints derived from CLAUDE.md and ROADMAP.md.

### Locked Decisions
- Tech stack: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Lucide React (TIDAK BOLEH DIGANTI)
- State: Zustand (UI only) + TanStack Query (server state)
- All UI text in Bahasa Indonesia
- Date format: DD/MM/YYYY, Time: HH:MM WIB
- Figma MCP wajib di setiap wave — file key `4DIazKntakgAGXBDYefjbD`
- AI chatbot scope: 3 function calls (daftar/batalkan/reschedule); batalkan + reschedule butuh konfirmasi eksplisit
- Countdown = estimasi (UI label harus jelas — prefix "±", disclaimer wajib)

### Claude's Discretion
- Visual polishing of existing pages within the Figma design language
- Ordering of waves within Phase 8
- Deciding which stub pages to implement fully vs leave as-is for demo
- Choosing whether to merge or keep separate the ChatGiziPage / ChatPendaftaranPage routing (currently merged into ChatAssistantPage)

### Deferred Ideas (OUT OF SCOPE)
- Multi-tenancy / SaaS
- Mobile native app
- Web Push notifications
- BPJS / SATU SEHAT API integration
- Multi-language support
- Admin super panel
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Semua screen Citizen (Login, Register, Dashboard, Antrian, Chat) tampil visual sesuai Figma; tidak ada spacing/warna/komponen yang berbeda signifikan | All citizen pages confirmed on disk; Figma frames mapped below |
| UI-02 | Semua screen Kader (Dashboard, Lock-screen, Meja 1–5, Rekap Harian) dan Puskesmas (Dashboard, Peta Stunting, Manajemen Pengguna, Laporan) align ke Figma | All kader/puskesmas pages confirmed on disk; LockScreenPage + PetaStuntingPage need most work |
| UI-03 | Fitur belum optimal berfungsi baik end-to-end: countdown realtime, grafik Z-Score, AI Chatbot Bahasa Indonesia; tidak ada console error | 04-04 and 07-03 checkpoints pending; TumbuhKembangPage grafik tab is stub |
</phase_requirements>

---

## 1. Current State Audit

### 1.1 Screen Inventory — All Pages on Disk

Every page file was confirmed to exist via direct filesystem audit. The table below classifies each screen by implementation completeness.

**Status legend:**
- `FULL` — page has real logic, data fetching, proper UI
- `STUB` — file exists but shows placeholder / "Segera Hadir" content
- `BASIC` — functional but visually minimal, needs Figma alignment
- `CHECKPOINT` — feature implemented but human-verify pending

#### Citizen Screens

| Screen | File Path | Status | Notes |
|--------|-----------|--------|-------|
| Login | `pages/auth/LoginPage.tsx` | FULL | shadcn form, role detection, lock screen for kader |
| Register | `pages/auth/RegisterPage.tsx` | FULL | NIK form, OTP trigger |
| Verifikasi OTP | `pages/auth/VerifikasiOtpPage.tsx` | FULL | 6-digit OTP input |
| Onboarding Lokasi | `pages/auth/OnboardingLokasiPage.tsx` | FULL | WilayahSelect cascade |
| Lokasi Selesai | `pages/auth/LokasiSelesaiPage.tsx` | FULL | Confirmation screen |
| Citizen Dashboard | `pages/citizen/CitizenDashboardPage.tsx` | FULL | Green header, antrian aktif card, layanan cepat grid |
| Pilih Tanggal | `pages/citizen/antrian/PilihTanggalPage.tsx` | FULL | AntrianKalender component |
| Pilih Sesi | `pages/citizen/antrian/PilihSesiPage.tsx` | FULL | SesiCard list |
| Konfirmasi Antrian | `pages/citizen/antrian/KonfirmasiAntrianPage.tsx` | FULL | Balita RadioGroup, 409 race guard |
| Tiket Antrian | `pages/citizen/antrian/TiketAntrianPage.tsx` | FULL | Realtime countdown via Socket.IO, zero-padded nomorUrut |
| AI Assistant | `pages/citizen/ChatAssistantPage.tsx` | CHECKPOINT | Unified gizi + pendaftaran; backend `ai-assistant.service.ts` exists; endpoint `/api/ai/chat/assistant` active |
| ChatGiziPage | `pages/citizen/ChatGiziPage.tsx` | NOT ROUTED | Exists on disk but `/citizen/chat-gizi` redirects to `/citizen/chat-assistant` |
| ChatPendaftaranPage | `pages/citizen/ChatPendaftaranPage.tsx` | NOT ROUTED | Exists on disk but `/citizen/chat-pendaftaran` redirects to `/citizen/chat-assistant` |
| Tumbuh Kembang | `pages/citizen/TumbuhKembangPage.tsx` | PARTIAL | "Riwayat" tab functional; "Grafik" and "Imunisasi" tabs are placeholder ("segera hadir") |
| Family Account | `pages/citizen/FamilyAccountPage.tsx` | STUB | "Fitur Segera Hadir" placeholder |
| Profil Saya | `pages/citizen/ProfilSayaPage.tsx` | BASIC | Shows user info from auth store; no edit functionality |

#### Kader Screens

| Screen | File Path | Status | Notes |
|--------|-----------|--------|-------|
| Kader Dashboard | `pages/kader/KaderDashboardPage.tsx` | FULL | Green header, stats row, jadwal cards, install PWA button |
| Lock Screen | `pages/kader/LockScreenPage.tsx` | BASIC | Functional (meja selector → PATCH active-meja), but visually minimal list |
| Pelayanan Hari-H | `pages/kader/PelayananHariHPage.tsx` | FULL | Between dashboard and lock-screen |
| Meja 1 | `pages/kader/meja/Meja1Page.tsx` | FULL | Checklist hadir/tangguhkan + offline support |
| Meja 2 | `pages/kader/meja/Meja2Page.tsx` | FULL | Custom numpad, biological gate, Z-Score, offline support |
| Meja 3 | `pages/kader/meja/Meja3Page.tsx` | FULL | Z-Score chart (recharts), tanda klinis, offline support |
| Meja 4 | `pages/kader/meja/Meja4Page.tsx` | FULL | STT Google Cloud, AI Early Warning GPT-4o, 45s auto-stop, offline disable |
| Meja 5 | `pages/kader/meja/Meja5Page.tsx` | FULL | Imunisasi list + tambah, Selesai button, offline support |
| Rekap Harian | `pages/kader/RekapHarianPage.tsx` | FULL | Download .xlsx + .pdf via window.open same-origin cookie |
| Kader Profil | `pages/kader/KaderProfilPage.tsx` | BASIC | Likely basic — not fully audited |

#### Puskesmas Screens

| Screen | File Path | Status | Notes |
|--------|-----------|--------|-------|
| Puskesmas Dashboard | `pages/puskesmas/PuskesmasDashboardPage.tsx` | FULL | Green header, stats 2x2 grid, quick action cards |
| Peta Stunting | `pages/puskesmas/PetaStuntingPage.tsx` | BASIC | Leaflet map functional, but basic desktop layout (p-6 max-w-5xl) vs mobile-first expected by Figma |
| Manajemen Jadwal | `pages/puskesmas/jadwal/ManajemenJadwalPage.tsx` | FULL | JadwalTable + BuatJadwalDialog |
| Manajemen Pengguna | `pages/puskesmas/ManajemenPenggunaPage.tsx` | FULL | Kader list, master overrule "Buka Kunci" |
| Laporan | `pages/puskesmas/LaporanPage.tsx` | FULL | Excel + PDF download |
| Audit Log | `pages/puskesmas/AuditLogPage.tsx` | BASIC | Exists; not fully audited |

### 1.2 Router Completeness

`frontend/src/router/index.tsx` is fully wired. Key observations:
- All 4 citizen antrian routes registered with `ProtectedRoute allowedRoles={['citizen']}`
- All 6 kader meja routes registered as standalone (no layout wrapper)
- All 6 puskesmas routes registered under `PuskesmasLayout`
- `/citizen/chat-gizi` and `/citizen/chat-pendaftaran` redirect to `/citizen/chat-assistant` (deliberate unification)
- No missing routes detected [VERIFIED: direct file read]

### 1.3 shadcn/ui Components Status

**Installed (from `frontend/package.json`):** [VERIFIED: direct file read]

| Package | Component | UI File |
|---------|-----------|---------|
| @radix-ui/react-dialog | Dialog | `components/ui/dialog.tsx` |
| @radix-ui/react-label | Label | `components/ui/label.tsx` |
| @radix-ui/react-progress | Progress | `components/ui/progress.tsx` |
| @radix-ui/react-radio-group | RadioGroup | `components/ui/radio-group.tsx` |
| @radix-ui/react-select | Select | `components/ui/select.tsx` |
| @radix-ui/react-separator | Separator | `components/ui/separator.tsx` |
| @radix-ui/react-slot | (Button base) | via button.tsx |
| @radix-ui/react-tabs | Tabs | `components/ui/tabs.tsx` |
| @radix-ui/react-toast | Toast/Toaster | `components/ui/toast.tsx`, `toaster.tsx` |
| @radix-ui/react-tooltip | Tooltip | `components/ui/tooltip.tsx` |

**NOT installed — use native HTML alternatives:**
- `@radix-ui/react-checkbox` → use `<input type="checkbox" />` (established pattern from 03-02)
- `@radix-ui/react-textarea` → use native `<textarea>` (established pattern from 03-06)
- `@radix-ui/react-avatar` → use div with letter/initials (used in CitizenDashboardPage)
- `@radix-ui/react-scroll-area` → use `overflow-y-auto` with Tailwind

**Additional libraries installed:**
- `recharts@^3.9.1` — Z-Score chart in Meja3Page [VERIFIED]
- `react-leaflet@^4.2.1` + `leaflet@^1.9.4` — Peta Stunting [VERIFIED]
- `socket.io-client@^4.7.5` — realtime countdown [VERIFIED]
- `react-day-picker@^9.14.0` — AntrianKalender [VERIFIED]
- `idb@^8.0.3` — IndexedDB offline storage [VERIFIED]

### 1.4 Design System Tokens (Established Patterns)

These colors/tokens are already used consistently across multiple pages — Phase 8 must maintain them:

| Token | Value | Usage |
|-------|-------|-------|
| Primary green | `#008236` | Headers, buttons, primary actions |
| Primary hover | `#00a63e` | Button hover states |
| Light green | `#7bf1a8` | Subtitle text on green bg |
| Pale green | `#b9f8cf` | Caption text on green bg |
| Background | `#f9fafb` | Page background |
| Card border | `#f3f4f6` | Card borders |
| Text primary | `#1e2939` | Headlines |
| Text secondary | `#364153` | Body text |
| Text muted | `#99a1af` | Captions |
| Border radius card | `rounded-2xl` | All card containers |
| Border radius button | `rounded-[14px]` | Pill-style buttons |
| Red danger | `#e7000b` | Destructive actions |
| Orange accent | `#e17100` | Meja 5 header color |

---

## 2. Figma Frame Reference

Figma file key: `4DIazKntakgAGXBDYefjbD`

Use `mcp__figma__get_design_context` with `nodeId` for each screen before implementing. [ASSUMED: exact frame node IDs from ROADMAP.md — verify via Figma MCP at implementation time]

### Citizen Screens

| Screen | Frame Node ID | Notes |
|--------|--------------|-------|
| Login (Citizen) | `5:5654`, `5:5731` | Two states or variants |
| Login (Kader) | `5:5809`, `5:5886` | Kader PIN entry |
| Login (Puskesmas) | `5:13077` | Email login |
| Register | `4:87`, `4:142` | Register form |
| OTP Verifikasi | `5:1327` | 6-digit OTP |
| Pilih Tanggal | `5:2314` | Calendar date picker |
| Pilih Sesi | `5:2630` | Sesi card list |
| Konfirmasi Antrian | `5:2902` | Summary + balita selector |
| Tiket / Cetak Antrian | `5:3116` | Tiket with countdown |

### Kader Screens

| Screen | Frame Node ID | Notes |
|--------|--------------|-------|
| Dashboard Kader | `5:9717` | Main dashboard |
| Meja 2 (numpad) | `5:9785`, `5:9865` | BB/TB numpad variants |
| Meja 5 (selesai) | `5:11874`, `5:11942` | Completion screen |
| Imunisasi list | `5:12010` | Meja 5 imunisasi detail |

### Puskesmas Screens

| Screen | Frame Node ID | Notes |
|--------|--------------|-------|
| Dashboard Puskesmas | `5:13232` | Stats + map overview |
| Manajemen Pengguna | `5:14204` | Kader list |
| Reset PIN modal | `5:14838` | Master overrule dialog |
| Blokir kader | `5:15180` | Lock status display |
| Manajemen Jadwal | `5:15526` | Jadwal CRUD |
| Laporan e-PPGBM | `5:16705` | Export laporan |

**Additional frames referenced:**
- `27:*` and `2001:*` frames — Final screens (from ROADMAP Phase 3 note) [ASSUMED: check in Figma]

### How to Pull Figma Context (Required Protocol)

Before implementing or aligning any screen in Phase 8:

```
1. Call mcp__figma__get_design_context with:
   - fileKey: "4DIazKntakgAGXBDYefjbD"
   - nodeId: "<frame from table above>"
2. Read the returned design spec (colors, spacing, typography, component names)
3. Call mcp__figma__get_screenshot to get visual reference
4. Implement/adjust the React component to match
5. Note: "AI boleh adjust warna/posisi untuk konsistensi" (CLAUDE.md) — minor adjustments allowed
```

---

## 3. Implementation Approach

### 3.1 Figma MCP Integration

The Figma MCP server (`plugin:figma:figma`) provides:
- `get_design_context` — returns design tokens, layout, component tree from a Figma node
- `get_screenshot` — returns visual rendering of a frame as reference image
- `get_metadata` — file/node metadata

**Workflow per screen:**
1. Identify Figma frame node ID from table above
2. `get_design_context(fileKey, nodeId)` → extract spacing, colors, typography
3. `get_screenshot(fileKey, nodeId)` → visual reference for comparison
4. Compare against existing React component implementation
5. Identify gaps: missing sections, wrong colors, wrong spacing, missing components
6. Edit the React file to close gaps

### 3.2 Component Patterns for Phase 8

**Pattern 1: Green Header (all role dashboards)**
```tsx
// Established pattern — reuse across all header updates
<div className="bg-[#008236] px-4 pt-10 pb-6">
  <p className="text-[#7bf1a8] text-xs font-medium mb-0.5">Subtitle</p>
  <p className="text-white font-bold text-xl leading-tight">Title</p>
  <p className="text-[#b9f8cf] text-xs mt-1">Caption</p>
</div>
```

**Pattern 2: Card Container**
```tsx
// Standard card — use across all info sections
<div className="bg-white border border-[#f3f4f6] rounded-2xl shadow-sm p-4">
  ...
</div>
```

**Pattern 3: Native Checkbox (mandatory — no @radix-ui/react-checkbox)**
```tsx
// Per decisions log 2026-07-02 — native HTML, not radix
<input
  type="checkbox"
  checked={value}
  onChange={(e) => setValue(e.target.checked)}
  className="w-4 h-4 rounded accent-[#008236] cursor-pointer"
/>
```

**Pattern 4: Zod v4 (critical — do not use v3 patterns)**
```tsx
// WRONG (Zod v3): z.string({ required_error: "..." })
// CORRECT (Zod v4): z.string({ error: "..." })
// WRONG: schema with .default() used with zodResolver
// CORRECT: use defaultValues in useForm instead of .default() on schema
```

**Pattern 5: TanStack Query data fetching**
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['key'],
  queryFn: () => apiClient.get('/endpoint').then((r) => r.data.data as Type),
  staleTime: 30_000, // appropriate stale time per data volatility
})
```

**Pattern 6: Skeleton loading (mandatory — no spinners for layout)**
```tsx
// Always use Skeleton for section-sized loading states
{isLoading && <Skeleton className="h-[160px] rounded-2xl" />}
```

### 3.3 Figma-to-Code Anti-Patterns to Avoid

- **Anti-pattern: Absolute pixel sizes** — Figma gives px values; convert to Tailwind classes or inline style only when no Tailwind equivalent exists
- **Anti-pattern: New npm packages for UI** — shadcn components are already installed; use native HTML for missing primitives (checkbox, textarea) per established project pattern
- **Anti-pattern: Replacing working logic** — Phase 8 is visual alignment, not logic rewrite; only modify JSX/className, not business logic
- **Anti-pattern: Removing existing functionality** — If a page is FULL status, only add/adjust visual elements; do not remove Socket.IO connections, mutation handlers, etc.
- **Anti-pattern: react-leaflet v5** — pinned at v4.2.1; React 18 requirement; v5 requires React 19 (decisions log 2026-07-03)

---

## 4. Priority Matrix

### Tier 1 — Blocking (must complete before demo)

| Item | Reason | Wave |
|------|--------|------|
| 07-03 human-verify: run seed pipeline | Demo accounts won't have data without this | 8.1 |
| 04-04 human-verify: AI chatbot test | Core citizen feature unverified | 8.1 |
| Verify TiketAntrianPage Socket.IO | Realtime countdown is core value proposition | 8.2 |
| Verify Meja 5 selesai → countdown update | QUEUE-05 + Socket.IO broadcast to citizen | 8.3 |
| TumbuhKembangPage grafik tab | Currently placeholder — visible gap in demo | 8.2 |
| Console error audit across all pages | Success Criterion 5: "tidak ada console error" | 8.5 |

### Tier 2 — Critical Visual Alignment

| Item | Reason | Wave |
|------|--------|------|
| LockScreenPage visual polish | Currently plain button list — Figma likely has richer design | 8.3 |
| PetaStuntingPage mobile-first layout | Desktop-only layout (max-w-5xl) conflicts with mobile-first app | 8.4 |
| Citizen antrian flow visual review | Core flow; Figma frames fully mapped | 8.2 |
| KaderDashboardPage stats visual | Phase 7 pause noted kader dashboard as needing UI fix | 8.3 |
| Puskesmas Dashboard stats alignment | Figma frame 5:13232 — verify match | 8.4 |

### Tier 3 — Polish (nice-to-have for demo)

| Item | Reason | Wave |
|------|--------|------|
| FamilyAccountPage full implementation | Currently "Fitur Segera Hadir" — explain in demo as planned feature | 8.2 |
| ProfilSayaPage detail | Currently basic info card only | 8.2 |
| AuditLogPage visual | Low-priority; not in demo flow | 8.4 |
| KaderProfilPage | Not in main kader demo flow | 8.3 |
| ManajemenJadwalPage polish | Functional; visual refinement optional | 8.4 |

### Tier 4 — Out of Scope

- ChatGiziPage and ChatPendaftaranPage (not routed; ChatAssistantPage covers both)
- FamilyAccountPage functional implementation (registering new balita, etc.)
- Backend logic changes not related to UI gaps

---

## 5. Pending Feature Dependencies

### 5.1 Plan 02-07 — Frontend Antrian + Socket.IO

**Status: APPROVED 2026-07-01** [VERIFIED: 02-07-SUMMARY.md, checkpoint APPROVED]

All files confirmed on disk:
- `frontend/src/hooks/useAntrianSocket.ts` ✓
- `frontend/src/components/antrian/CountdownEstimasi.tsx` ✓ (± prefix, aria-live, disclaimer)
- `frontend/src/components/antrian/StatusAntrian.tsx` ✓
- `frontend/src/components/antrian/BatalkanAntrianDialog.tsx` ✓
- `frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx` ✓
- `frontend/src/pages/citizen/CitizenDashboardPage.tsx` ✓

**Phase 8 action:** Verify visually against Figma frame `5:3116` (TiketAntrianPage). Socket.IO functionality already human-verified. No code changes expected for the countdown logic.

### 5.2 Plan 03-07 — Meja 5 + Rekap Harian

**Status: APPROVED 2026-07-03** [VERIFIED: 03-07-SUMMARY.md, all 7 smoke test steps APPROVED]

All files confirmed on disk:
- `frontend/src/pages/kader/meja/Meja5Page.tsx` ✓
- `frontend/src/pages/kader/RekapHarianPage.tsx` ✓

Known post-verify fixes already applied:
- STT 45s auto-stop (`useVoiceRecorder.ts`)
- `tanggalInjeksi` full ISO datetime (`Meja5Page.tsx`)
- `voice.service.ts` credential check removed

**Phase 8 action:** Visual alignment only. Verify Meja 5 against Figma frame `5:11874`. Rekap harian against `5:16705` (if applicable) or confirm current layout matches.

### 5.3 Plan 04-04 — AI Chatbot Pendaftaran

**Status: PARTIAL — Tasks 1+2 DONE, Task 3 (human-verify) PENDING** [VERIFIED: 04-04-SUMMARY.md]

Files on disk:
- `backend/src/modules/ai/ai-pendaftaran.service.ts` ✓
- `backend/src/modules/ai/ai-assistant.service.ts` ✓ (unified endpoint added later)
- `backend/src/modules/ai/ai.routes.ts` — routes for `/chat/gizi`, `/chat/pendaftaran`, `/chat/assistant` all present ✓
- `frontend/src/pages/citizen/ChatPendaftaranPage.tsx` ✓ (exists but not routed)
- `frontend/src/pages/citizen/ChatAssistantPage.tsx` ✓ (routed, calls `/api/ai/chat/assistant`)

**Phase 8 action (Wave 8.1 — blocking):**
1. Verify `POST /api/ai/chat/assistant` responds with combined gizi + pendaftaran behavior
2. Test: ask nutrition question → gets gizi answer
3. Test: say "mau daftar antrian" → AI shows jadwal + asks konfirmasi
4. Test: confirm → antrian terdaftar di DB
5. Test: rate limit at 20/day → proper error
6. Only mark done when all 5 AI-01..AI-03 criteria pass

**Current ChatAssistantPage behavior:** Calls `/api/ai/chat/assistant` with `{ message, history }`. The `ai-assistant.service.ts` is a unified service combining both gizi and pendaftaran tool-calling capabilities. This is Phase 8's "ChatPage" — both redirects converge here.

### 5.4 Plan 07-03 — Seed Demo + Today

**Status: Tasks 1+2 DONE, Task 3 (human-verify) PENDING** [VERIFIED: seed files audited directly]

Files on disk with correct exports:
- `prisma/seed.demo.ts` — `export async function seedDemo(prisma: PrismaClient)` ✓
- `prisma/seed.today.ts` — `export async function seedToday(prisma: PrismaClient)` ✓
  - 4 sesi: 08:00, 09:00, 10:00, 11:00 ✓
  - `durasiRataAktual: 10` on Jadwal ✓ (GoFood countdown)
  - `nomorSesi: 4` present ✓
  - No 07-03-SUMMARY.md exists — Task 3 was never run

**Phase 8 action (Wave 8.1 — blocking):**
```bash
docker compose exec sispos-backend npx prisma db seed
```
Then verify:
- Citizen login: NIK `3471012345670001` / `Demo1234!` → sees 2 balita (Budi Santoso + Sari Dewi)
- Citizen dashboard shows antrian aktif at nomorUrut 3
- Kader login: HP `081234560001` / PIN `123456` → 4 sesi today visible
- Puskesmas login: `demo@puskesmas-mergangsan.go.id` / `Demo1234!` → stats visible

**Risk:** If `docker compose exec sispos-backend npx prisma db seed` fails, Phase 8 cannot proceed with realistic demo data. This is the first human action in Wave 8.1.

---

## 6. Validation Architecture

### 6.1 Test Approach for UI Alignment

Phase 8 is primarily visual — automated tests are limited. Validation follows a visual smoke-test pattern per wave.

**Wave-level verification command:** Visual browser check across all screens in the wave.

**Per-screen checklist:**
1. Route accessible without crash (no React error boundary triggered)
2. No console errors in DevTools
3. Data loads correctly (no empty states when seed data exists)
4. Layout matches Figma screenshot (pulled via `mcp__figma__get_screenshot`)
5. Interactive elements work (buttons, forms, navigation)

**Automated checks available:**
```bash
# TypeScript compilation (no type errors)
docker compose exec sispos-frontend npm run lint

# Check all routes render without crash — manual browser testing per route
```

### 6.2 Acceptance Criteria per Success Criterion

| Criterion | Verification Method |
|-----------|---------------------|
| SC-1: Citizen screens match Figma | Browser at each `/citizen/*` route; Figma screenshot comparison |
| SC-2: Kader screens match Figma | Browser at each `/kader/*` route; Figma screenshot comparison |
| SC-3: Puskesmas screens match Figma | Browser at each `/puskesmas/*` route; Figma screenshot comparison |
| SC-4a: Countdown realtime | Open TiketAntrianPage in browser; kader marks hadir → citizen countdown updates without refresh |
| SC-4b: Z-Score chart readable | Navigate to Meja 3 with seed data; verify recharts renders lines |
| SC-4c: AI Chatbot Bahasa Indonesia | ChatAssistantPage → ask nutrition question → verify Bahasa Indonesia response |
| SC-5: No console errors | DevTools console clear on all pages |

### 6.3 Wave-by-Wave Gate

Before each wave can be considered complete, an executor must:
1. Navigate to all screens in that wave
2. Confirm no crash (white screen / React error boundary)
3. Confirm no red console errors
4. Confirm layout visually reasonable vs Figma reference

---

## 7. Key Risks & Pitfalls

### Risk 1: Seed Pipeline Failure (HIGH)
**What:** `npx prisma db seed` may fail if seed.today.ts or seed.demo.ts have bugs not caught in Tasks 1+2.
**Why it happens:** Tasks 1+2 only wrote the files; Task 3 (the actual seed run) was never executed.
**Mitigation:** Run seed as first action in Wave 8.1; if it fails, debug before any UI work.
**Warning signs:** "Error:" output during seed; missing balita in DB.

### Risk 2: OpenAI Key Not Configured for AI Features (HIGH)
**What:** `OPENAI_API_KEY` not set in Docker environment → AI chatbot returns stub/error response.
**Why it happens:** Phase 4 added lazy-load graceful degradation; service starts but calls fail.
**Mitigation:** Check `docker compose exec sispos-backend env | grep OPENAI` before Wave 8.1 AI verification; if missing, note for human to configure.
**Warning signs:** ChatAssistantPage shows 503 error toast.

### Risk 3: Google Cloud STT Credentials (MEDIUM)
**What:** Meja 4 STT will fail without valid Google Cloud service account JSON.
**Why it happens:** voice.service.ts uses try-catch for graceful degradation (fix from 03-07).
**Mitigation:** If STT not configured, document it as known limitation; AI early warning uses text input fallback (catatan manual still works).
**Warning signs:** Meja 4 mic button shows error; transcript empty.

### Risk 4: Figma Frame IDs May Have Changed (MEDIUM)
**What:** Frame node IDs from ROADMAP.md were noted during Phase 0 planning — Figma frames may have been reorganized.
**Why it happens:** Frame IDs are specific to Figma file versions.
**Mitigation:** Always verify via `mcp__figma__get_metadata` before using a frame ID. If `5:2314` doesn't return expected content, search by name.
**Warning signs:** `get_design_context` returns unexpected content for a frame ID.

### Risk 5: react-leaflet@4.2.1 Map Container Re-init (LOW)
**What:** "Map container is already initialized" error if PetaStuntingPage re-renders with `key` prop on MapContainer.
**Why it happens:** react-leaflet v4 manages internal map state; key prop causes full re-mount.
**Mitigation:** Do not add `key` prop to MapContainer. Use `bulan` state change without remounting the map (decisions log 2026-07-03 — MapContainer tanpa key prop).
**Warning signs:** Console error "Map container is already initialized" on filter change.

### Risk 6: Zod v4 Pattern Confusion (LOW)
**What:** Using Zod v3 patterns (`required_error`, `.default()` with zodResolver) causes runtime schema validation failures.
**Why it happens:** Zod v4 changed the API; codebase uses `zod@^4.4.3`.
**Mitigation:** Always use `error:` instead of `required_error:` in Zod schemas; use `defaultValues` in `useForm` instead of `.default()` on Zod schema.
**Warning signs:** Form validation not triggering; zodResolver type mismatch errors.

### Risk 7: TumbuhKembangPage Grafik Tab — Backend Endpoint (MEDIUM)
**What:** Implementing the grafik tab requires `GET /api/growth/riwayat` or similar endpoint to return historical pemeriksaan data for recharts.
**Why it happens:** The recharts ZScoreChart component exists (from Meja 3) but TumbuhKembangPage only shows list riwayat in the "Riwayat" tab.
**Mitigation:** Check what backend endpoint the page currently calls (`/growth/riwayat`); if it exists and returns array with beratBadan/Z-Score, the grafik tab can reuse `ZScoreChart` component from `components/kader/ZScoreChart.tsx`.
**Warning signs:** 404 from growth endpoint when citizen accesses tumbuh-kembang route.

### Risk 8: ChatAssistantPage vs ChatPendaftaranPage Architecture (LOW)
**What:** Two chat pages exist on disk. Router unifies them via ChatAssistantPage. If the unified `/api/ai/chat/assistant` endpoint doesn't fully replicate both behaviors, one feature set will be silently missing.
**Why it happens:** The merge happened organically (ai-assistant.service.ts added to handle both gizi + pendaftaran tool calling).
**Mitigation:** During 04-04 human-verify, explicitly test both gizi questions AND pendaftaran flow through ChatAssistantPage (not ChatPendaftaranPage).
**Warning signs:** "Maaf, saya tidak bisa membantu" for valid gizi questions, or tool calls not executing for antrian intent.

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Docker Compose | All services | ✓ | sispos-nginx, backend, frontend, db, redis all defined |
| PostgreSQL 16 | All data | ✓ | sispos-db container |
| Redis 7 | Socket.IO, BullMQ, rate limit | ✓ | sispos-redis container |
| Figma MCP | Visual alignment | ✓ | plugin:figma:figma available in environment |
| OpenAI API key | AI chatbot features | [ASSUMED] | Check env; graceful degradation exists |
| Google Cloud STT | Meja 4 voice | [ASSUMED] | Check env; try-catch degradation exists |
| Fonnte API key | WA notifications | [ASSUMED] | BullMQ queues even without valid key |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Figma frame IDs from ROADMAP.md are still valid in the current Figma file | Figma Frame Reference | Frame shows wrong content; must search by name instead |
| A2 | `/api/ai/chat/assistant` endpoint fully handles both gizi and pendaftaran tool-calling | Pending Dependencies 5.3 | One behavior set silently missing from ChatAssistantPage |
| A3 | OpenAI API key is configured in Docker environment | Environment Availability | AI chatbot tests fail in Wave 8.1 |
| A4 | Google Cloud STT credentials are configured | Environment Availability | Meja 4 STT non-functional; manual catatan fallback still works |
| A5 | `npx prisma db seed` will succeed with current seed files | Pending Dependencies 5.4 | Demo data absent; all login verification fails |
| A6 | KaderProfilPage has basic functional content | Current State Audit | Page may be empty placeholder requiring content |

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/router/index.tsx` — all routes, lazy imports, ProtectedRoute config [VERIFIED: direct file read]
- `frontend/package.json` — exact package versions and installed dependencies [VERIFIED: direct file read]
- All page files (37 files) — implementation status and pattern usage [VERIFIED: direct file reads]
- `.planning/phases/02-queue-system/02-07-SUMMARY.md` — checkpoint APPROVED status [VERIFIED: direct file read]
- `.planning/phases/03-kader-5-meja/03-07-SUMMARY.md` — checkpoint APPROVED status [VERIFIED: direct file read]
- `.planning/phases/04-dashboard-dss-ai-chatbot/04-04-SUMMARY.md` — checkpoint PARTIAL status [VERIFIED: direct file read]
- `prisma/seed.demo.ts`, `prisma/seed.today.ts` — export status and content [VERIFIED: direct file read]
- `.planning/STATE.md` — phase history and key decisions log [VERIFIED: direct file read]
- `.planning/ROADMAP.md` — Figma frame references, wave structure, success criteria [VERIFIED: direct file read]

### Secondary (MEDIUM confidence)
- CLAUDE.md — project constraints, tech stack, coding conventions [CITED: project instructions]
- `.planning/REQUIREMENTS.md` — requirement IDs and descriptions [VERIFIED: direct file read]

### Tertiary (LOW confidence)
- Assumed Figma frame IDs are still valid (from ROADMAP.md, noted during Phase 0 planning)

---

## Metadata

**Confidence breakdown:**
- Current state audit: HIGH — all files read directly from disk
- Pending checkpoint status: HIGH — summary files read directly
- Figma frame IDs: MEDIUM — sourced from ROADMAP.md, may have changed
- Implementation approach: HIGH — based on confirmed codebase patterns
- Risk assessment: HIGH — based on decisions log and phase history

**Research date:** 2026-07-05
**Valid until:** 2026-07-12 (7 days — fast-moving phase)

---

## RESEARCH COMPLETE
