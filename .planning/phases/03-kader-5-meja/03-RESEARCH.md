# Phase 03: Kader 5-Meja Flow — Research

**Researched:** 2026-07-01
**Domain:** Healthcare workflow UI, Z-Score computation, STT, AI early warning, encryption, Redis session, export
**Confidence:** HIGH (core stack verified against codebase + npm registry; AI/STT patterns MEDIUM)

---

<user_constraints>
## User Constraints (from CLAUDE.md + Phase Spec)

### Locked Decisions
- Tech stack is FIXED — no substitutions (see CLAUDE.md §Tech Stack)
- Z-Score WAJIB dari `backend/src/shared/data/who-growth-tables.json` — JANGAN generate formula dari ingatan
- Formula: `Z = ((nilai/M)^L - 1) / (L × S)`
- `catatanKonsultasi` dan `rekomendasiAi` WAJIB dienkripsi sebelum simpan (UU PDP No. 27/2022)
- Setiap INSERT/UPDATE di Pemeriksaan dan Imunisasi WAJIB tulis AuditLog
- Lock-screen state: simpan di Redis (key: `kader:{kaderId}:activeMeja`) — bukan localStorage
- Socket.IO broadcast ke room `sesi:{slotId}` setiap Meja 1 (hadir) dan Meja 5 (selesai)
- WA notification via BullMQ — jangan Fonnte langsung
- Export: ExcelJS untuk .xlsx, pdfkit untuk .pdf (bukan puppeteer)
- Routing: React Router v6 dengan ProtectedRoute pattern yang sudah ada

