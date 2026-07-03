# Phase 03: Kader 5-Meja Flow — Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/src/modules/growth/growth.controller.ts` | controller | CRUD | `backend/src/modules/antrian/antrian.controller.ts` | exact |
| `backend/src/modules/growth/growth.service.ts` | service | CRUD | `backend/src/modules/antrian/antrian.service.ts` | exact |
| `backend/src/modules/growth/growth.routes.ts` | route | request-response | `backend/src/modules/antrian/antrian.routes.ts` | exact |
| `backend/src/modules/immunization/immunization.controller.ts` | controller | CRUD | `backend/src/modules/antrian/antrian.controller.ts` | exact |
| `backend/src/modules/immunization/immunization.service.ts` | service | CRUD | `backend/src/modules/antrian/antrian.service.ts` | role-match |
| `backend/src/modules/immunization/immunization.routes.ts` | route | request-response | `backend/src/modules/antrian/antrian.routes.ts` | exact |
| `backend/src/modules/queue/queue-kader.controller.ts` | controller | event-driven | `backend/src/modules/antrian/antrian.controller.ts` | role-match |
| `backend/src/modules/queue/queue-kader.service.ts` | service | event-driven | `backend/src/modules/antrian/antrian.service.ts` | role-match |
| `backend/src/modules/queue/queue-kader.routes.ts` | route | request-response | `backend/src/modules/antrian/antrian.routes.ts` | exact |
| `backend/src/modules/reports/rekap-harian.service.ts` | service | batch | `backend/src/modules/antrian/antrian.service.ts` | partial |
| `backend/src/shared/utils/encrypt.ts` | utility | transform | none in codebase | no-analog |
| `frontend/src/pages/kader/KaderDashboardPage.tsx` | component | request-response | `frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx` | role-match |
| `frontend/src/pages/kader/meja/Meja1Page.tsx` (x5) | component | event-driven | `frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx` | role-match |
| `frontend/src/pages/kader/LockScreenPage.tsx` | component | request-response | `frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx` | partial |
| `frontend/src/stores/useKaderMejaStore.ts` | store | event-driven | `frontend/src/stores/useAntrianStore.ts` | exact |
| `frontend/src/hooks/useKaderSocket.ts` | hook | event-driven | `frontend/src/hooks/useAntrianSocket.ts` | exact |
| `frontend/src/hooks/usePemeriksaan.ts` | hook | CRUD | `frontend/src/hooks/useSesiAvailability.ts` | exact |
| `frontend/src/router/index.tsx` | config | — | `frontend/src/router/index.tsx` | exact (modify) |

---

## Pattern Assignments

### `backend/src/modules/growth/growth.controller.ts` (controller, CRUD)

**Analog:** `backend/src/modules/antrian/antrian.controller.ts`

**Imports pattern** (lines 15-24):
```typescript
import type { Response } from 'express'
import { Prisma } from '@prisma/client'
import type { AuthRequest } from '../../shared/middleware/auth.middleware'
import { SomeSchema } from '../../shared/schemas/some.schema'
import { someService } from './some.service'
```

**Error map pattern** (lines 27-37):
```typescript
const ERROR_MAP: Record<string, number> = {
  BALITA_TIDAK_DITEMUKAN: 404,
  ANTRIAN_TIDAK_DITEMUKAN: 404,
  PEMERIKSAAN_SUDAH_ADA: 409,
}
function getHttpStatus(code: string | undefined): number {
  return ERROR_MAP[code ?? ''] ?? 500
}
```

**Handler pattern — POST with Zod validation** (lines 40-95):
```typescript
export async function createPemeriksaanHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = CreatePemeriksaanSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'VALIDASI_GAGAL',
      message: parsed.error.errors.map((e) => e.message).join('; '),
    })
    return
  }
  try {
    const result = await createPemeriksaan(parsed.data, req.user!.userId)
    res.status(201).json({ success: true, data: result, message: 'Pemeriksaan berhasil disimpan.' })
  } catch (err) {
    const e = err as { code?: string }
    res.status(getHttpStatus(e.code)).json({
      success: false,
      error: e.code ?? 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal. Coba lagi beberapa saat.',
    })
  }
}
```

**Key differences from antrian.controller.ts:**
- Role guard must be `requireRole('kader', 'ketua_kader')` not `'citizen'`
- Must write AuditLog after every INSERT/UPDATE (CLAUDE.md §Keamanan)
- `catatanKonsultasi` and `rekomendasiAi` must be encrypted before Prisma create/update

---

### `backend/src/modules/growth/growth.service.ts` (service, CRUD)

