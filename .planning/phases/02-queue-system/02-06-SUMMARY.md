---
phase: 02-queue-system
plan: "06"
subsystem: ui
tags: [react, shadcn, tailwind, puskesmas, jadwal, tanstack-query, react-hook-form, zod]
dependency_graph:
  requires:
    - 02-04 (useJadwalList hook, CreateJadwalFESchema, apiClient)
  provides:
    - JadwalCard: mobile card view for jadwal list item with DD/MM/YYYY date and status badge
    - JadwalTable: desktop table with Skeleton loading rows and STATUS_COLOR_MAP
    - BuatJadwalDialog: modal form with Calendar, posyandu Select, estimasi Input, real-time slot preview, 409 field error handling
    - ManajemenJadwalPage: Screen 5+6 — responsive table/card layout + empty state + dialog trigger
  affects:
    - 02-07 (router wiring — /puskesmas/jadwal registers ManajemenJadwalPage with ProtectedRoute allowedRoles=['puskesmas'])
tech_stack:
  added: []
  patterns:
    - "STATUS_COLOR_MAP const object: statusJadwal → Tailwind className string (draft/aktif/terkunci/selesai/dibatalkan)"
    - "formatDateYYYYMMDD via getFullYear/getMonth/getDate (avoids toISOString UTC midnight offset)"
    - "isAxiosLikeError type guard untuk narrow 409 error response dari TanStack Query mutation"
    - "Calendar mode=single dengan disabled prop: (date) => date <= today || disabledDates includes date"
    - "ManajemenJadwalPage inline useQuery untuk GET /posyandu (D-08: puskesmas-scoped dropdown)"
    - "BuatJadwalDialog reset form on dialog close (handleOpenChange)"
key_files:
  created:
    - frontend/src/components/jadwal/JadwalCard.tsx
    - frontend/src/components/jadwal/JadwalTable.tsx
    - frontend/src/components/jadwal/BuatJadwalDialog.tsx
    - frontend/src/pages/puskesmas/jadwal/ManajemenJadwalPage.tsx
  modified:
    - frontend/src/hooks/useJadwalList.ts
    - frontend/src/App.tsx
decisions:
  - "JadwalListItem extended with posyanduId: string — backend getJadwalList returns posyanduId as scalar but FE interface was missing it; needed for disabled-date filtering in BuatJadwalDialog"
  - "JadwalListItem extended with slotSesi?: Array<{id, kuota, terisi}> — backend includes slotSesi in GET /jadwal response; needed for kuota display in JadwalCard + JadwalTable"
  - "formatDateYYYYMMDD via local date parts (not toISOString) — avoids UTC midnight offset causing off-by-one day in WIB timezone"
  - "Toaster added to App.tsx (Rule 2) — useToast renders nothing without <Toaster /> in the component tree"
  - "posyandu.id removed from JadwalListItem — backend select only includes namaPosyandu; using jadwal.posyanduId scalar for filtering"
metrics:
  duration: "~2 menit"
  completed_date: "2026-07-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 02 Plan 06: Puskesmas Jadwal Management UI Summary

**One-liner:** Puskesmas jadwal management screens (5+6): JadwalCard + JadwalTable with STATUS_COLOR_MAP badges, BuatJadwalDialog with Calendar date picker and real-time slot preview (floor(60/estimasi) x 3 sesi), ManajemenJadwalPage with responsive block sm:hidden / hidden sm:block layout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | JadwalCard + JadwalTable (responsive jadwal list) | dd35f36 | JadwalCard.tsx, JadwalTable.tsx, useJadwalList.ts |
| 2 | BuatJadwalDialog + ManajemenJadwalPage (Screens 5 + 6) | 7f83cea | BuatJadwalDialog.tsx, ManajemenJadwalPage.tsx, App.tsx |

## What Was Built

### Task 1 — JadwalCard + JadwalTable

**`frontend/src/components/jadwal/JadwalCard.tsx`** (new):
- Mobile card view for jadwal list item
- Renders: DD/MM/YYYY date + status Badge (STATUS_COLOR_MAP), posyandu name, estimasi caption, "3 sesi · {kuota} kuota/sesi", "Lihat Detail" ghost button
- `STATUS_COLOR_MAP`: draft=gray-100/gray-500, aktif=green-50/green-600, terkunci=blue-50/blue-600, selesai=green-50/green-600, dibatalkan=gray-100/gray-500
- `formatDDMMYYYY`: native `getDate/getMonth+1/getFullYear` with zero-padding

**`frontend/src/components/jadwal/JadwalTable.tsx`** (new):
- Desktop table with shadcn Table, TableHeader, TableBody, TableHead, TableRow, TableCell
- isLoading: renders 3× TableRow with 6 Skeleton cells each
- Data rows: tanggal (DD/MM/YYYY) | posyandu.namaPosyandu | "3 sesi" | "{kuota}/sesi" | Badge | "Lihat Detail" button
- STATUS_COLOR_MAP applied to Badge className
- Table wrapper: `<div className="rounded-md border overflow-hidden">`

**`frontend/src/hooks/useJadwalList.ts`** (modified — Rule 2):
- Added `posyanduId: string` field — backend returns this scalar with every jadwal; was missing from interface
- Added `slotSesi?: Array<{ id, nomorSesi?, labelSesi?, kuota, terisi }>` — backend getJadwalList includes slotSesi in response; kuota needed for card/table display

### Task 2 — BuatJadwalDialog + ManajemenJadwalPage