### Claude's Discretion
- Chart library untuk Z-Score grafik (Meja 3) — recharts direkomendasikan (lihat §Standard Stack)
- Struktur endpoint API kader (/api/kader/*, /api/growth/*, /api/immunization/*)
- Moving average formula konkret untuk durasiRataAktual (lihat §Patterns)
- Prompt structure untuk GPT-4o early warning
- Encryption key format dan storage format ciphertext

### Deferred Ideas (OUT OF SCOPE)
- PWA offline sync untuk Meja 1-5 (Phase 6, REQUIREMENTS.md §PWA-01)
- Push notification "hampir dipanggil" (v2 requirements)
- e-PPGBM export standar Kemenkes (Phase 5, REQUIREMENTS.md §REPORT-01)
- AI Chatbot (citizen) dan AI Pendaftaran (Phase 4)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KADER-01 | Dashboard kader: antrian aktif + mulai pelayanan; lock-screen Redis; reload tetap lock | §Redis Lock-Screen Pattern |
| KADER-02 | Meja 1: checklist hadir/tangguhkan per RT/balita; daftar manual go-show | §Queue Kader Service Pattern |
| KADER-03 | Meja 2: BB/TB numpad; validasi biologis + konfirmasi; Z-Score WHO 2006; AuditLog | §Z-Score Computation, §Encryption, §AuditLog |
| KADER-04 | Meja 3: grafik Z-Score; checkbox tanda klinis; override status gizi | §Chart Pattern (recharts) |
| KADER-05 | Meja 4: GPT-4o early warning; Google STT id-ID < 5 detik; catatan enkripsi | §STT Pattern, §AI Early Warning |
| KADER-06 | Meja 5: Selesai → durasiRataAktual moving average; Socket.IO broadcast | §Moving Average |
| KADER-07 | Rekap harian: download .xlsx dan .pdf | §ExcelJS + pdfkit Pattern |
| QUEUE-05 | durasiRataAktual update sebagai moving average setiap Meja 5 selesai | §Moving Average |
</phase_requirements>

---

## Summary

Phase 03 mengimplementasikan alur kader 5 Meja end-to-end. Penelitian menemukan bahwa mayoritas pola implementasi sudah ada di codebase Phase 00-02 (antrian.service.ts, socket.ts, auth.middleware.ts, BullMQ notification queue) dan **hanya 1 dari 18 file target** yang tidak memiliki analog — yaitu `encrypt.ts`.

Tiga domain teknikal yang memerlukan perhatian khusus: (1) **Z-Score WHO** — file `who-growth-tables.json` saat ini kosong (`{}`), harus diisi data LMS WHO 2006 sebelum implementasi Meja 2 bisa benar; (2) **Google Cloud STT** — pola browser-ke-backend memerlukan MediaRecorder (WebM/Opus) → Multer upload → `@google-cloud/speech` recognize, sebuah pola baru yang belum ada di codebase; (3) **Lock-screen Redis** — state harus disimpan di Redis bukan localStorage, sehingga endpoint `GET /api/kader/active-meja` perlu dibuat untuk frontend query saat reload.

Dua paket backend (`openai`, `@google-cloud/speech`) dan satu paket frontend (`recharts`) BELUM ada di package.json dan harus ditambah sebelum implementasi AI dan chart dapat dimulai. Terdapat inkonsistensi versi Zod: backend menggunakan v3.23.8, frontend menggunakan v4.4.3 — ini berarti schema sharing FE/BE tidak bisa langsung dilakukan; Zod schemas harus dijaga terpisah per sisi sampai backend di-upgrade.

**Primary recommendation:** Mulai dari Wave 0 dengan mengisi `who-growth-tables.json`, membuat `encrypt.ts`, dan menambah package yang kurang. Baru kemudian implementasi Meja 1→5 secara berurutan karena setiap meja bergantung pada data dari meja sebelumnya.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lock-screen state (meja aktif) | Backend (Redis) | Frontend (Zustand UI mirror) | Harus persist across reload dan survive tab close — Redis TTL 24 jam; frontend hanya query saat mount |
| Z-Score calculation | Backend (Node.js service) | — | Data sensitif medis; formula deterministik; jangan duplikasi logika di FE |
| AuditLog write | Backend (Prisma tx) | — | WAJIB dalam transaksi yang sama dengan INSERT/UPDATE — tidak bisa di FE |
| Encryption/decryption | Backend (Node.js crypto) | — | Kunci enkripsi tidak boleh ke client; field harus terenkripsi sebelum masuk DB |
| STT (Speech-to-Text) | Backend (Google Cloud API) | Frontend (MediaRecorder capture) | Google API key tidak boleh di client; audio dikirim ke backend via multipart |
| AI Early Warning | Backend (OpenAI API) | — | OpenAI key tidak boleh di client |
| Socket.IO broadcast | Backend (Node.js, setelah tx) | Frontend (listener) | Broadcast WAJIB di luar Prisma transaction |
| Z-Score chart rendering | Frontend (recharts) | — | Display concern; data dari backend |
| Form validasi (BB/TB input) | Frontend (React Hook Form + Zod) | Backend (Zod double-check) | Defense in depth |
| Export rekap (.xlsx/.pdf) | Backend (ExcelJS, pdfkit) | — | File generation di server; stream ke client |

---

## Standard Stack

### Core — Already Installed

| Library | Version (verified) | Purpose | Status |
|---------|---------------------|---------|--------|
| `ioredis` | 5.11.1 | Redis client untuk lock-screen state | [VERIFIED: npm registry] — di backend/package.json |
| `bullmq` | 5.7.0 (package.json: ^5.7.0) | BullMQ WA notification queue | [VERIFIED: npm registry] — di backend/package.json |
| `exceljs` | 4.4.0 | Ekspor rekap harian .xlsx | [VERIFIED: npm registry] — di backend/package.json |
| `pdfkit` | 0.19.1 | Ekspor rekap harian .pdf | [VERIFIED: npm registry] — di backend/package.json |
| `socket.io` | ^4.7.5 | Socket.IO server broadcast | [VERIFIED: npm registry] — di backend/package.json |
| `socket.io-client` | ^4.7.5 | Socket.IO client (frontend) | [VERIFIED: npm registry] — di frontend/package.json |
| `bcrypt` | ^5.1.1 | PIN verification kader | [VERIFIED: npm registry] — di backend/package.json |
| `zod` | BE: ^3.23.8, FE: ^4.4.3 | Schema validation | [VERIFIED: npm registry] — keduanya ada, VERSI BERBEDA (lihat pitfall) |

### New — Must Install

| Library | Version | Purpose | Ecosystem |
|---------|---------|---------|-----------|
| `openai` | 6.45.0 | GPT-4o early warning + STT response | npm (backend) |
| `@google-cloud/speech` | 7.5.0 | Google Cloud STT id-ID | npm (backend) |
| `recharts` | 3.9.1 | Z-Score trend chart di Meja 3 | npm (frontend) |

**Installation (backend):**
```bash
cd backend && npm install openai@6.45.0 @google-cloud/speech@7.5.0
```

**Installation (frontend):**
```bash
cd frontend && npm install recharts@3.9.1
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | chart.js + react-chartjs-2 | recharts is lebih native React (composable JSX); chart.js lebih mature tapi perlu wrapper. Recharts cukup untuk Z-score trend line. |
| @google-cloud/speech (one-shot) | WebSocket streaming | One-shot < 5 detik lebih sederhana untuk Meja 4; streaming hanya dibutuhkan untuk real-time captioning |
| Node.js crypto (AES-GCM) | `crypto-js` atau `argon2` | Node.js built-in tidak perlu install; argon2/bcrypt untuk password bukan data enkripsi. AES-256-GCM adalah standar industri untuk symmetric encryption. |

---

## Package Legitimacy Audit

> slopcheck ditemukan di PATH sebagai python module (`python -m slopcheck`). Registry check dijalankan via `npm view`.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `openai` | npm | 2020 (4+ yr) | github.com/openai/openai-node | [OK] | Approved — official OpenAI SDK, 11.3M downloads/week [VERIFIED: npmjs.com] |
| `@google-cloud/speech` | npm | 2016 (8+ yr) | github.com/googleapis/google-cloud-node | [OK] | Approved — official Google Cloud SDK [VERIFIED: npm registry] |
| `recharts` | npm | 2015 (9+ yr) | github.com/recharts/recharts | [OK] | Approved — canonical React chart library [VERIFIED: npm registry] |

**Packages removed due to [SLOP]:** none
**Packages flagged as [SUS]:** none
**No suspicious postinstall scripts detected** (verified via `npm view <pkg> scripts.postinstall`)

---

## Architecture Patterns

### System Architecture Diagram — Kader 5-Meja Flow

```
Browser (Kader)                 Backend (Express)           External Services
      |                               |                            |
      |  GET /api/kader/active-meja   |                            |
      |------------------------------>|                            |
      |  { activeMeja: 2, slotId }   |  redis.get(kader:{id}:activeMeja)
      |<------------------------------|                            |
      |                               |                            |
      |  [Meja 1: Hadir]              |                            |
      |  PATCH /api/antrian/:id/hadir |                            |
      |------------------------------>|  Prisma tx (SELECT FOR UPDATE)
      |  { statusAntrian: 'dipanggil'}|  AuditLog.create()         |
      |<------------------------------|  io.emit('queue:update')   |
      |                               |  BullMQ.add('wa:dipanggil')|
      |                               |                     Fonnte (via worker)
      |  [Meja 2: Timbang]            |                            |
      |  POST /api/growth/pemeriksaan |                            |
      |------------------------------>|  computeZScore(data, WHO LMS tables)
      |  { zScores, statusGizi }      |  encrypt(catatanKonsultasi)|
      |<------------------------------|  AuditLog.create()         |
      |                               |                            |
      |  [Meja 4: STT + AI]           |                            |
      |  POST /api/voice/transcribe   |                            |
      |  (multipart audio blob)       |  Multer → Google STT       |-------> Google Cloud STT
      |  { transcript }              |                            |
      |<------------------------------|                            |
      |  POST /api/ai/early-warning   |                            |
      |------------------------------>|  OpenAI GPT-4o (temp 0.6) |-------> OpenAI API
      |  { rekomendasiAi, level }    |  encrypt(rekomendasiAi)    |
      |<------------------------------|                            |
      |                               |                            |
      |  [Meja 5: Selesai]            |                            |
      |  PATCH /api/antrian/:id/selesai|                           |
      |------------------------------>|  Prisma tx:                |
      |  { durasiRataAktual }        |    antrian.waktuSelesai    |
      |<------------------------------|    computeMovingAvg()      |
      |                               |    slotSesi.update()       |
      |                               |  io.emit('queue:update')   |
      |                               |  BullMQ.add('wa:selesai') |
```

### Recommended Project Structure (New Files)

```
backend/src/
├── modules/
│   ├── growth/
│   │   ├── growth.routes.ts        # POST /pemeriksaan, GET /balita/:id/history
│   │   ├── growth.controller.ts    # Thin: validate → service → respond
│   │   └── growth.service.ts       # Z-Score calc, encrypt, AuditLog, Prisma
│   ├── immunization/
│   │   ├── immunization.routes.ts  # POST /, GET /balita/:id
│   │   ├── immunization.controller.ts
│   │   └── immunization.service.ts # AuditLog required
│   ├── queue/
│   │   ├── queue-kader.routes.ts   # PATCH hadir, PATCH selesai, GET slot-antrian
│   │   ├── queue-kader.controller.ts
│   │   └── queue-kader.service.ts  # SELECT FOR UPDATE, broadcast, moving avg
│   ├── reports/
│   │   ├── rekap-harian.routes.ts  # GET /rekap-harian?slotId=&format=xlsx|pdf
│   │   └── rekap-harian.service.ts # ExcelJS + pdfkit generation
│   ├── ai/
│   │   ├── ai.routes.ts            # POST /early-warning
│   │   └── ai.service.ts           # GPT-4o call, guardrails, response format
│   └── voice/
│       ├── voice.routes.ts         # POST /transcribe (multipart)
│       └── voice.service.ts        # Multer + @google-cloud/speech
└── shared/
    └── utils/
        └── encrypt.ts              # AES-256-GCM encrypt/decrypt (NO ANALOG EXISTS)

frontend/src/
├── pages/kader/
│   ├── KaderDashboardPage.tsx      # Replace stub, show antrian list + mulai button
│   ├── LockScreenPage.tsx          # PIN entry → backend verify → Redis set
│   └── meja/
│       ├── Meja1Page.tsx           # Checklist kehadiran
│       ├── Meja2Page.tsx           # BB/TB numpad + Z-Score display
│       ├── Meja3Page.tsx           # Z-Score chart + tanda klinis
│       ├── Meja4Page.tsx           # STT recorder + AI early warning
│       └── Meja5Page.tsx           # Selesai button + summary
├── hooks/
│   ├── useKaderSocket.ts           # Socket.IO kader (analog: useAntrianSocket)
│   └── usePemeriksaan.ts           # TanStack Query pemeriksaan CRUD
└── stores/
    └── useKaderMejaStore.ts        # Zustand: activeMeja, antrianAktif (NO persist — Redis is truth)
```

### Pattern 1: Redis Lock-Screen State

**What:** Kader memilih meja → backend simpan `kader:{kaderId}:activeMeja` di Redis dengan TTL 24 jam. Saat reload, frontend query endpoint untuk restore state.

**When to use:** Setiap kali kader pilih meja (set) atau selesai sesi (clear).

**Backend endpoint pattern:**
```typescript
// Source: ioredis docs + CLAUDE.md constraint §Lock-screen state
// GET /api/kader/active-meja
export async function getActiveMeja(req: AuthRequest, res: Response): Promise<void> {
  const kaderId = req.user!.userId
  const key = `kader:${kaderId}:activeMeja`
  const value = await redis.get(key)

  if (!value) {
    res.json({ success: true, data: null })
    return
  }
  // value format: "2:slotId-uuid-here"
  const [mejaStr, slotId] = value.split(':')
  res.json({ success: true, data: { activeMeja: Number(mejaStr), slotId } })
}

// PATCH /api/kader/active-meja
export async function setActiveMeja(req: AuthRequest, res: Response): Promise<void> {
  const kaderId = req.user!.userId
  const { mejaNumber, slotId } = req.body
  const key = `kader:${kaderId}:activeMeja`
  await redis.set(key, `${mejaNumber}:${slotId}`, 'EX', 86400) // TTL 24 jam
  res.json({ success: true, data: { activeMeja: mejaNumber, slotId } })
}

// DELETE /api/kader/active-meja
export async function clearActiveMeja(req: AuthRequest, res: Response): Promise<void> {
  const kaderId = req.user!.userId
  await redis.del(`kader:${kaderId}:activeMeja`)
  res.json({ success: true, data: null })
}
```

**Frontend hook pattern:**
```typescript
// Source: TanStack Query pattern dari codebase (useSesiAvailability analog)
export function useActiveMeja() {
  return useQuery({
    queryKey: ['kader', 'active-meja'],
    queryFn: () => apiClient.get('/kader/active-meja').then(r => r.data.data),
    staleTime: 0,           // Always fresh — ini adalah lock state
    refetchOnMount: true,   // Re-check setiap mount (page reload)
  })
}
```

**PENTING:** Zustand store `useKaderMejaStore` TIDAK boleh persist ke localStorage untuk activeMeja — Redis adalah sumber kebenaran. Store hanya UI mirror untuk avoid unnecessary API calls dalam satu sesi.

---

### Pattern 2: Z-Score WHO 2006 Computation

**What:** Mengambil nilai L, M, S dari tabel WHO berdasarkan indikator + jenis kelamin + umur/TB, lalu hitung Z.

**Formula:** `Z = ((nilai / M)^L - 1) / (L × S)`

**Expected JSON structure for `who-growth-tables.json`:**
```json
{
  "WAZ": {
    "male": [
      { "ageMonths": 0, "L": -0.3521, "M": 3.3464, "S": 0.14602 },
      { "ageMonths": 1, "L": -0.3521, "M": 4.4709, "S": 0.13395 }
    ],
    "female": [
      { "ageMonths": 0, "L": 0.3809, "M": 3.2322, "S": 0.14171 }
    ]
  },
  "HAZ": {
    "male": [
      { "ageMonths": 0, "L": 1, "M": 49.8842, "S": 0.03795 }
    ],
    "female": [...]
  },
  "WHZ": {
    "male": [
      { "lengthCm": 45.0, "L": -3.3069, "M": 2.441, "S": 0.09182 }
    ],
    "female": [...]
  }
}
```

**KRITIS:** File ini saat ini KOSONG (`{}`). Harus diisi dengan data WHO 2006 sebelum Meja 2 bisa berfungsi. Data resmi tersedia di: https://www.who.int/tools/child-growth-standards/standards

**Service pattern:**
```typescript
// Source: CLAUDE.md §Z-Score WHO
import whoTables from '../../shared/data/who-growth-tables.json'

type Indicator = 'WAZ' | 'HAZ' | 'WHZ'
type Sex = 'male' | 'female'

interface LMSRow {
  ageMonths?: number   // untuk WAZ dan HAZ
  lengthCm?: number    // untuk WHZ
  L: number
  M: number
  S: number
}

function getLmsRow(
  indicator: Indicator,
  sex: Sex,
  lookup: number  // ageMonths untuk WAZ/HAZ, lengthCm untuk WHZ
): LMSRow | null {
  const table = (whoTables as Record<string, Record<string, LMSRow[]>>)[indicator]?.[sex]
  if (!table) return null

  // Interpolasi linear jika tidak ada nilai exact (usia pecahan)
  const field = indicator === 'WHZ' ? 'lengthCm' : 'ageMonths'
  const exact = table.find(row => row[field as keyof LMSRow] === lookup)
  if (exact) return exact

  // Gunakan nilai terdekat (floor) — pendekatan konservatif
  const sorted = [...table].sort((a, b) => (a[field as keyof LMSRow] as number) - (b[field as keyof LMSRow] as number))
  const lower = sorted.filter(r => (r[field as keyof LMSRow] as number) <= lookup).pop()
  return lower ?? sorted[0] ?? null
}

export function computeZScore(
  indicator: Indicator,
  sex: Sex,
  value: number,
  lookup: number
): number | null {
  const row = getLmsRow(indicator, sex, lookup)
  if (!row) return null

  const { L, M, S } = row
  // CLAUDE.md §Z-Score WHO: Z = ((nilai/M)^L - 1) / (L × S)
  if (Math.abs(L) < 0.001) {
    // L ≈ 0: gunakan log approximation (penanganan tepi WHO)
    return Math.log(value / M) / S
  }
  return (Math.pow(value / M, L) - 1) / (L * S)
}
```

**Age calculation (ageMonths):**
```typescript
function ageInMonths(tanggalLahir: Date, tanggalPemeriksaan: Date): number {
  const diffMs = tanggalPemeriksaan.getTime() - tanggalLahir.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375)) // rata-rata hari per bulan
}
```

---

### Pattern 3: Encryption (AES-256-GCM)

**What:** Enkripsi `catatanKonsultasi` dan `rekomendasiAi` sebelum simpan ke DB. Dekripsi saat read.

**No analog exists in codebase** — file baru: `backend/src/shared/utils/encrypt.ts`

```typescript
// Source: Node.js crypto module documentation [CITED: nodejs.org/api/crypto.html]
// Verifikasi: AES-256-GCM adalah standar yang direkomendasikan untuk data-at-rest [ASSUMED]
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV adalah standard untuk GCM
const TAG_LENGTH = 16  // 128-bit auth tag

function getKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY harus berupa hex string 64 karakter (32 bytes)')
  }
  return Buffer.from(hexKey, 'hex')
}

/**
 * encrypt — Enkripsi plaintext string dengan AES-256-GCM.
 * Output: "${iv_hex}:${authTag_hex}:${ciphertext_hex}"
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * decrypt — Dekripsi ciphertext yang di-encrypt() di atas.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Format ciphertext tidak valid')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
```

**Env var yang harus ditambah ke `env.ts`:**
```typescript
ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, {
  message: 'ENCRYPTION_KEY harus berupa 64-char hex string (32 bytes)'
}),
OPENAI_API_KEY: z.string().min(1),
GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(), // path ke service account JSON
```

**Generate ENCRYPTION_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Pattern 4: AuditLog Write (dalam Prisma Transaction)

**What:** Setiap INSERT/UPDATE di Pemeriksaan dan Imunisasi WAJIB tulis AuditLog dalam transaksi yang sama.

```typescript
// Source: prisma/schema.prisma model AuditLog (lines 346-362) [VERIFIED: codebase grep]
// Pattern dari 03-PATTERNS.md §Shared Patterns

await prisma.$transaction(async (tx) => {
  // 1. Create pemeriksaan
  const pemeriksaan = await tx.pemeriksaan.create({
    data: {
      balitaId,
      kaderId,
      antrianId,
      beratBadan,
      tinggiBadan,
      zScoreBbU,
      zScoreTbU,
      zScoreBbTb,
      statusGizi,
      catatanKonsultasi: catatanKonsultasi ? encrypt(catatanKonsultasi) : null,
      rekomendasiAi: rekomendasiAi ? encrypt(rekomendasiAi) : null,
      tandaKlinis,
    },
  })

  // 2. Tulis AuditLog — WAJIB dalam transaksi yang sama (CLAUDE.md §Keamanan)
  await tx.auditLog.create({
    data: {
      userId: kaderId,
      userRole: 'kader',
      aksi: 'CREATE_PEMERIKSAAN',
      tabelTerkait: 'pemeriksaan',
      recordId: pemeriksaan.id,
      dataSebelum: null,
      dataSesudah: {
        beratBadan,
        tinggiBadan,
        zScoreBbU,
        zScoreTbU,
        zScoreBbTb,
        statusGizi,
        // JANGAN masukkan catatanKonsultasi/rekomendasiAi ke AuditLog dataSesudah
      },
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    },
  })

  return pemeriksaan
})
```

**PENTING:** `catatanKonsultasi` dan `rekomendasiAi` TIDAK boleh masuk ke `dataSesudah` AuditLog — AuditLog menyimpan plaintext metadata, bukan data medis sensitif.

---

### Pattern 5: Google Cloud STT (One-Shot)

**What:** Kader tekan rekam → MediaRecorder capture audio → stop → kirim blob ke backend → Google STT → kembalikan transcript.

**Architecture: Non-streaming (one-shot) dipilih** karena:
- Kader merekam lalu stop (tidak perlu interim results)
- Simpler implementation
- Target < 5 detik untuk audio pendek (catatan singkat kader)

**Frontend (MediaRecorder):**
```typescript
// Source: Web API MediaRecorder [CITED: developer.mozilla.org/en-US/docs/Web/API/MediaRecorder]
// Encoding: WEBM_OPUS didukung Google Cloud STT [VERIFIED: docs.cloud.google.com/speech-to-text/docs/encoding]

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    chunksRef.current = []
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setAudioBlob(blob)
      stream.getTracks().forEach(t => t.stop())
    }
    recorder.start()
    mediaRecorderRef.current = recorder
    setIsRecording(true)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  return { isRecording, audioBlob, startRecording, stopRecording }
}
```

**Frontend mutation ke backend:**
```typescript
const transcribeMutation = useMutation({
  mutationFn: async (blob: Blob) => {
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')
    return apiClient.post('/api/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data.transcript as string)
  },
})
```

**Backend (voice.service.ts):**
```typescript
// Source: @google-cloud/speech Node.js library [CITED: npmjs.com/package/@google-cloud/speech]
import { SpeechClient } from '@google-cloud/speech'

const speechClient = new SpeechClient() // Kredensial dari GOOGLE_APPLICATION_CREDENTIALS env

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const [response] = await speechClient.recognize({
    audio: { content: audioBuffer.toString('base64') },
    config: {
      encoding: 'WEBM_OPUS',       // [VERIFIED: docs.cloud.google.com/speech-to-text/docs/encoding]
      sampleRateHertz: 48000,      // Default MediaRecorder WebM/Opus sample rate
      languageCode: 'id-ID',       // CLAUDE.md §STT: id-ID
      model: 'latest_long',        // Best accuracy untuk conversational speech
      enableAutomaticPunctuation: true,
    },
  })

  const transcript = response.results
    ?.map(r => r.alternatives?.[0]?.transcript ?? '')
    .join(' ')
    .trim() ?? ''

  return transcript
}
```

**Backend route (dengan Multer):**
```typescript
import multer from 'multer'
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

voiceRouter.post('/transcribe',
  authMiddleware,
  requireRole('kader', 'ketua_kader'),
  upload.single('audio'),
  transcribeHandler
)
```

---

### Pattern 6: GPT-4o Early Warning

**What:** Setelah Meja 2 data tersimpan, kader bisa generate AI early warning berdasarkan Z-Score + tanda klinis.

**Temperature:** 0.6 (sesuai CLAUDE.md §AI Early Warning)

```typescript
// Source: openai SDK v6 [CITED: npmjs.com/package/openai]
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface EarlyWarningInput {
  namaBalita: string
  usiaBulan: number
  jenisKelamin: 'laki_laki' | 'perempuan'
  beratBadan: number
  tinggiBadan: number
  zScoreBbU: number | null
  zScoreTbU: number | null
  zScoreBbTb: number | null
  statusGizi: string
  tandaKlinis: {
    rambutKemerahan: boolean
    perutBuncit: boolean
    edema: boolean
    pucat: boolean
    lainnya?: string | null
  }
}

export async function generateEarlyWarning(input: EarlyWarningInput): Promise<{
  level: 'normal' | 'waspada' | 'kritis'
  ringkasan: string
  rekomendasi: string
}> {
  const tandaKlinisStr = Object.entries(input.tandaKlinis)
    .filter(([k, v]) => v && k !== 'lainnya')
    .map(([k]) => k.replace(/([A-Z])/g, ' $1').toLowerCase())
    .join(', ')

  const systemPrompt = `Anda adalah sistem peringatan dini stunting untuk kader Posyandu Indonesia.
Tugas Anda: analisis data pertumbuhan balita dan berikan early warning dalam Bahasa Indonesia yang sopan dan mudah dipahami kader.
Hanya jawab pertanyaan terkait kesehatan gizi dan pertumbuhan balita.
Respons HARUS berupa JSON dengan format: { "level": "normal|waspada|kritis", "ringkasan": "...", "rekomendasi": "..." }
- level "normal": semua Z-Score antara -2 dan +2, tidak ada tanda klinis
- level "waspada": salah satu Z-Score antara -3 dan -2, atau ada tanda klinis
- level "kritis": Z-Score < -3 pada indikator manapun, atau edema positif`

  const userPrompt = `Data balita:
- Nama: ${input.namaBalita} (${input.usiaBulan} bulan, ${input.jenisKelamin === 'laki_laki' ? 'Laki-laki' : 'Perempuan'})
- BB: ${input.beratBadan} kg, TB: ${input.tinggiBadan} cm
- Z-Score BB/U: ${input.zScoreBbU?.toFixed(2) ?? 'tidak tersedia'}
- Z-Score TB/U: ${input.zScoreTbU?.toFixed(2) ?? 'tidak tersedia'}
- Z-Score BB/TB: ${input.zScoreBbTb?.toFixed(2) ?? 'tidak tersedia'}
- Status Gizi Saat Ini: ${input.statusGizi}
- Tanda Klinis: ${tandaKlinisStr || 'tidak ada'}
${input.tandaKlinis.lainnya ? `- Tanda Lainnya: ${input.tandaKlinis.lainnya}` : ''}

Berikan early warning analysis.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.6,       // CLAUDE.md §AI Early Warning
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(content) as {
    level: 'normal' | 'waspada' | 'kritis'
    ringkasan: string
    rekomendasi: string
  }
  return parsed
}
```

---

### Pattern 7: Moving Average durasiRataAktual (Meja 5)

**What:** Setiap kader klik Selesai, update `SlotSesi.durasiRataAktual` dengan cumulative moving average.

**Formula dari 03-PATTERNS.md:**
```
durasiRataAktual_baru = (durasiRataAktual_lama × (n-1) + durasiLayananBaru) / n
```
di mana `n` adalah jumlah antrian yang sudah selesai di slot ini (setelah klik Selesai ini).

```typescript
// Source: 03-PATTERNS.md §Moving average formula [VERIFIED: codebase]
export async function selesaikanAntrian(antrianId: string, kaderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE untuk atomic update
    const rows = await tx.$queryRaw<Array<{
      id: string
      statusAntrian: string
      slotId: string
      waktuMulaiLayanan: Date | null
    }>>`
      SELECT id, "statusAntrian", "slotId", "waktuMulaiLayanan"
      FROM antrian WHERE id = ${antrianId} FOR UPDATE
    `
    const antrian = rows[0]
    if (!antrian) throw Object.assign(new Error('Antrian tidak ditemukan'), { code: 'ANTRIAN_TIDAK_DITEMUKAN' })
    if (antrian.statusAntrian !== 'dipanggil') {
      throw Object.assign(new Error('Antrian belum aktif'), { code: 'ANTRIAN_BELUM_AKTIF' })
    }

    const waktuSelesai = new Date()
    const durasiLayananBaru = antrian.waktuMulaiLayanan
      ? (waktuSelesai.getTime() - antrian.waktuMulaiLayanan.getTime()) / 60000
      : null

    await tx.antrian.update({
      where: { id: antrianId },
      data: { statusAntrian: 'selesai', waktuSelesai },
    })

    // Hitung moving average hanya jika durasi valid
    if (durasiLayananBaru !== null && durasiLayananBaru > 0 && durasiLayananBaru < 60) {
      const slot = await tx.slotSesi.findUnique({
        where: { id: antrian.slotId },
        select: { durasiRataAktual: true },
      })

      // n = jumlah antrian selesai setelah update ini
      const n = await tx.antrian.count({
        where: { slotId: antrian.slotId, statusAntrian: 'selesai' },
      })
      // n sudah include antrian yang baru saja kita update di atas

      const oldAvg = slot?.durasiRataAktual ?? durasiLayananBaru
      const newAvg = n <= 1
        ? durasiLayananBaru
        : (oldAvg * (n - 1) + durasiLayananBaru) / n

      await tx.slotSesi.update({
        where: { id: antrian.slotId },
        data: { durasiRataAktual: newAvg },
      })
    }
  })

  // Broadcast DI LUAR transaksi — CLAUDE.md §Antrian point 3
  void broadcastQueueUpdate(/* slotId dari antrian */)
}
```

---

### Pattern 8: ExcelJS Rekap Harian

```typescript
// Source: exceljs npm package [CITED: npmjs.com/package/exceljs]
// Note: ini rekap harian kader, BUKAN e-PPGBM (Phase 05)
import ExcelJS from 'exceljs'