**Analog:** `backend/src/modules/antrian/antrian.service.ts`

**Imports + logger pattern** (lines 12-18):
```typescript
import pino from 'pino'
import { prisma } from '../../config/db'
import { io } from '../../config/socket'
import { env } from '../../config/env'
import { enqueueAntrianWaJob } from '../notification/notification.queue'

const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })
```

**Prisma transaction pattern** (lines 63-146):
```typescript
const txResult = await prisma.$transaction(async (tx) => {
  // 1. Lock/check parent record if needed
  // 2. Create child record
  // 3. Return result
})
// Post-transaction: broadcast + enqueue
void broadcastQueueUpdate(txResult.slotId)
```

**broadcastQueueUpdate call rule** (lines 161-163):
```typescript
// Broadcast WAJIB di luar prisma.$transaction — CLAUDE.md §Antrian point 3
void broadcastQueueUpdate(slotId)
```

**Error throw pattern** (lines 83-85):
```typescript
throw Object.assign(new Error('Balita tidak ditemukan'), { code: 'BALITA_TIDAK_DITEMUKAN' })
```

**Key differences:**
- Z-Score calculation: WAJIB baca `backend/src/shared/data/who-growth-tables.json`, formula `Z = ((nilai/M)^L - 1) / (L × S)`. JANGAN generate dari ingatan.
- Setelah `tx.pemeriksaan.create()`, tambah `tx.auditLog.create({ ... })` dalam transaksi yang sama.
- Enkripsi `catatanKonsultasi` dan `rekomendasiAi` dengan `encrypt()` dari `backend/src/shared/utils/encrypt.ts` SEBELUM simpan ke Prisma.
- Untuk Meja 5 selesai: update `durasiRataAktual` (moving average) di `slot_sesi`, lalu broadcast.

---

### `backend/src/modules/queue/queue-kader.service.ts` (service, event-driven)

**Analog:** `backend/src/modules/antrian/antrian.service.ts`

**broadcastQueueUpdate pattern** (lines 311-340):
```typescript
export async function broadcastQueueUpdate(slotId: string): Promise<void> {
  if (!io) {
    logger.warn('Socket.IO belum siap — skip broadcast')
    return
  }
  const antrianList = await prisma.antrian.findMany({
    where: { slotId, statusAntrian: { in: ['menunggu', 'dipanggil'] } },
    orderBy: { nomorUrut: 'asc' },
    select: { id: true, nomorUrut: true, statusAntrian: true },
  })
  const slot = await prisma.slotSesi.findUnique({
    where: { id: slotId },
    select: { durasiRataAktual: true },
  })
  io.to('sesi:' + slotId).emit('queue:update', {
    nomorAktif: 0,
    durasiRataAktual: slot?.durasiRataAktual ?? null,
    antrianList,
  })
}
```

**Key differences:**
- Meja 1 Hadir: set `antrian.statusAntrian = 'dipanggil'`, set `waktuCheckin = now()`, broadcast.
- Meja 5 Selesai: set `statusAntrian = 'selesai'`, set `waktuSelesai = now()`, hitung moving average `durasiRataAktual`, update `slot_sesi`, broadcast.
- Moving average formula: `durasiRataAktual = (durasiRataAktual_lama * (n-1) + durasiLayanan_baru) / n`
- Lock screen PIN validation: baca `kader.pinHash`, compare bcrypt, handle `gagalLogin` counter dan `terkunciSampai` (terkunci 30 menit setelah 10 gagal — CLAUDE.md §Keamanan).

---

### `backend/src/modules/reports/rekap-harian.service.ts` (service, batch)

**Analog:** `backend/src/modules/antrian/antrian.service.ts` (partial — query pattern only)

**Prisma findMany pattern:**
```typescript
const pemeriksaanList = await prisma.pemeriksaan.findMany({
  where: {
    tanggalPemeriksaan: { gte: startOfDay, lte: endOfDay },
    kader: { posyanduId },
  },
  include: { balita: true, kader: true },
  orderBy: { createdAt: 'asc' },
})
```

**Key differences:**
- Gunakan ExcelJS untuk ekspor `.xlsx` (CLAUDE.md §Export)
- Format e-PPGBM harus 100% sesuai standar Kemenkes
- Decrypt `catatanKonsultasi` dan `rekomendasiAi` dengan `decrypt()` sebelum masuk ke Excel

---

### `backend/src/modules/*/routes.ts` (route, request-response)

**Analog:** `backend/src/modules/antrian/antrian.routes.ts`

