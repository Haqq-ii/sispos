# Phase 7: Seed Data Demo - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 5
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/seed.ts` | seed orchestrator | batch | `prisma/seed.demo.ts` + `prisma/seed.today.ts` | role-match |
| `prisma/seed.demo.ts` | seed (update) | batch / CRUD | itself (extend existing) | exact |
| `prisma/seed.today.ts` | seed (reference) | batch / CRUD | itself | exact |
| `prisma/seed.wilayah.ts` | seed (reference only) | batch | itself | exact |
| `backend/package.json` | config (update) | — | itself | exact |

---

## Pattern Assignments

### `prisma/seed.ts` (orchestrator)

**Analog:** `prisma/seed.demo.ts` (top-level async main + PrismaClient lifecycle)

**Imports pattern** (seed.demo.ts lines 1-4):
```typescript
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
```

**Orchestrator core pattern** — seed.ts does NOT call `main()` in each sub-file. Instead, each sub-file exports a named async function; seed.ts imports and calls them in sequence:
```typescript
import { PrismaClient } from '@prisma/client'
import { seedWilayah } from './seed.wilayah'
import { seedDemo } from './seed.demo'
import { seedToday } from './seed.today'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 SISPOS Full Seed — start')
  await seedWilayah(prisma)
  await seedMassal(prisma)   // inline in seed.ts or separate file
  await seedDemo(prisma)
  await seedToday(prisma)
  console.log('✅ Full seed selesai!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
```

**Lifecycle pattern** (seed.demo.ts lines 109-111):
```typescript
main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
```

> NOTE: Each sub-file currently calls `main()` directly. For orchestration, each must be refactored to export `async function seedXxx(prisma: PrismaClient)` and remove the standalone `main()` call at bottom. The `PrismaClient` instance is passed in from orchestrator — sub-files must NOT create their own `new PrismaClient()` when called via orchestrator.

---

### `prisma/seed.demo.ts` (UPDATE — add 2nd balita + antrian hari ini)

**Analog:** itself (extend existing patterns)

**Upsert pattern for accounts** (lines 14-25):
```typescript
const puskesmas = await prisma.puskesmas.upsert({
  where: { email: 'demo@puskesmas-mergangsan.go.id' },
  update: { passwordHash: pwHash },
  create: {
    namaPuskesmas: 'Puskesmas Mergangsan',
    email: 'demo@puskesmas-mergangsan.go.id',
    passwordHash: pwHash,
    alamat: 'Jl. Kenari No. 10, Mergangsan, Kota Yogyakarta',
    nomorTelepon: '027412345678',
    wilayahKerja: 'Kecamatan Mergangsan',
  },
})
```

**findFirst + conditional create for Balita** (lines 85-99 — Balita has no compound unique except `nikBalita`):
```typescript
const existingBalita = await prisma.balita.findFirst({ where: { wargaId: warga.id } })
if (!existingBalita) {
  const balita = await prisma.balita.create({
    data: {
      wargaId: warga.id,
      nikBalita: '3471012345670002',
      namaBalita: 'Budi Santoso',
      tanggalLahir: new Date('2024-01-15'),
      jenisKelamin: 'laki_laki',
    },
  })
}
```

**Pattern for 2nd balita** — same findFirst + conditional create, keyed by `nikBalita`:
```typescript
const existingBalita2 = await prisma.balita.findFirst({ where: { nikBalita: '3471012345670003' } })
if (!existingBalita2) {
  await prisma.balita.create({
    data: {
      wargaId: warga.id,
      nikBalita: '3471012345670003',
      namaBalita: 'Sari Dewi',           // nama khas Jawa, usia 18-24 bulan
      tanggalLahir: new Date('2024-10-01'),
      jenisKelamin: 'perempuan',
    },
  })
}
```

**bcrypt constants** (lines 5-6 + 10-11):
```typescript
const ROUNDS = 10
const pwHash = await bcrypt.hash('Demo1234!', ROUNDS)
const pinHash = await bcrypt.hash('123456', ROUNDS)
```

---

### `prisma/seed.today.ts` (REFERENCE — patterns to reuse in seed.demo.ts or seed.ts)

**Analog:** itself

**WIB timezone / todayStart pattern** (lines 23-27):
```typescript
const nowUtc = new Date()
const wibOffset = 7 * 60 * 60 * 1000
const nowWib = new Date(nowUtc.getTime() + wibOffset)
const todayStart = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()))
```

**`@db.Time` field pattern for jamMulai/jamSelesai** (lines 71-72):
```typescript
// WAJIB pakai Date.UTC(1970, 0, 1, hour, min, sec) untuk field @db.Time
jamMulai: new Date(Date.UTC(1970, 0, 1, s.jamMulaiHour, 0, 0)),
jamSelesai: new Date(Date.UTC(1970, 0, 1, s.jamSelesaiHour, 0, 0)),
```

**kuota formula** (line 65):
```typescript
const kuota = Math.floor(60 / estimasiDurasiMenit)  // 60 / 10 = 6
```

**SlotSesi createMany** (lines 66-77):
```typescript
await prisma.slotSesi.createMany({
  data: SESI.map((s) => ({
    jadwalId: jadwal!.id,
    nomorSesi: s.nomorSesi,
    labelSesi: s.labelSesi,
    jamMulai: new Date(Date.UTC(1970, 0, 1, s.jamMulaiHour, 0, 0)),
    jamSelesai: new Date(Date.UTC(1970, 0, 1, s.jamSelesaiHour, 0, 0)),
    kuota,
    terisi: 0,
  })),
})
```

**Antrian + terisi increment pattern** (lines 100-116):
```typescript
const count = await prisma.antrian.count({ where: { slotId: slot1.id } })
const antrian = await prisma.antrian.create({
  data: {
    slotId: slot1.id,
    wargaId,
    balitaId: balita.id,
    nomorUrut: count + 1,
    statusAntrian: 'menunggu',
  },
})
await prisma.slotSesi.update({
  where: { id: slot1.id },
  data: { terisi: { increment: 1 } },
})
```

**D-24 extension** — 2 dummy antrian before Dewi in Sesi 1 (nomorUrut 1 & 2), Dewi at nomorUrut 3. For dummy antrian, use balita from massal seed (findFirst by posyanduId via warga join).

**D-26 extension** — fill all 4 sesi with dummy antrian so kader dashboard looks full.

---

### `prisma/seed.wilayah.ts` (REFERENCE ONLY — do not modify)

**createMany with skipDuplicates pattern** (inferred from file structure — large batch upsert):
```typescript
await prisma.wilayah.createMany({
  data: flattenTree(diyTree).map((r) => ({ ...r })),
  skipDuplicates: true,
})
```

**Export pattern for orchestrator call:**
```typescript
// Add to seed.wilayah.ts when converting to exportable function:
export async function seedWilayah(prisma: PrismaClient) {
  // ... existing logic ...
}
```

---

### `prisma/seed.massal.ts` (NEW — bulk data generation, no existing analog)

**Pattern basis:** `prisma/seed.today.ts` (SlotSesi/Antrian loops) + `prisma/seed.demo.ts` (Posyandu/Warga/Balita creates)

**Bulk Warga + Balita loop pattern** (derive from seed.demo.ts):
```typescript
for (const wargaData of wargaList) {
  const warga = await prisma.warga.upsert({
    where: { nikIbu: wargaData.nikIbu },
    update: {},
    create: { ...wargaData, posyanduUtamaId: posyandu.id, statusVerifikasi: 'terverifikasi' },
  })
  // create balita untuk warga ini
  const existing = await prisma.balita.findFirst({ where: { nikBalita: wargaData.nikBalita } })
  if (!existing) {
    await prisma.balita.create({ data: { wargaId: warga.id, ...balitaData } })
  }
}
```

**Pemeriksaan bulk create** (field reference from schema lines 277-305):
```typescript
await prisma.pemeriksaan.create({
  data: {
    balitaId: balita.id,
    beratBadan: 8.5,
    tinggiBadan: 74.0,
    zScoreBbU: -1.2,
    zScoreTbU: -0.8,
    zScoreBbTb: -0.5,
    statusGizi: 'normal',
    tanggalPemeriksaan: someDate,   // @db.Date — use new Date('YYYY-MM-DD')
  },
})
```

**Imunisasi bulk create** (field reference from schema lines 311-325):
```typescript
await prisma.imunisasi.create({
  data: {
    balitaId: balita.id,
    namaVaksin: 'BCG',
    dosisKe: 1,
    tanggalInjeksi: new Date('2024-02-15'),  // @db.Date
  },
})
```

**StatusGizi enum values** (from schema — use these exact strings):
`'normal'` | `'kurang'` | `'buruk'` | `'pendek'` | `'sangat_pendek'` | `'lebih'` | `'obesitas'`

---

### `backend/package.json` (UPDATE — add prisma.seed)

**Current prisma block** (lines 49-51):
```json
"prisma": {
  "schema": "./prisma/schema.prisma"
}
```

**Updated prisma block** (add seed entry):
```json
"prisma": {
  "schema": "./prisma/schema.prisma",
  "seed": "ts-node --project ./tsconfig.json ./prisma/seed.ts"
}
```

Command inside container: `npx prisma db seed`

---

## Shared Patterns

### Idempotency (apply to ALL seed functions)
**Source:** `prisma/seed.demo.ts` lines 14-25, 29-45, 64-81
- Accounts with unique field → `prisma.model.upsert({ where: { uniqueField }, update: {...}, create: {...} })`
- Entities without unique (Posyandu, Balita) → `findFirst` + conditional `create`
- `createMany({ skipDuplicates: true })` for bulk reference data (Wilayah)

### PrismaClient Lifecycle
**Source:** `prisma/seed.demo.ts` lines 3-4 + 109-111
- One `PrismaClient` per run — instantiate at top of orchestrator, pass as param to sub-functions
- Always `.finally(async () => { await prisma.$disconnect() })` in orchestrator only

### WIB Date Pattern
**Source:** `prisma/seed.today.ts` lines 23-27
- `todayStart` = `new Date(Date.UTC(wibYear, wibMonth, wibDate))` — midnight UTC that corresponds to today WIB
- `@db.Time` fields = `new Date(Date.UTC(1970, 0, 1, hour, minute, 0))`
- `@db.Date` fields = `new Date('YYYY-MM-DD')` (ISO string, no time component)

### Console Output Convention
**Source:** `prisma/seed.demo.ts` lines 26, 61, 102-106
```typescript
console.log('✓ ModelName:', identifier)     // success per entity
console.log('\n✅ Phase name selesai!')       // phase summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Citizen:   NIK 3471012345670001 / Demo1234!')
```

### Antrian nomorUrut Assignment
**Source:** `prisma/seed.today.ts` lines 100-102
```typescript
// Count existing antrian in slot first, then assign next number
const count = await prisma.antrian.count({ where: { slotId: slot.id } })
nomorUrut: count + 1
```
Always follow with `terisi: { increment: 1 }` update on the SlotSesi.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `prisma/seed.massal.ts` (or inline in seed.ts) | seed bulk generator | batch | No bulk data generation with Z-Score distribution exists yet; patterns assembled from existing seed files + schema |

---

## Metadata

**Analog search scope:** `prisma/` directory, `backend/package.json`
**Files scanned:** 4 seed files + schema.prisma + package.json
**Pattern extraction date:** 2026-07-04