export async function generateRekapHarianXlsx(slotId: string): Promise<Buffer> {
  const pemeriksaanList = await prisma.pemeriksaan.findMany({
    where: { antrian: { slotId }, tanggalPemeriksaan: today() },
    include: { balita: { include: { warga: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Rekap Harian')

  sheet.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Balita', key: 'namaBalita', width: 25 },
    { header: 'Umur (bln)', key: 'usiaBulan', width: 12 },
    { header: 'BB (kg)', key: 'beratBadan', width: 10 },
    { header: 'TB (cm)', key: 'tinggiBadan', width: 10 },
    { header: 'Z-Score BB/U', key: 'zScoreBbU', width: 14 },
    { header: 'Z-Score TB/U', key: 'zScoreTbU', width: 14 },
    { header: 'Z-Score BB/TB', key: 'zScoreBbTb', width: 14 },
    { header: 'Status Gizi', key: 'statusGizi', width: 15 },
  ]

  // Bold header row
  sheet.getRow(1).font = { bold: true }

  pemeriksaanList.forEach((p, i) => {
    sheet.addRow({
      no: i + 1,
      namaBalita: p.balita.namaBalita,
      usiaBulan: ageInMonths(p.balita.tanggalLahir, p.tanggalPemeriksaan),
      beratBadan: p.beratBadan,
      tinggiBadan: p.tinggiBadan,
      zScoreBbU: p.zScoreBbU?.toFixed(2),
      zScoreTbU: p.zScoreTbU?.toFixed(2),
      zScoreBbTb: p.zScoreBbTb?.toFixed(2),
      statusGizi: p.statusGizi,
    })
  })

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as Buffer
}
```

---

### Pattern 9: Z-Score Chart (recharts, Meja 3)

```tsx
// Source: recharts docs [CITED: recharts.org]
// Z-Score history chart: satu line per indikator, reference lines di -3, -2, 0, +2, +3
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface ZScoreDataPoint {
  tanggal: string   // DD/MM/YYYY
  bbU: number | null
  tbU: number | null
  bbTb: number | null
}

export function ZScoreChart({ data }: { data: ZScoreDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
        <YAxis domain={[-4, 4]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => v?.toFixed(2)} />
        <Legend />
        {/* Reference lines untuk zona status gizi */}
        <ReferenceLine y={2}  stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '+2 SD', position: 'right', fontSize: 10 }} />
        <ReferenceLine y={0}  stroke="#6b7280" strokeDasharray="4 2" />
        <ReferenceLine y={-2} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '-2 SD', position: 'right', fontSize: 10 }} />
        <ReferenceLine y={-3} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '-3 SD', position: 'right', fontSize: 10 }} />
        <Line type="monotone" dataKey="bbU"  name="BB/U"  stroke="#10b981" dot={false} connectNulls />
        <Line type="monotone" dataKey="tbU"  name="TB/U"  stroke="#3b82f6" dot={false} connectNulls />
        <Line type="monotone" dataKey="bbTb" name="BB/TB" stroke="#f97316" dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