**Route pattern** (full file):
```typescript
import { Router } from 'express'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { requireRole } from '../../shared/middleware/require-role.middleware'
import { handlerA, handlerB } from './module.controller'

export const moduleRouter = Router()

// Semua route kader dilindungi requireRole('kader', 'ketua_kader')
moduleRouter.post('/', authMiddleware, requireRole('kader', 'ketua_kader'), handlerA)
moduleRouter.get('/:id', authMiddleware, requireRole('kader', 'ketua_kader'), handlerB)
```

**Key differences from antrian.routes.ts:**
- Role: `requireRole('kader', 'ketua_kader')` untuk semua meja endpoint
- Rekap harian export: `requireRole('kader', 'ketua_kader')` — kader milik posyandu itu saja

---

### `frontend/src/stores/useKaderMejaStore.ts` (store, event-driven)

**Analog:** `frontend/src/stores/useAntrianStore.ts`

**Full store pattern** (lines 1-27):
```typescript
import { create } from 'zustand'

interface AntrianState {
  selectedDate: string | null
  selectedSlotId: string | null
  setSelectedDate: (date: string | null) => void
  setSelectedSlotId: (slotId: string | null) => void
  reset: () => void
}

export const useAntrianStore = create<AntrianState>((set) => ({
  selectedDate: null,
  selectedSlotId: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedSlotId: (slotId) => set({ selectedSlotId: slotId }),
  reset: () => set({ selectedDate: null, selectedSlotId: null }),
}))
```

**Key differences:**
- State yang dibutuhkan: `activeSlotId`, `activeMeja` (1-5), `antrianAktif` (nomorUrut dipanggil), `isLocked` (lock screen PIN state)
- `isLocked` pakai `persist()` middleware seperti `useAuthStore.ts` (lines 19-35) karena harus survive page refresh
- TIDAK perlu `persist()` untuk `activeSlotId`/`activeMeja` — transient state

---

### `frontend/src/hooks/useKaderSocket.ts` (hook, event-driven)

**Analog:** `frontend/src/hooks/useAntrianSocket.ts`

**Full hook pattern** (lines 39-82):
```typescript
export function useAntrianSocket(slotId: string, antrianId: string) {
  const queryClient = useQueryClient()
  const [queueState, setQueueState] = useState<QueueUpdate | null>(null)
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting')

  useEffect(() => {
    if (!slotId || !antrianId) return  // Guard: jangan connect jika data belum ready

    socket.connect()
    socket.emit('queue:join', { slotId, antrianId })

    socket.on('connect', () => setSocketStatus('connected'))
    socket.on('disconnect', () => setSocketStatus('disconnected'))
    socket.on('queue:update', (data: QueueUpdate) => {
      setQueueState(data)
      void queryClient.invalidateQueries({ queryKey: ['antrian', antrianId] })
    })
    socket.on('connect_error', (err: Error) => {
      setSocketStatus('disconnected')
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('queue:update')
      socket.off('connect_error')
      socket.disconnect()  // HANYA saat unmount, BUKAN saat tab hide
    }
  }, [slotId, antrianId, queryClient])

  return { queueState, socketStatus }
}
```

**Key differences:**
- Kader join room `sesi:{slotId}` sama seperti citizen — pakai `socket.emit('queue:join', { slotId })`
- Kader perlu dengarkan `queue:update` untuk update antrianList di UI meja secara realtime
- `queryClient.invalidateQueries({ queryKey: ['antrian', 'kader', slotId] })` setelah update

---

### `frontend/src/hooks/usePemeriksaan.ts` (hook, CRUD)

**Analog:** `frontend/src/hooks/useSesiAvailability.ts`

**useQuery pattern** (lines 12-22):
```typescript
export function useSesiAvailability(jadwalId: string | null) {
  return useQuery({
    queryKey: ['sesi', jadwalId],
    queryFn: () =>
      apiClient.get('/sesi', { params: { jadwalId } }).then((r) => r.data.data),
    enabled: !!jadwalId,
    staleTime: 15_000,
  })
}
```

**useMutation pattern** (lines 28-37):
```typescript
export function useAmbilAntrian() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { slotId: string; balitaId: string }) =>
      apiClient.post('/antrian/ambil', body).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['antrian', 'saya'] })
    },
  })
}
```

**Key differences:**
- POST `/api/growth/pemeriksaan` dan POST `/api/immunization`
- `onSuccess` invalidate `['antrian', 'kader', slotId]` dan `['pemeriksaan', balitaId]`
- Error handling: gunakan `isAxiosLikeError` helper (copy dari `BuatJadwalDialog.tsx` lines 39-50)

---

### `frontend/src/pages/kader/KaderDashboardPage.tsx` dan `Meja*.tsx` (component, event-driven)

