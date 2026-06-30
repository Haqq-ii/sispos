---
phase: 01-auth-wilayah
plan: "03"
subsystem: backend-wilayah
tags:
  - wilayah
  - geographic-data
  - cascade-api
  - seed
dependency_graph:
  requires:
    - "01-01"
  provides:
    - "GET /api/wilayah/provinsi"
    - "GET /api/wilayah/kabupaten"
    - "GET /api/wilayah/kecamatan"
    - "GET /api/wilayah/kelurahan"
    - "prisma/seed.wilayah.ts"
  affects:
    - "01-04 (OnboardingLokasiPage WilayahSelect)"
tech_stack:
  added: []
  patterns:
    - "Prisma DISTINCT query per level geografis"
    - "flattenTree() dari WilayahTree hierarchy untuk seed data"
    - "Public Express router tanpa authMiddleware"
key_files:
  created:
    - prisma/seed.wilayah.ts
    - backend/src/modules/wilayah/wilayah.service.ts
    - backend/src/modules/wilayah/wilayah.controller.ts
    - backend/src/modules/wilayah/wilayah.routes.ts
  modified:
    - backend/src/app.ts
decisions:
  - "Seed menggunakan WilayahTree hierarchy + flattenTree() untuk kemudahan maintenance"
  - "Endpoint wilayah bersifat publik (tanpa authMiddleware) karena data geografis tidak mengandung PII"
  - "skipDuplicates: true pada createMany untuk idempoten re-seed"
metrics:
  duration: "~25 menit"
  completed: "2026-07-01"
  tasks_completed: 1
  tasks_total: 2
  files_created: 4
  files_modified: 1
  seed_records: 1508
---

# Phase 01 Plan 03: Wilayah Seed + Module (4 Cascade GET endpoints) Summary

Membuat seed data wilayah DIY+Jateng+Jatim (1508 records) dan modul backend `GET /api/wilayah/*` cascade endpoints menggunakan Prisma DISTINCT queries.

## Objective

AUTH-07 backend half: seed tabel wilayah + 4 public cascade endpoints (`/provinsi`, `/kabupaten`, `/kecamatan`, `/kelurahan`) yang mempower WilayahSelect di OnboardingLokasiPage.

## What Was Built

### Task 1: Wilayah Seed + Module (COMPLETE)

**prisma/seed.wilayah.ts**

Seed script menggunakan WilayahTree hierarchy + `flattenTree()` untuk memudahkan maintenance. Data mencakup:
- DI Yogyakarta: 5 kab/kota (Kota Yogyakarta 14 kecamatan, Sleman 17 kecamatan, Bantul, Kulonprogo, Gunungkidul) = **401 records**
- Jawa Tengah: 30+ kab/kota termasuk Kota Semarang, Kab Semarang, Kota Surakarta, Kab Klaten, Kab/Kota Magelang, Purworejo, Temanggung, Kebumen, Boyolali, Sukoharjo, Wonogiri, Karanganyar, Sragen, Kudus, Jepara, Pati, Demak, Grobogan, Blora, Rembang, Kota Salatiga, Wonosobo, Banjarnegara, Cilacap, Banyumas, Pemalang, Pekalongan, Kota Pekalongan, Kota Tegal, Kab Tegal, Brebes, Purbalingga = **538 records**
- Jawa Timur: 30+ kab/kota termasuk Kota Surabaya, Kota Malang, Kab Malang, Kediri (kota+kab), Blitar (kota+kab), Madiun (kota+kab), Jember, Banyuwangi, Jombang, Mojokerto (kota+kab), Sidoarjo, Gresik, Lamongan, Pasuruan (kota+kab), Probolinggo (kota+kab), Lumajang, Tulungagung, Nganjuk, Bojonegoro, Tuban, Ponorogo, Magetan, Ngawi, Pacitan, Trenggalek = **569 records**

**Total: 1508 records** (melebihi target 1500)

Seed telah berhasil dijalankan via `docker cp` + `npx ts-node` dan terkonfirmasi via Prisma count query di container.

**backend/src/modules/wilayah/wilayah.service.ts**

Empat fungsi Prisma DISTINCT:
- `getProvinsi()` — DISTINCT provinsi ORDER BY asc
- `getKabupaten(provinsi)` — DISTINCT kabupaten WHERE provinsi ORDER BY asc  
- `getKecamatan(kabupaten, provinsi)` — DISTINCT kecamatan WHERE kabupaten AND provinsi ORDER BY asc
- `getKelurahan(kecamatan, kabupaten, provinsi)` — DISTINCT kelurahan WHERE all three ORDER BY asc

**backend/src/modules/wilayah/wilayah.controller.ts**

4 handlers dengan validasi input:
- Missing query params → 400 `PROVINSI_REQUIRED` / `PARAMS_REQUIRED`
- DB error → 500 `INTERNAL_ERROR`
- Success → `{ success: true, data: string[] }`

**backend/src/modules/wilayah/wilayah.routes.ts**

Public Express router (tanpa authMiddleware) mounting ke `/provinsi`, `/kabupaten`, `/kecamatan`, `/kelurahan`.

**backend/src/app.ts**

Ditambahkan:
```typescript
import { wilayahRouter } from './modules/wilayah/wilayah.routes'
// ...
app.use('/api/wilayah', wilayahRouter)
```

### Task 2: Human Verification (CHECKPOINT — awaiting)