---

### Anti-Patterns to Avoid

- **Broadcast di dalam Prisma transaction:** `broadcastQueueUpdate()` HARUS dipanggil setelah transaksi commit. Sudah ada warning eksplisit di `antrian.service.ts` komentar T-02-14.
- **localStorage untuk lock-screen state:** State meja aktif harus di Redis. localStorage tidak reliable untuk multi-tab dan bisa di-clear user.
- **Hardcode Z-Score formula tanpa tabel:** Menggunakan nilai WHO dari ingatan. SELALU baca dari `who-growth-tables.json`.
- **Enkripsi password/PIN dengan AES-GCM:** PIN kader tetap dengan bcrypt. AES-GCM hanya untuk field medis sensitif.
- **Decrypt catatanKonsultasi sebelum AuditLog:** AuditLog harus menyimpan metadata saja, bukan plaintext catatan medis.
- **Kirim API key ke frontend:** OpenAI key dan Google credentials tidak boleh ke browser.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Symmetric encryption | Custom XOR atau base64 "encoding" | `crypto.createCipheriv('aes-256-gcm')` built-in | AES-GCM memberikan authenticated encryption — tamper detection gratis |
| Z-Score calculation | Formula dari ingatan atau hardcode L/M/S | `who-growth-tables.json` + compute function | Data WHO 2006 memiliki 5400+ baris per indikator; formula dari ingatan sering salah tepi |
| Speech recording | Custom Web Audio API processor | Web API `MediaRecorder` | MediaRecorder sudah handle codec negotiation, buffering, format |
| STT | On-device Whisper.js | `@google-cloud/speech` v7 | Indonesian (id-ID) accuracy jauh lebih baik di Google STT |
| Chart dari scratch | SVG d3 manual | `recharts` | Reference lines, tooltips, responsive container sudah ada |
| Moving average | Complex EWMA | Simple CMA `(old * (n-1) + new) / n` | CMA cukup untuk pelayanan posyandu; EWMA menambah kompleksitas tanpa benefit nyata |
| Excel file | Manual CSV concat | `exceljs` | ExcelJS handle formatting, freeze row, column width, buffer stream |