**Analog:** `frontend/src/pages/citizen/antrian/TiketAntrianPage.tsx`

**Page structure pattern** (lines 100-115):
```typescript
export default function TiketAntrianPage() {
  const { antrianId } = useParams<{ antrianId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: antrian, isLoading } = useQuery({
    queryKey: ['antrian', antrianId],
    queryFn: () => apiClient.get('/antrian/' + antrianId!).then((r) => r.data.data),
    enabled: !!antrianId,
    refetchOnWindowFocus: false,
  })
  // ...
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 ...">
        {/* Header */}
      </div>
      <div className="max-w-[400px] mx-auto px-4 py-6 space-y-6">
        {isLoading ? <Skeleton ... /> : data ? <MainContent /> : <EmptyState />}
      </div>
    </div>
  )
}
```

**Skeleton loading pattern** (lines 165-174):
```typescript
{isLoading ? (
  <>
    <Skeleton className="h-16 rounded-lg" />
    <Skeleton className="h-32 rounded-xl" />
    <Skeleton className="h-20 rounded-lg" />
  </>
) : data ? ( ... ) : ( <EmptyState /> )}
```

**Key differences:**
- Kader pages pakai `useKaderSocket` bukan `useAntrianSocket`
- Meja 1: tombol "Hadir" → PATCH `/api/antrian/:id/hadir`
- Meja 2: form timbang (BB) → React Hook Form + Zod (lihat BuatJadwalDialog pattern)
- Meja 3: form tinggi + LILA → sama seperti Meja 2
- Meja 4: form imunisasi → POST `/api/immunization`
- Meja 5: tombol "Selesai" → PATCH `/api/antrian/:id/selesai`, trigger moving average update

---

### `frontend/src/components/jadwal/BuatJadwalDialog.tsx` — Form pattern untuk Meja 2/3/4

**Form + Mutation pattern** (lines 87-155):
```typescript
const form = useForm<CreateJadwalFEInput>({
  resolver: zodResolver(CreateJadwalFESchema),
  defaultValues: { estimasiDurasiMenit: 7 },
})

const { mutate, isPending } = useMutation({
  mutationFn: (data: CreateJadwalFEInput) =>
    apiClient.post('/jadwal', { ... }).then((r) => r.data.data),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['jadwal', 'list'] })
    onOpenChange(false)
    form.reset()
    toast({ description: 'Berhasil.' })
  },
  onError: (error) => {
    if (isAxiosLikeError(error) && error.response.data.error === 'JADWAL_SUDAH_ADA') {
      form.setError('fieldName', { message: 'Pesan error spesifik.' })
    } else {
      form.setError('root', { message: 'Terjadi kesalahan. Silakan coba beberapa saat lagi.' })
    }
  },
})
```

**isAxiosLikeError type guard** (lines 39-50):
```typescript
function isAxiosLikeError(
  error: unknown,
): error is { response: { data: { error: string; message: string } } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response: unknown }).response === 'object' &&
    (error as { response: unknown }).response !== null &&
    'data' in ((error as { response: Record<string, unknown> }).response)
  )
}
```

---

### `frontend/src/router/index.tsx` — Route registration (modify existing)

**Protected route pattern** (lines 77-130):
```typescript
<Route
  path="/kader/dashboard"
  element={
    <ProtectedRoute allowedRoles={['kader', 'ketua_kader']}>
      <KaderDashboardPage />
    </ProtectedRoute>
  }
/>
```

**Lazy import pattern** (lines 34-35):
```typescript
const KaderDashboardPage = lazy(() => import('@/pages/KaderDashboardPage'))
```

**Key differences:**
- Tambah routes baru di blok kader: `/kader/meja/1` hingga `/kader/meja/5`, `/kader/lock-screen`
- Semua pakai `allowedRoles={['kader', 'ketua_kader']}`
- Lock screen route mungkin tidak perlu `ProtectedRoute` (kader sudah login JWT, PIN lock adalah layer tambahan)

---

## Shared Patterns

### Authentication — Backend
**Source:** `backend/src/shared/middleware/auth.middleware.ts` (lines 16-47) + `backend/src/shared/middleware/require-role.middleware.ts` (lines 19-31)
**Apply to:** Semua route handler Phase 03

```typescript
// Setiap route kader:
router.post('/path', authMiddleware, requireRole('kader', 'ketua_kader'), handler)
```

### AuditLog Write
**Source:** `prisma/schema.prisma` (lines 346-362) — model definition
**Apply to:** Semua service yang melakukan INSERT/UPDATE di Pemeriksaan dan Imunisasi