Endpoint `/api/wilayah/*` akan aktif setelah worktree branch di-merge ke main dan container backend hot-reload.

## Verification Results

| Check | Status | Detail |
|-------|--------|--------|
| `npx tsc --noEmit` | PASS | Tidak ada TypeScript errors |
| Seed 1508 records | PASS | Terkonfirmasi via Prisma count query |
| wilayah.service.ts exports | PASS | 4 fungsi diekspor |
| wilayah.routes.ts no authMiddleware | PASS | Router publik |
| app.ts mount | PASS | `app.use('/api/wilayah', wilayahRouter)` |
| Endpoint curl test | PENDING | Perlu merge + container restart |

## Deviations from Plan

**1. [Rule 1 - Bug] Duplikat key pada WilayahTree**

- **Found during:** Task 1 (seed script development)
- **Issue:** Tree definition awal menggunakan key duplikat `Kabupaten Banjarnegara2` dan `Saptosari2` karena TypeScript object tidak boleh memiliki key duplikat
- **Fix:** Merge kecamatan ke dalam satu Banjarnegara entry, hapus Saptosari2 duplicate
- **Files modified:** `prisma/seed.wilayah.ts`
- **Commit:** f14b4bc

**2. [Rule 1 - Bug] Kecamatan key collision di Jawa Timur**

- **Issue:** Key `Tuban` muncul di Kabupaten Bojonegoro (seharusnya kecamatan di kab tersebut), bukan nama kabupaten
- **Fix:** Rename ke kecamatan yang benar (`Kapas`)
- **Files modified:** `prisma/seed.wilayah.ts`
- **Commit:** f14b4bc

**3. [Deviation] Initial seed count 476 kurang dari target 1500**

- **Found during:** Verifikasi awal dengan node count
- **Fix:** Rewrite seed menggunakan WilayahTree hierarchy + flattenTree() yang jauh lebih ekspresif dan scalable
- **Result:** 1508 records (melebihi target)
- **Commit:** f14b4bc

## Task 2: Checkpoint — Human Verification Required

### Situasi Saat Ini

Seed data sudah ada di database (1508 records). Endpoint backend ada di kode tetapi belum aktif di container running karena:
- Docker container me-mount main repo (`D:\Semester 4\PSI\sispos\`)
- Perubahan kode ada di worktree (`D:\Semester 4\PSI\sispos\.claude\worktrees\agent-ab12c89a5937815f2\`)
- Setelah merge worktree ke main, nodemon akan auto-reload dan endpoint akan aktif

### Langkah Verifikasi (Setelah Merge)

1. Pastikan Docker containers berjalan: `docker compose up -d`
2. Tunggu backend restart (nodemon hot-reload setelah file baru muncul)
3. Jalankan seed jika belum: `docker compose exec sispos-backend npx ts-node --project tsconfig.json prisma/seed.wilayah.ts`
4. Verifikasi endpoint:
   ```
   curl http://localhost/api/wilayah/provinsi
   # → { success: true, data: ["DI Yogyakarta", "Jawa Tengah", "Jawa Timur"] }
   
   curl "http://localhost/api/wilayah/kabupaten?provinsi=DI%20Yogyakarta"
   # → { success: true, data: ["Kabupaten Bantul", "Kabupaten Gunungkidul", "Kabupaten Kulonprogo", "Kabupaten Sleman", "Kota Yogyakarta"] }
   
   curl "http://localhost/api/wilayah/kecamatan?kabupaten=Kota%20Yogyakarta&provinsi=DI%20Yogyakarta"
   # → { success: true, data: ["Danurejan", "Gedongtengen", "Gondokusuman", ...] }
   
   curl "http://localhost/api/wilayah/kelurahan?kecamatan=Mergangsan&kabupaten=Kota%20Yogyakarta&provinsi=DI%20Yogyakarta"
   # → { success: true, data: ["Brontokusuman", "Keparakan", "Wirogunan"] }
   ```
5. Buka browser http://localhost/register/lokasi → verifikasi cascade dropdown Provinsi → Kabupaten → Kecamatan → Kelurahan berfungsi
6. Konfirmasi: ketik "approved" di prompt agent atau "langkah N gagal: ..."

## Threat Surface Scan

Tidak ada threat surface baru di luar threat_model plan. Seluruh input query params sudah aman via Prisma parameterized queries (T-03-01 mitigated).

## Known Stubs

Tidak ada stub — data seed sudah berisi data nyata, endpoint mengembalikan data dari DB langsung.

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 1eb76a2 | feat(01-03): wilayah seed script + module (4 cascade GET /api/wilayah/* endpoints) | +5 files |
| f14b4bc | feat(01-03): expand seed.wilayah.ts to 1500+ records using hierarchy tree | seed.wilayah.ts |

## Self-Check: PASSED

- [x] `prisma/seed.wilayah.ts` EXISTS — created in worktree
- [x] `backend/src/modules/wilayah/wilayah.service.ts` EXISTS
- [x] `backend/src/modules/wilayah/wilayah.controller.ts` EXISTS
- [x] `backend/src/modules/wilayah/wilayah.routes.ts` EXISTS
- [x] `backend/src/app.ts` MODIFIED — contains `app.use('/api/wilayah', wilayahRouter)`
- [x] Commits 1eb76a2 and f14b4bc EXIST in git log
- [x] DB count = 1508 records (verified via Prisma count in container)
- [x] TypeScript compiles cleanly (no errors)
- [x] Task 2 checkpoint documented with verification steps