**Key insight:** Domain ini penuh dengan "tampak mudah, sebenarnya detail-sensitif" — Z-Score tepi kasus (L ≈ 0), GCM auth tag handling, MediaRecorder browser compatibility. Gunakan library yang sudah handle edge cases ini.

---

## Common Pitfalls

### Pitfall 1: who-growth-tables.json kosong

**What goes wrong:** File ada tapi isinya `{}` — semua Z-Score return `null`, status gizi tidak bisa dihitung, Meja 2 tidak berfungsi.

**Why it happens:** File placeholder belum diisi data WHO 2006.

**How to avoid:** Wave 0 harus include task mengisi file ini dengan data resmi WHO 2006 LMS tables (weight-for-age, height-for-age, weight-for-height) untuk 0-60 bulan. Data tersedia di: https://www.who.int/tools/child-growth-standards/standards (download CSV, convert ke JSON).

**Warning signs:** `computeZScore()` selalu return `null`; `statusGizi` selalu `null` di DB.

---

### Pitfall 2: Z-Score L ≈ 0 (Box-Cox degenerate case)

**What goes wrong:** Jika `L` sangat mendekati 0 (misal L = 0.0001), formula `(Math.pow(value/M, L) - 1) / (L × S)` → numerically unstable, mendekati `log(value/M) / S` tapi dengan floating point error besar.