```typescript
// Di dalam prisma.$transaction, setelah create/update:
await tx.auditLog.create({
  data: {
    userId: kaderId,
    userRole: 'kader',
    aksi: 'CREATE_PEMERIKSAAN',       // atau UPDATE_PEMERIKSAAN, CREATE_IMUNISASI, dll
    tabelTerkait: 'pemeriksaan',
    recordId: pemeriksaan.id,
    dataSebelum: null,                 // null untuk CREATE
    dataSesudah: { beratBadan, tinggiBadan, ... },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  },
})
```

### BullMQ Enqueue
**Source:** `backend/src/modules/notification/notification.queue.ts` (lines 32-60)
**Apply to:** Semua service yang mengirim notifikasi WA (Meja 1 dipanggil, Meja 5 selesai)

```typescript
// CLAUDE.md §WhatsApp: SELALU enqueue, TIDAK PERNAH panggil Fonnte langsung
await notificationQueue.add(JOB_NAME, jobData, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
})
```

### Error Response Format
**Source:** `backend/src/modules/antrian/antrian.controller.ts` (lines 42-48, 88-93)
**Apply to:** Semua controller Phase 03

```typescript
// 400 Validation
res.status(400).json({ success: false, error: 'VALIDASI_GAGAL', message: '...' })

// Business logic error
res.status(getHttpStatus(e.code)).json({ success: false, error: e.code ?? 'INTERNAL_ERROR', message: '...' })

// Success
res.status(201).json({ success: true, data: result, message: '...' })
```

### SELECT FOR UPDATE (untuk status antrian transitions)
**Source:** `backend/src/modules/antrian/antrian.service.ts` (lines 63-146)
**Apply to:** `queue-kader.service.ts` — saat ubah status antrian (Meja 1 hadir, Meja 5 selesai)

```typescript
await prisma.$transaction(async (tx) => {
  const rows = await tx.$queryRaw<Array<{ id: string; statusAntrian: string }>>`
    SELECT id, "statusAntrian" FROM antrian WHERE id = ${antrianId} FOR UPDATE
  `
  // ... validasi status, lalu update
})
// Broadcast DI LUAR transaksi
void broadcastQueueUpdate(slotId)
```

### Zustand Store with Persist
**Source:** `frontend/src/stores/useAuthStore.ts` (lines 19-35)
**Apply to:** `frontend/src/stores/useKaderMejaStore.ts` — untuk `isLocked` state

```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({ ... }),
    {
      name: 'sispos-auth',  // localStorage key
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
```

### Socket.IO Hook Pattern
**Source:** `frontend/src/hooks/useAntrianSocket.ts` (lines 39-82)
**Apply to:** `frontend/src/hooks/useKaderSocket.ts`

Tiga aturan wajib (dari JSDoc):
1. `socket.connect()` saat mount; `socket.disconnect()` saat **unmount saja**
2. TIDAK disconnect saat browser tab disembunyikan
3. Guard `if (!slotId) return` — effect no-op sampai data ready

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/src/shared/utils/encrypt.ts` | utility | transform | Tidak ada encryption helper di codebase. Implementasi baru dengan Node.js `crypto` (AES-256-GCM). Key dari `process.env.ENCRYPTION_KEY`. |

**Panduan untuk encrypt.ts (dari RESEARCH.md / CLAUDE.md):**
- WAJIB ada karena `catatanKonsultasi` dan `rekomendasiAi` WAJIB dienkripsi (UU PDP No. 27/2022)
- Gunakan Node.js built-in `crypto` module: `aes-256-gcm` dengan random IV per enkripsi
- Export dua fungsi: `encrypt(plaintext: string): string` dan `decrypt(ciphertext: string): string`
- Format hasil: `iv:authTag:ciphertext` (hex-encoded)
- Key: `process.env.ENCRYPTION_KEY` (32-byte hex string)

---

## Metadata

**Analog search scope:** `backend/src/modules/`, `backend/src/shared/`, `frontend/src/`, `prisma/`
**Files scanned:** 14
**Key patterns confirmed:**
- Controllers: thin (validate → service → map error), error code map pattern
- Services: pino logger, Prisma transaction, broadcastQueueUpdate WAJIB di luar tx
- Routes: `authMiddleware` + `requireRole(...)` on every route
- Frontend pages: lazy import, ProtectedRoute, useQuery with Skeleton, Socket.IO via dedicated hook
- Stores: `create<State>()` tanpa persist untuk transient state; dengan `persist()` untuk state yang harus survive refresh
- Mutations: `useMutation` + `isAxiosLikeError` + field-level error via `form.setError`