**`frontend/src/components/jadwal/BuatJadwalDialog.tsx`** (new):
- `useForm<CreateJadwalFEInput>({ resolver: zodResolver(CreateJadwalFESchema), defaultValues: { estimasiDurasiMenit: 7 } })`
- Field 1 — posyanduId: `<Select>` with options from `posyanduList` prop (D-08)
- Field 2 — tanggalPelaksanaan: shadcn `<Calendar mode="single">` with `isDateDisabled` → disables today + past AND dates with existing jadwal for selected posyandu; shows "Dipilih: DD/MM/YYYY" below on selection
- Field 3 — estimasiDurasiMenit: `<Input type="number" min=5 max=30>` + `FormDescription` helper text
- Slot preview: `bg-green-50 p-3 rounded-md` section shows when estimasi >= 5; `kuota = Math.floor(60 / estimasi)` for 3 sesi rows
- Mutation POST /api/jadwal: `formatDateYYYYMMDD(local)` → sends YYYY-MM-DD; success → invalidate ['jadwal','list'], close, toast, reset form
- 409 JADWAL_SUDAH_ADA: `setError('tanggalPelaksanaan', { message: '...' })` — field-level error, not generic alert
- `isAxiosLikeError` type guard for narrow error response check

**`frontend/src/pages/puskesmas/jadwal/ManajemenJadwalPage.tsx`** (new):
- useJadwalList() for jadwal data; inline useQuery for GET /posyandu (D-08)
- Header: "Manajemen Jadwal" h1 + "Atur jadwal pelayanan Posyandu" p + "Buat Jadwal Baru" button
- Responsive: `<div className="block sm:hidden">` (mobile cards) + `<div className="hidden sm:block">` (desktop table)
- Empty state: `<CalendarOff size=48 className="text-gray-300">` + heading + body + CTA button
- Loading state: 3× Skeleton blocks (h-24)
- `<BuatJadwalDialog>` controlled by `useState(false)` for open state

**`frontend/src/App.tsx`** (modified — Rule 2):
- Added `<Toaster />` import + render after `<AppRouter />` — required for `useToast()` to display toasts in the UI

## Verification Results

| Check | Result |
|-------|--------|
| STATUS_COLOR_MAP + statusJadwal in JadwalTable.tsx (grep -c) | 4 |
| kuota + floor in BuatJadwalDialog.tsx (grep -c) | 7 |
| block sm:hidden in ManajemenJadwalPage.tsx | PASS |
| hidden sm:block in ManajemenJadwalPage.tsx | PASS |
| CalendarOff empty state in ManajemenJadwalPage.tsx | PASS |
| 409 setError tanggalPelaksanaan in BuatJadwalDialog.tsx | PASS |
| Toaster in App.tsx | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] JadwalListItem missing posyanduId and slotSesi fields**
- **Found during:** Task 1 (JadwalCard implementation)
- **Issue:** `JadwalListItem` interface in `useJadwalList.ts` was missing `posyanduId: string` (scalar FK returned by getJadwalList) and `slotSesi?: Array<{...}>` (included relation). Both are needed: slotSesi for kuota display, posyanduId for disabled-date filtering in BuatJadwalDialog.
- **Fix:** Added both fields to the interface with correct types.
- **Files modified:** `frontend/src/hooks/useJadwalList.ts`
- **Commit:** dd35f36

**2. [Rule 2 - Missing] Toaster component missing from App.tsx**
- **Found during:** Task 2 (BuatJadwalDialog toast implementation)
- **Issue:** `useToast()` dispatches to a global reducer, but `<Toaster />` renders the toast UI. Without `<Toaster />` in the component tree, toasts are enqueued but never displayed.
- **Fix:** Added `import { Toaster }` + `<Toaster />` render inside App.tsx.
- **Files modified:** `frontend/src/App.tsx`
- **Commit:** 7f83cea

## Known Stubs

The following "Lihat Detail" buttons in JadwalCard and JadwalTable are placeholder stubs:
- `frontend/src/components/jadwal/JadwalCard.tsx` (line ~55): `<Button variant="ghost" size="sm">Lihat Detail</Button>` — no onClick handler
- `frontend/src/components/jadwal/JadwalTable.tsx` (line ~70): `<Button variant="ghost" size="sm">Lihat Detail</Button>` — no onClick handler
- **Reason:** Per plan objective, `/puskesmas/jadwal/:id` detail page is a Phase 3+ feature (DetailJadwalPage). These stubs will be wired in a future phase.

## Threat Flags

No new threat surface beyond the planned STRIDE register:
- T-02-21: posyanduId sourced from server-filtered dropdown (D-08); server ownership check in jadwal.service.ts is authoritative
- T-02-23: estimasiDurasiMenit validated client-side (min=5 max=30) via Zod and server-side via CreateJadwalSchema

## Self-Check: PASSED

- [x] frontend/src/components/jadwal/JadwalCard.tsx exists — Card with DD/MM/YYYY date, STATUS_COLOR_MAP badge
- [x] frontend/src/components/jadwal/JadwalTable.tsx exists — Table with Skeleton loading, STATUS_COLOR_MAP
- [x] frontend/src/components/jadwal/BuatJadwalDialog.tsx exists — Calendar, slot preview, 409 field error
- [x] frontend/src/pages/puskesmas/jadwal/ManajemenJadwalPage.tsx exists — responsive layout, empty state
- [x] frontend/src/hooks/useJadwalList.ts updated — posyanduId + slotSesi added
- [x] frontend/src/App.tsx updated — Toaster rendered
- [x] Task 1 commit dd35f36 exists
- [x] Task 2 commit 7f83cea exists