**Why it happens:** Beberapa row WHO memiliki L sangat kecil (khususnya Weight-for-Height pada panjang tertentu).

**How to avoid:** Guard `if (Math.abs(L) < 0.001) return Math.log(value / M) / S`.

---

### Pitfall 3: Broadcast Socket.IO sebelum transaksi commit

**What goes wrong:** `broadcastQueueUpdate()` dipanggil di dalam `prisma.$transaction()` callback. Jika transaksi rollback setelah broadcast, citizen melihat update yang tidak pernah terjadi.

**Why it happens:** Developer menaruh broadcast di dalam tx untuk "convenience".

**How to avoid:** Pattern sudah documented di `antrian.service.ts` T-02-14 — SELALU broadcast setelah `await prisma.$transaction(...)` selesai.

---

### Pitfall 4: Zod version mismatch (BE v3 vs FE v4)

**What goes wrong:** Jika schema dari `backend/src/shared/schemas/` di-import langsung ke frontend, build error karena Zod v3 API berbeda dari Zod v4. Contoh: `z.string().nonempty()` di v3 tidak ada di v4 (ganti `z.string().min(1)`).

**Why it happens:** frontend/package.json menggunakan `"zod": "^4.4.3"` sedangkan backend menggunakan `"zod": "^3.23.8"`.

**How to avoid:** Jangan import schema dari backend di frontend. Duplicate schema yang dibutuhkan di `frontend/src/lib/schemas/` menggunakan Zod v4 API. Atau update backend ke Zod v4 terlebih dahulu (luar scope Phase 03).

---

### Pitfall 5: GCM auth tag tidak disimpan bersama ciphertext

**What goes wrong:** Decrypt gagal dengan "Unsupported state or unable to authenticate data" karena auth tag tidak di-set sebelum decipher.final().

**Why it happens:** GCM mode memerlukan auth tag untuk verify integrity. Jika format storage tidak include auth tag, tidak bisa decrypt.

**How to avoid:** Format storage: `"${iv_hex}:${authTag_hex}:${ciphertext_hex}"` — tiga bagian dipisah colon. Pastikan `decipher.setAuthTag(authTag)` dipanggil sebelum `decipher.final()`.

---

### Pitfall 6: MediaRecorder mimeType tidak didukung semua browser

**What goes wrong:** `new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })` throw error di Safari karena Safari tidak support WebM.

**Why it happens:** Safari mendukung `audio/mp4` (AAC), bukan WebM/Opus.

**How to avoid:** Check support sebelum create:
```typescript
const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : MediaRecorder.isTypeSupported('audio/mp4')
  ? 'audio/mp4'
  : ''
```
Untuk audio/mp4, gunakan encoding `MP3` atau kirim raw dan biarkan Google auto-detect. Namun untuk target posyandu (Android Chrome dominan), `audio/webm;codecs=opus` + `WEBM_OPUS` encoding adalah path utama.

---

### Pitfall 7: Lock-screen bypass via URL navigation

**What goes wrong:** Kader di Meja 2, langsung navigasi ke `/kader/meja/5` via URL bar — melewati meja sebelumnya.

**Why it happens:** Tidak ada guard di backend untuk memvalidasi urutan meja.

**How to avoid:** Backend `PATCH /api/antrian/:id/selesai` harus validasi bahwa antrian memiliki `waktuCheckin` (Meja 1 sudah dilakukan) dan `pemeriksaan` entry (Meja 2 sudah dilakukan). Jika tidak, tolak dengan 409.

---

### Pitfall 8: ENCRYPTION_KEY tidak ada di .env saat development

**What goes wrong:** `encrypt()` throw `Error: ENCRYPTION_KEY harus berupa hex string 64 karakter` saat pertama kali dipakai.

**Why it happens:** Developer lupa tambah ENCRYPTION_KEY ke `.env`.

**How to avoid:** Tambah ke Zod env schema (`env.ts`) — schema validation yang sudah ada akan fail-fast saat startup jika key tidak ada. Tambah instruksi generate key di `.env.example`.

---

## Runtime State Inventory

> Phase 03 adalah greenfield implementation (no rename/refactor). Namun ada satu catatan penting:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `who-growth-tables.json` is `{}` — no historical Z-Scores will compute | Populate dengan data WHO 2006 LMS (Wave 0 task) |
| Live service config | Redis — tidak ada state kader yang disimpan saat ini (Phase 02 hanya queue data) | None pre-existing; kader:{id}:activeMeja keys dibuat oleh Phase 03 |
| OS-registered state | None | None |
| Secrets/env vars | `ENCRYPTION_KEY`, `OPENAI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` — belum ada di `env.ts` | Tambah ke env.ts Zod schema + .env + .env.example |
| Build artifacts | None stale | None |

**Nothing found requiring data migration** — ini adalah greenfield feature addition, bukan rename/refactor.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openai` npm package | AI Early Warning (Meja 4) | ✗ (belum di package.json) | 6.45.0 tersedia | Meja 4 AI disabled sampai install |
| `@google-cloud/speech` npm package | STT (Meja 4) | ✗ (belum di package.json) | 7.5.0 tersedia | STT disabled sampai install |
| `recharts` npm package | Z-Score chart (Meja 3) | ✗ (belum di frontend package.json) | 3.9.1 tersedia | Chart tidak muncul sampai install |
| `OPENAI_API_KEY` env var | OpenAI API calls | ✗ (tidak ada di env.ts) | — | Wave 0: tambah ke schema + .env |
| `GOOGLE_APPLICATION_CREDENTIALS` env var | Google STT | ✗ (tidak ada di env.ts) | — | Wave 0: tambah + provision service account |
| `ENCRYPTION_KEY` env var | AES-256-GCM encrypt/decrypt | ✗ (tidak ada di env.ts) | — | Wave 0: generate + tambah ke .env |
| Redis (via `ioredis`) | Lock-screen state | ✓ (sudah di package.json + config) | 5.11.1 | — |
| PostgreSQL (via Prisma) | Semua data persistence | ✓ | 5.15.0 Prisma | — |
| Socket.IO | Queue broadcast | ✓ (sudah ada + digunakan Phase 02) | 4.7.5 | — |
| BullMQ | WA notifications | ✓ (sudah ada + digunakan Phase 01-02) | 5.7.0 | — |

**Missing dependencies with no fallback:**
- `openai` + `OPENAI_API_KEY` — KADER-05 partial (STT masih bisa, AI tidak)
- `@google-cloud/speech` + `GOOGLE_APPLICATION_CREDENTIALS` — KADER-05 STT disabled
- `ENCRYPTION_KEY` — KADER-03/05 BLOCKED (catatan medis tidak bisa disimpan tanpa enkripsi)

**Missing dependencies with fallback:**
- `recharts` — KADER-04 chart tidak muncul, tanda klinis form masih bisa berjalan

---

## Validation Architecture

> `workflow.nyquist_validation: true` dalam config.json — section ini WAJIB.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Tidak ada test framework yang terdeteksi di codebase |
| Config file | none — Wave 0 harus setup |
| Quick run command | `cd backend && npm test` (setelah Wave 0 setup) |
| Full suite command | `cd backend && npm test -- --coverage` |

**Catatan:** Tidak ada test file ditemukan di codebase (fase 0-2 tidak ada unit tests). Wave 0 Phase 03 harus include setup test framework minimal (vitest untuk backend TypeScript atau jest).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KADER-03 | Z-Score BB/U laki-laki 0 bulan, BB 3.3kg → Z ≈ -0.01 | unit | `npm test -- growth.test.ts` | ❌ Wave 0 |
| KADER-03 | Z-Score L ≈ 0 edge case tidak NaN/Infinity | unit | `npm test -- growth.test.ts` | ❌ Wave 0 |
| KADER-03 | encrypt('text') → format "iv:tag:ct"; decrypt(encrypt('text')) === 'text' | unit | `npm test -- encrypt.test.ts` | ❌ Wave 0 |
| KADER-03 | BB 85 kg (biologis tidak valid) → 400 VALIDASI_GAGAL | unit | `npm test -- growth.test.ts` | ❌ Wave 0 |
| KADER-06 | moving average 3 samples: (7+8+9)/3 ≈ 8.0 | unit | `npm test -- queue-kader.test.ts` | ❌ Wave 0 |
| KADER-07 | ExcelJS output berisi header + data rows | unit | `npm test -- rekap-harian.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- [test-file] --run` (quick, satu file)
- **Per wave merge:** `npm test -- --run` (semua test files)
- **Phase gate:** Full suite green + manual smoke test 5-Meja flow sebelum `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/src/modules/growth/__tests__/growth.test.ts` — covers KADER-03 Z-Score
- [ ] `backend/src/shared/utils/__tests__/encrypt.test.ts` — covers encryption round-trip
- [ ] `backend/src/modules/queue/__tests__/queue-kader.test.ts` — covers KADER-06 moving avg
- [ ] `backend/src/modules/reports/__tests__/rekap-harian.test.ts` — covers KADER-07
- [ ] Test framework setup: pilih vitest (`npm install -D vitest`) atau jest

---

## Security Domain

> `security_enforcement: true` dalam config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `authMiddleware` JWT httpOnly cookie — sudah ada |
| V3 Session Management | Yes | Redis TTL 24 jam untuk lock-screen; JWT expiry via refresh token |
| V4 Access Control | Yes | `requireRole('kader', 'ketua_kader')` pada semua kader endpoints |
| V5 Input Validation | Yes | Zod schema validation — BB 0.5-30 kg, TB 40-130 cm; konfirmasi untuk nilai ekstrem |
| V6 Cryptography | Yes | AES-256-GCM (Node.js built-in) untuk `catatanKonsultasi` dan `rekomendasiAi` |
| V7 Error Handling | Yes | Error codes tidak mengekspose stack trace ke client (pola sudah ada dari Phase 01-02) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Kader akses data antrian milik posyandu lain | Spoofing + IDOR | Filter `kader.posyanduId` pada setiap query antrian |
| Manipulasi Z-Score via request body | Tampering | Backend hitung sendiri dari tabel WHO — JANGAN trust Z-Score dari request body |
| Enkripsi field medis bypass | Info Disclosure | `encrypt()` dipanggil di service layer, bukan di controller — tidak bisa bypass via request |
| Google STT audio upload file besar | DoS | `multer limits: { fileSize: 10MB }` |
| OpenAI prompt injection via nama balita | Tampering | Input nama balita di-escape sebelum masuk prompt; system prompt tetap di server |
| Redis key collision antar kader | Spoofing | Key format `kader:{kaderId}:activeMeja` — kaderId dari JWT (tidak bisa dimanipulasi) |
| AuditLog bypass | Non-repudiation | AuditLog dalam Prisma transaction yang sama dengan INSERT/UPDATE |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CMA (cumulative moving average) cukup untuk estimasi durasi — tidak perlu EWMA | §Moving Average | durasiRataAktual kurang responsif terhadap perubahan kecepatan pelayanan (impact: UX, bukan correctness) |
| A2 | `model: 'latest_long'` adalah pilihan terbaik untuk Google STT bahasa Indonesia | §STT Pattern | Accuracy STT lebih rendah dari optimal; bisa diganti ke 'default' tanpa breaking change |
| A3 | AES-256-GCM key cukup dari env var tanpa KMS (Key Management Service) | §Encryption | Jika server compromise, key juga compromise; akzeptabel untuk akademik scope |
| A4 | Recharts v3 (latest) kompatibel dengan React 18 | §Standard Stack | Jika incompatible, upgrade recharts atau gunakan chart.js |
| A5 | `GOOGLE_APPLICATION_CREDENTIALS` env var path-based credentials (JSON file) | §STT Pattern | Jika menggunakan Workload Identity atau ADC berbeda, init SpeechClient perlu disesuaikan |

---

## Open Questions

1. **WHO Growth Tables population**
   - What we know: file kosong, data WHO 2006 tersedia di who.int
   - What's unclear: apakah tersedia dalam format JSON atau perlu convert dari CSV/Excel
   - Recommendation: Wave 0 task harus download CSV dari who.int dan convert ke JSON struktur yang sudah didefinisikan di §Pattern 2

2. **Google Cloud credentials untuk development**
   - What we know: `@google-cloud/speech` membutuhkan service account
   - What's unclear: apakah tim sudah memiliki Google Cloud project + service account untuk SISPOS
   - Recommendation: Jika belum ada credentials, Meja 4 STT bisa di-stub dengan transcript dummy untuk development; aktifkan saat staging

3. **Meja urutan enforcement level**
   - What we know: kader bisa navigate antar meja
   - What's unclear: seberapa ketat enforcement urutan (1→2→3→4→5)? Apakah kader boleh skip Meja 3 jika tanda klinis tidak ada?
   - Recommendation: Enforcement minimal — Meja 1 (hadir) required sebelum Meja 2-5; Meja 3-4 optional; Meja 5 (selesai) required untuk update countdown

4. **ENCRYPTION_KEY rotation strategy**
   - What we know: key disimpan di env var
   - What's unclear: jika key di-rotate, data lama tidak bisa di-decrypt
   - Recommendation: Scope akademik — satu key, tidak ada rotation. Catat di CLAUDE.md untuk produksi real.

---

## Sources

### Primary (HIGH confidence)
- [codebase] `backend/src/modules/antrian/antrian.service.ts` — broadcastQueueUpdate pattern, Prisma tx pattern, SELECT FOR UPDATE
- [codebase] `backend/src/config/redis.ts` — IORedis client setup
- [codebase] `backend/src/config/socket.ts` — Socket.IO server, room pattern
- [codebase] `prisma/schema.prisma` — AuditLog model, Pemeriksaan model, SlotSesi model
- [codebase] `.planning/phases/03-kader-5-meja/03-PATTERNS.md` — pattern mapper output, analog analysis
- [codebase] `backend/package.json`, `frontend/package.json` — actual installed versions
- [npm registry] `npm view openai`, `npm view @google-cloud/speech`, `npm view recharts`, `npm view exceljs`, `npm view pdfkit` — version verification

### Secondary (MEDIUM confidence)
- [CITED: docs.cloud.google.com/speech-to-text/docs/encoding] — WEBM_OPUS dan OGG_OPUS encoding support verified
- [CITED: nodejs.org/api/crypto.html] — AES-256-GCM API, IV length, auth tag
- [CITED: recharts.org] — LineChart, ReferenceLine API
- [CITED: npmjs.com/package/exceljs] — Workbook, Worksheet, addRow API
- [CITED: npmjs.com/package/openai] — Chat completions API, response_format json_object

### Tertiary (LOW confidence)
- [ASSUMED] CMA sufficient for durasiRataAktual (berdasarkan training knowledge tentang posyandu workflow)
- [ASSUMED] Google STT `model: 'latest_long'` untuk bahasa Indonesia accuracy
- [ASSUMED] `audio/webm;codecs=opus` dominant di Android Chrome (target device kader)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — semua packages verified via npm view, versions dari package.json
- Architecture: HIGH — patterns verified directly from codebase, no speculation
- Z-Score formula: HIGH — CLAUDE.md mandates exact formula, verified against WHO documentation
- STT pattern: MEDIUM — Google Cloud API verified via official docs, MediaRecorder pattern well-known
- AI prompt structure: MEDIUM — OpenAI docs verified, specific prompt content [ASSUMED]
- Pitfalls: HIGH — identified from direct codebase review (antrian.service.ts comments, existing patterns)

**Research date:** 2026-07-01
**Valid until:** 2026-08-01 (packages stable; openai SDK may patch frequently)
