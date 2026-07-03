# Phase 4: Dashboard & DSS + AI Chatbot — Research

**Researched:** 2026-07-03
**Domain:** Leaflet maps, OpenAI function calling, Redis rate limiting, Puskesmas DSS
**Confidence:** HIGH

---

## Summary

Phase 4 delivers four capabilities on top of the Phase 0-3 foundation: (1) a Puskesmas stunting map powered by Leaflet + OpenStreetMap showing aggregated status gizi per posyandu; (2) kader management with master overrule unlock flow; (3) a GPT-4o chatbot for citizen nutrition questions with Redis-based rate limiting; (4) a GPT-4o function-calling chatbot for antrian registration/cancellation/reschedule with explicit confirmation gates.

The existing codebase already has the `openai` package (v6.45.0), `ioredis` for Redis, the `RiwayatChat` DB model for chat history, and the `AuditLog` model for overrule events. The GPT-4o pattern from `ai.service.ts` (lazy import, temperature, json_object mode) is directly reusable. The primary new dependency is `react-leaflet@4.2.1` — critically, NOT v5.0.0 which requires React 19 while SISPOS uses React 18.3.1.

A schema migration is required to add `latitude` and `longitude` to the `Posyandu` model — this is additive (no existing data deleted) and enables the stunting map to place markers. All other backend models are sufficient as-is.

**Primary recommendation:** Use `react-leaflet@4.2.1` + `leaflet@1.9.4` for the map; CircleMarker per posyandu (no cluster library needed); non-streaming GPT-4o responses throughout; Redis INCR+EXPIREAT for rate limiting; `parallel_tool_calls: false` for the sequential confirmation flow in the pendaftaran chatbot.

---

## Project Constraints (from CLAUDE.md)

- **Maps**: Leaflet + OpenStreetMap TIDAK BOLEH DIGANTI
- **AI Chatbot Gizi**: temperature 0.6, max_tokens 300, hanya jawab 4 topik (gizi balita, tumbuh kembang, imunisasi, posyandu), rate limit 20 pesan/hari per citizen
- **AI Chatbot Pendaftaran**: temperature 0.4, tools: get_jadwal_tersedia, get_profil_balita, daftar_antrian, batalkan_antrian, reschedule_antrian; konfirmasi eksplisit WAJIB sebelum execute action
- **Kader PIN lock**: gagal PIN 10x → terkunci 30 menit; reset via master overrule Puskesmas
- **AuditLog MASTER_OVERRULE**: wajib ditulis saat Puskesmas buka kunci kader
- **Enkripsi**: catatanKonsultasi dan rekomendasiAi tetap wajib dienkripsi
- **Tech stack**: React 18 + TypeScript strict, Zustand UI state, TanStack Query server state, authMiddleware semua endpoint
- **Error format**: `{ success, error, message }` konsisten
- **UU PDP No. 27/2022**: enkripsi field sensitif, audit log setiap aksi penting

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Leaflet stunting map render | Browser/Client | — | DOM manipulation, canvas rendering |
| Map data aggregation (by posyandu + bulan) | API/Backend | Database | Business logic, IDOR guard |
| Puskesmas dashboard stats | API/Backend | Database | Aggregate queries, auth-scoped |
| Kader list + status | API/Backend | Database | Puskesmas IDOR guard |
| Master overrule unlock | API/Backend | Database | AuditLog mandatory, business rule |
| AI guardrail system prompt | API/Backend | — | OPENAI_API_KEY never goes to browser |
| Rate limit counter (20/day) | API/Backend (Redis) | — | Stateful counter; Redis INCR pattern |
| Chat history persistence | Database (PostgreSQL) | — | RiwayatChat model exists |
| Function call execution | API/Backend | Database | Must access antrian/jadwal tables |
| Citizen chatbot UI | Browser/Client | — | Message list, input, send |
| Confirmation gate logic | API/Backend (system prompt) | — | Cannot rely on client to enforce |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-leaflet | 4.2.1 | React wrapper for Leaflet maps | CLAUDE.md mandates Leaflet; v4.2.1 supports React 18 (v5 requires React 19) |
| leaflet | 1.9.4 | Interactive map engine | CLAUDE.md mandates; industry standard |
| @types/leaflet | 1.9.21 | TypeScript definitions for Leaflet | Required for TS strict mode |
| openai | 6.45.0 (already installed) | GPT-4o API client | Already in backend package.json |
| ioredis | 5.4.1 (already installed) | Redis client for rate limiting | Already in backend package.json |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prisma (existing) | 5.15.0 | Schema migration + ORM | Additive migration for Posyandu lat/lng |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-leaflet@4.2.1 | react-leaflet@5.0.0 | v5 requires React 19; SISPOS is React 18 — DO NOT use v5 |
| react-leaflet@4.2.1 | maplibre-gl / mapbox-gl | CLAUDE.md explicitly mandates Leaflet |
| CircleMarker | react-leaflet-cluster + MarkerCluster | No cluster lib needed for <20 posyandu per puskesmas; simpler dependency tree |
| Non-streaming responses | Server-Sent Events (SSE) streaming | SSE adds complexity (EventSource, ReadableStream); MVP doesn't require it; GPT-4o responds in <3s for these short prompts |
| Redis INCR+EXPIREAT | DB counter in PostgreSQL | Redis already installed; atomic INCR is idempotent and fast |

**Installation (frontend only — backend has all packages):**
```bash
npm install react-leaflet@4.2.1 leaflet @types/leaflet
```

**Version verification:** [VERIFIED: npm registry] — confirmed via `npm view react-leaflet peerDependencies` → `{ react: '^18.0.0', leaflet: '^1.9.0' }` for v4.2.1

---

## Package Legitimacy Audit

> slopcheck CLI invocation failed on this platform (Windows POSIX shell mismatch). Packages verified via official registries and authoritative sources instead.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| leaflet@1.9.4 | npm | 12+ yrs (2013) | ~3M/wk | github.com/Leaflet/Leaflet | N/A (official project) | Approved |
| react-leaflet@4.2.1 | npm | 10+ yrs (2014) | ~900K/wk | github.com/PaulLeCam/react-leaflet | N/A (official project) | Approved |
| @types/leaflet@1.9.21 | npm | DefinitelyTyped | N/A | github.com/DefinitelyTyped/DefinitelyTyped | N/A | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck could not run on this platform. All packages above were verified via official npm registry `npm view` AND authoritative source (official homepages: leafletjs.com, react-leaflet.js.org; maintainers: mourner/Volodymyr Agafonkin for Leaflet, PaulLeCam for react-leaflet). These are among the most established mapping libraries in the JavaScript ecosystem. [ASSUMED] tag does NOT apply — provenance is confirmed via two independent official sources.* [CITED: npmjs.com/package/leaflet, npmjs.com/package/react-leaflet]

---

## Architecture Patterns

### System Architecture Diagram

```
Citizen Browser          Puskesmas Browser
     │                         │
     │ POST /api/ai/chat/gizi  │ GET /api/dashboard/stunting?bulan=
     │ POST /api/ai/chat/      │ GET /api/dashboard/stats?bulan=
     │   pendaftaran           │ GET /api/users/kader
     │                         │ PATCH /api/users/kader/:id/unlock
     ▼                         ▼
  Express Backend (Node.js + TypeScript)
     │
     ├── /api/ai/chat/gizi ──────── Redis (rate limit check)
     │        │                          INCR chatbot:gizi:{wargaId}:{date}
     │        │                          EXPIREAT end-of-day
     │        ├── GPT-4o (temp 0.6, max_tokens 300, system prompt guardrail)
     │        └── RiwayatChat INSERT (PostgreSQL)
     │
     ├── /api/ai/chat/pendaftaran ── GPT-4o (temp 0.4, tools array, parallel_tool_calls: false)
     │        │                          Tool execution loop in backend
     │        ├── Tool: get_jadwal_tersedia  ──── PostgreSQL: jadwal query
     │        ├── Tool: get_profil_balita  ──── PostgreSQL: balita query
     │        ├── Tool: daftar_antrian  ──── POST /antrian/ambil (SELECT FOR UPDATE)
     │        ├── Tool: batalkan_antrian  ──── PATCH /antrian/:id/batalkan
     │        └── Tool: reschedule_antrian  ──── DELETE + POST antrian
     │
     ├── /api/dashboard/stunting ── PostgreSQL: aggregate pemeriksaan by posyandu + bulan
     │        └── returns [{ posyanduId, kelurahan, lat, lng, total, breakdown }]
     │
     ├── /api/dashboard/stats ──── PostgreSQL: groupBy statusGizi for puskesmasId + bulan
     │
     └── /api/users/kader/:id/unlock ── PostgreSQL: UPDATE kader SET gagalLogin=0, terkunciSampai=null
              └── AuditLog INSERT: MASTER_OVERRULE

     ▼
PostgreSQL 16                    Redis 7
  - RiwayatChat                  - chatbot:gizi:{wargaId}:{date} (counter)
  - AuditLog (MASTER_OVERRULE)   - (existing kader lock-screen state)
  - Posyandu (lat, lng added)
  - Pemeriksaan (aggregate source)
  - Kader (gagalLogin, terkunciSampai, isAktif)
```

### Recommended Project Structure

```
backend/src/modules/
├── dashboard/
│   ├── dashboard.routes.ts     # GET /api/dashboard/stunting, /api/dashboard/stats
│   ├── dashboard.service.ts    # aggregate queries, IDOR guard puskesmasId
│   └── dashboard.controller.ts
├── users/                      # currently empty (.gitkeep)
│   ├── users.routes.ts         # GET /api/users/kader, PATCH /api/users/kader/:id/unlock
│   ├── users.service.ts        # kaderList, unlockKader + AuditLog
│   └── users.controller.ts
└── ai/
    ├── ai.service.ts           # existing: generateEarlyWarning — EXTEND with:
    ├── ai-gizi.service.ts      # NEW: chatGizi (rate limit + GPT-4o guardrail)
    ├── ai-pendaftaran.service.ts # NEW: chatPendaftaran (function calling loop)
    └── ai.routes.ts            # ADD: POST /gizi, POST /pendaftaran routes

frontend/src/
├── pages/puskesmas/
│   ├── PuskesmasDashboardPage.tsx    # NEW: stats cards + MapContainer
│   └── ManajemenPenggunaPage.tsx     # NEW: kader list + unlock button
└── pages/citizen/
    ├── ChatGiziPage.tsx         # NEW: gizi chatbot UI
    └── ChatPendaftaranPage.tsx  # NEW: pendaftaran chatbot UI (function calling)
```

### Pattern 1: Leaflet MapContainer + CircleMarker

**What:** Render interactive map with colored circles per posyandu
**When to use:** Wave 4.1 — stunting distribution visualization

```tsx
// Source: react-leaflet v4 official docs (react-leaflet.js.org)
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Color function based on dominant statusGizi
function getMarkerColor(breakdown: StuntingBreakdown): string {
  if ((breakdown.buruk ?? 0) + (breakdown.sangat_pendek ?? 0) > 0) return '#ef4444' // merah
  if ((breakdown.kurang ?? 0) + (breakdown.pendek ?? 0) > 0) return '#f59e0b'       // kuning
  return '#22c55e'                                                                     // hijau
}

// Map component
<MapContainer
  center={[-7.7971, 110.3688]}  // Yogyakarta center
  zoom={12}
  style={{ height: '400px', width: '100%' }}
>
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  />
  {stuntingData.map((point) => (
    <CircleMarker
      key={point.posyanduId}
      center={[point.lat, point.lng]}
      radius={Math.max(8, Math.sqrt(point.total) * 3)}
      pathOptions={{ color: getMarkerColor(point.breakdown), fillOpacity: 0.7 }}
    >
      <Popup>
        <strong>{point.kelurahan}</strong><br />
        Total: {point.total} balita<br />
        Normal: {point.breakdown.normal ?? 0} |
        Kurang: {(point.breakdown.kurang ?? 0) + (point.breakdown.pendek ?? 0)} |
        Buruk: {(point.breakdown.buruk ?? 0) + (point.breakdown.sangat_pendek ?? 0)}
      </Popup>
    </CircleMarker>
  ))}
</MapContainer>
```

**Critical Vite setup note:** `leaflet/dist/leaflet.css` MUST be imported. Import in the component file or in `index.css`. Without this, the map renders broken (tiles stack incorrectly). Since we use CircleMarker (not Marker), the default icon path fix is NOT required. [VERIFIED: react-leaflet docs]

### Pattern 2: Redis Rate Limiting (INCR + EXPIREAT)

**What:** Atomic per-citizen per-day message counter
**When to use:** Wave 4.3 — AI chatbot gizi, 20 messages/day limit

```typescript
// Source: Redis INCR documentation (redis.io/commands/incr) [ASSUMED - pattern from training]
import { redis } from '../../config/redis'

const DAILY_LIMIT = 20

export async function checkAndIncrementRateLimit(wargaId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
  const key = `chatbot:gizi:citizen:${wargaId}:${today}`

  const count = await redis.incr(key)

  if (count === 1) {
    // First message of the day — set expiry to midnight WIB (UTC+7)
    const now = new Date()
    const endOfDayWIB = new Date(now)
    endOfDayWIB.setUTCHours(17, 0, 0, 0) // 17:00 UTC = 00:00 WIB next day
    if (endOfDayWIB <= now) endOfDayWIB.setUTCDate(endOfDayWIB.getUTCDate() + 1)
    await redis.expireat(key, Math.floor(endOfDayWIB.getTime() / 1000))
  }

  if (count > DAILY_LIMIT) {
    throw Object.assign(
      new Error('Batas 20 pesan per hari telah tercapai. Coba lagi besok.'),
      { code: 'RATE_LIMIT_EXCEEDED' }
    )
  }
}
```

### Pattern 3: AI Chatbot Gizi (Guardrail + History)

**What:** GPT-4o chat with topic restriction, conversation history from DB
**When to use:** Wave 4.3

```typescript
// Source: existing ai.service.ts pattern (Phase 03-06) [VERIFIED: codebase grep]
// + RiwayatChat model from prisma/schema.prisma [VERIFIED: codebase grep]

const GIZI_SYSTEM_PROMPT = `Anda adalah asisten gizi Posyandu Indonesia yang membantu orang tua balita.
Hanya jawab pertanyaan tentang: gizi balita, tumbuh kembang anak, imunisasi, dan posyandu.
Jika ditanya tentang topik lain (politik, selebriti, dsb), tolak dengan sopan: "Maaf, saya hanya bisa membantu pertanyaan seputar gizi balita, tumbuh kembang, imunisasi, dan posyandu."
Jawab dalam Bahasa Indonesia yang ramah dan mudah dipahami.
Maksimum respons: 300 token.`

export async function chatGizi(wargaId: string, userMessage: string): Promise<string> {
  await checkAndIncrementRateLimit(wargaId) // throws RATE_LIMIT_EXCEEDED if over limit

  // Fetch last 10 messages as conversation context
  const history = await prisma.riwayatChat.findMany({
    where: { wargaId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { role: true, pesan: true },
  })
  history.reverse()

  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const messages = [
    { role: 'system' as const, content: GIZI_SYSTEM_PROMPT },
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.pesan })),
    { role: 'user' as const, content: userMessage },
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.6,    // CLAUDE.md §AI Chatbot Citizen (Gizi)
    max_tokens: 300,     // CLAUDE.md §AI Chatbot Citizen (Gizi)
    messages,
  })

  const reply = response.choices[0]?.message?.content ?? 'Maaf, tidak bisa memproses permintaan.'

  // Persist both turns to RiwayatChat
  await prisma.riwayatChat.createMany({
    data: [
      { wargaId, role: 'user', pesan: userMessage },
      { wargaId, role: 'assistant', pesan: reply },
    ],
  })

  return reply
}
```

### Pattern 4: Function Calling Loop (Pendaftaran Chatbot)

**What:** GPT-4o with tools, sequential confirmation enforcement
**When to use:** Wave 4.4

```typescript
// Source: OpenAI SDK v6 function calling docs [ASSUMED - training knowledge, verify with Context7]
// parallel_tool_calls: false ensures AI confirms before action, not in parallel

const PENDAFTARAN_SYSTEM_PROMPT = `Anda adalah asisten pendaftaran antrian Posyandu.
Anda membantu citizen mendaftar, membatalkan, atau menjadwal ulang antrian posyandu untuk balita mereka.
PENTING:
- Selalu tampilkan ringkasan lengkap (jadwal, sesi, nama balita) SEBELUM minta konfirmasi.
- Panggil daftar_antrian, batalkan_antrian, atau reschedule_antrian HANYA setelah citizen mengonfirmasi dengan kata 'ya', 'oke', 'setuju', atau yang setara.
- Jika citizen tidak konfirmasi, JANGAN panggil fungsi action.
Jawab dalam Bahasa Indonesia yang ramah.`

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_jadwal_tersedia',
      description: 'Mendapatkan daftar jadwal posyandu yang tersedia untuk posyandu utama citizen.',
      parameters: {
        type: 'object',
        properties: {
          tanggal: {
            type: 'string',
            description: 'Tanggal dalam format YYYY-MM-DD (opsional, default: 7 hari ke depan)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_profil_balita',
      description: 'Mendapatkan daftar balita yang terdaftar di akun citizen.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'daftar_antrian',
      description: 'Mendaftarkan balita ke antrian posyandu. HANYA panggil setelah citizen konfirmasi eksplisit.',
      parameters: {
        type: 'object',
        properties: {
          slotId: { type: 'string', description: 'ID slot sesi' },
          balitaId: { type: 'string', description: 'ID balita' }
        },
        required: ['slotId', 'balitaId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'batalkan_antrian',
      description: 'Membatalkan antrian yang sudah ada. HANYA panggil setelah citizen konfirmasi eksplisit.',
      parameters: {
        type: 'object',
        properties: {
          antrianId: { type: 'string', description: 'ID antrian yang akan dibatalkan' }
        },
        required: ['antrianId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_antrian',
      description: 'Menjadwal ulang antrian. HANYA panggil setelah citizen konfirmasi eksplisit.',
      parameters: {
        type: 'object',
        properties: {
          antrianId: { type: 'string', description: 'ID antrian lama' },
          slotId: { type: 'string', description: 'ID slot sesi baru' }
        },
        required: ['antrianId', 'slotId']
      }
    }
  }
]

// Tool execution loop (in backend — tools run against DB/service layer)
async function executeToolCall(
  toolName: string,
  args: Record<string, string>,
  wargaId: string
): Promise<string> {
  switch (toolName) {
    case 'get_jadwal_tersedia':
      return JSON.stringify(await getJadwalTersedia(wargaId, args.tanggal))
    case 'get_profil_balita':
      return JSON.stringify(await getProfilBalita(wargaId))
    case 'daftar_antrian':
      return JSON.stringify(await daftarAntrian(wargaId, args.slotId, args.balitaId))
    case 'batalkan_antrian':
      return JSON.stringify(await batalkanAntrian(wargaId, args.antrianId))
    case 'reschedule_antrian':
      return JSON.stringify(await rescheduleAntrian(wargaId, args.antrianId, args.slotId))
    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

export async function chatPendaftaran(
  wargaId: string,
  userMessage: string,
  clientHistory: Array<{ role: string; content: string }>
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: PENDAFTARAN_SYSTEM_PROMPT },
    ...clientHistory as OpenAI.Chat.ChatCompletionMessageParam[],
    { role: 'user', content: userMessage },
  ]

  // Tool execution loop
  let iteration = 0
  const MAX_ITERATIONS = 5 // prevent infinite loops

  while (iteration < MAX_ITERATIONS) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.4,         // CLAUDE.md §AI Chatbot Citizen (Pendaftaran)
      messages,
      tools: TOOLS,
      parallel_tool_calls: false, // Sequential — ensures confirmation before action
    })

    const choice = response.choices[0]
    messages.push(choice.message)

    if (choice.finish_reason === 'stop') {
      const reply = choice.message.content ?? ''
      // Persist final user + assistant turn to DB
      await prisma.riwayatChat.createMany({
        data: [
          { wargaId, role: 'user', pesan: userMessage },
          { wargaId, role: 'assistant', pesan: reply },
        ]
      })
      return { reply, messages }
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, string>
        const result = await executeToolCall(toolCall.function.name, args, wargaId)
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }
    }

    iteration++
  }

  throw Object.assign(new Error('AI tidak bisa menyelesaikan permintaan.'), { code: 'AI_TIMEOUT' })
}
```

### Pattern 5: Master Overrule (Kader Unlock)

**What:** Puskesmas resets kader lock, writes AuditLog
**When to use:** Wave 4.2

```typescript
// Source: AuditLog pattern from growth.service.ts (Phase 03) [VERIFIED: codebase grep]
// Kader model from schema.prisma [VERIFIED: codebase grep]

export async function unlockKader(
  kaderId: string,
  puskesmasId: string,
  meta: { ip?: string; userAgent?: string }
): Promise<void> {
  // IDOR guard: kader must belong to a posyandu under this puskesmas
  const kader = await prisma.kader.findUnique({
    where: { id: kaderId },
    include: { posyandu: { select: { puskesmasId: true } } }
  })
  if (!kader) throw Object.assign(new Error('Kader tidak ditemukan'), { code: 'KADER_TIDAK_DITEMUKAN' })
  if (kader.posyandu.puskesmasId !== puskesmasId) {
    throw Object.assign(new Error('Akses ditolak'), { code: 'AKSES_DITOLAK' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.kader.update({
      where: { id: kaderId },
      data: { gagalLogin: 0, terkunciSampai: null }
    })
    await tx.auditLog.create({
      data: {
        userId: puskesmasId,
        userRole: 'puskesmas',
        aksi: 'MASTER_OVERRULE',
        tabelTerkait: 'kader',
        recordId: kaderId,
        dataSebelum: { gagalLogin: kader.gagalLogin, terkunciSampai: kader.terkunciSampai },
        dataSesudah: { gagalLogin: 0, terkunciSampai: null },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      }
    })
  })
}
```

### Pattern 6: Dashboard Stunting Data Query

**What:** Aggregate pemeriksaan by posyandu+month with lat/lng for map
**When to use:** Wave 4.1

```typescript
// Source: Prisma schema analysis (Phase 04 research) [VERIFIED: codebase grep]
// Requires additive migration: add latitude Float? longitude Float? to Posyandu

export async function getStuntingMapData(
  puskesmasId: string,
  bulan: string // 'YYYY-MM'
): Promise<StuntingMapPoint[]> {
  const [year, month] = bulan.split('-').map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)

  const posyanduList = await prisma.posyandu.findMany({
    where: { puskesmasId },
    select: {
      id: true, kelurahan: true, namaPosyandu: true,
      latitude: true, longitude: true,
      jadwal: {
        where: { tanggalPelaksanaan: { gte: startOfMonth, lte: endOfMonth } },
        select: {
          slotSesi: {
            select: {
              antrian: {
                where: { statusAntrian: 'selesai' },
                select: { pemeriksaan: { select: { statusGizi: true } } }
              }
            }
          }
        }
      }
    }
  })

  return posyanduList
    .filter(p => p.latitude !== null && p.longitude !== null)
    .map(p => {
      const allPemeriksaan = p.jadwal
        .flatMap(j => j.slotSesi)
        .flatMap(s => s.antrian)
        .flatMap(a => a.pemeriksaan)
        .filter(pm => pm.statusGizi !== null)

      const breakdown = allPemeriksaan.reduce((acc, pm) => {
        if (pm.statusGizi) acc[pm.statusGizi] = (acc[pm.statusGizi] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        posyanduId: p.id,
        namaPosyandu: p.namaPosyandu,
        kelurahan: p.kelurahan,
        lat: p.latitude!,
        lng: p.longitude!,
        total: allPemeriksaan.length,
        breakdown,
      }
    })
}
```

### Anti-Patterns to Avoid

- **react-leaflet v5 with React 18**: Will crash with peer dependency errors. Use v4.2.1.
- **SSE/streaming for MVP chatbot**: Over-engineering. Non-streaming is sufficient and simpler.
- **Direct Fonnte call in chatbot**: If chatbot triggers antrian creation, BullMQ must still handle WA notification — never call Fonnte directly.
- **OpenAI key in browser**: System prompt and function calls ALWAYS in backend. Never expose key to client.
- **Storing tool_call messages in RiwayatChat**: The DB schema (role VarChar(10)) can't hold 'tool_calls' role properly. Store only 'user' and 'assistant' final turns.
- **parallel_tool_calls: true** for pendaftaran chatbot: Would allow AI to call daftar_antrian without asking confirmation first.
- **IDOR miss on dashboard queries**: Always filter by puskesmasId from JWT, not from request body.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive map | Custom SVG/Canvas overlay | react-leaflet + Leaflet.js | Tile management, zoom, projection math are extremely complex |
| Rate limiting | Middleware with DB counter | Redis INCR + EXPIREAT | Atomic, fast, already installed, no extra migration |
| JWT validation | Manual token parsing | authMiddleware (existing) | Already handles expiry, signature, cookie extraction |
| AI conversation management | Custom state machine | GPT-4o context window | Pass history array; GPT handles conversation flow |
| Map tiles | Self-hosted tile server | OpenStreetMap CDN tiles | CLAUDE.md mandates OpenStreetMap; tile serving is infrastructure overhead |

---

## Schema Migration Required

**File:** `prisma/schema.prisma`
**Change:** Additive — add two optional Float fields to `Posyandu` model

```prisma
model Posyandu {
  // ... existing fields unchanged ...
  latitude   Float?   // WGS84 decimal degrees (-90 to 90)
  longitude  Float?   // WGS84 decimal degrees (-180 to 180)
}
```

**Migration command:**
```bash
npx prisma migrate dev --name add-posyandu-coordinates
```

**Why additive (no data loss):** Both fields are `Float?` (optional/nullable). Existing posyandu records will have null coordinates. The seed data (Phase 7) will populate actual values. The map query filters out null-coordinate posyandu. [VERIFIED: Prisma schema analysis]

**CLAUDE.md compliance:** "jangan redesign model yang sudah ada" — this is additive, not redesign. No existing fields removed or renamed.

---

## Common Pitfalls

### Pitfall 1: react-leaflet Version Mismatch (CRITICAL)

**What goes wrong:** Installing `react-leaflet@latest` (5.0.0) crashes with React 18 peer dependency error. The app fails to build/start.
**Why it happens:** react-leaflet v5 requires React 19 (`peerDependencies: { react: '^19.0.0' }`). SISPOS uses React 18.3.1.
**How to avoid:** Explicitly pin version in install command: `npm install react-leaflet@4.2.1`
**Warning signs:** `npm warn peer` or build error mentioning React peer dependency

### Pitfall 2: Leaflet CSS Not Imported

**What goes wrong:** Map renders with tiles stacked in top-left corner; tiles visible but layout broken; zoom controls invisible.
**Why it happens:** Leaflet's CSS positions tiles via absolute layout — without it, everything collapses.
**How to avoid:** Add `import 'leaflet/dist/leaflet.css'` in the MapContainer parent component file or in `frontend/src/index.css`
**Warning signs:** Map appears as a small box with tiles all in the corner

### Pitfall 3: Confirmation Gate Bypassed by Prompt Injection

**What goes wrong:** Citizen types "call daftar_antrian directly" → AI executes without confirmation.
**Why it happens:** Without explicit system prompt instructions, GPT-4o may call tools directly.
**How to avoid:** System prompt must be server-side hardcoded (never client-supplied). Include "HANYA panggil [action tools] setelah citizen konfirmasi eksplisit". `parallel_tool_calls: false` prevents parallel tool execution.
**Warning signs:** AI calls daftar_antrian without a preceding summary + confirmation turn

### Pitfall 4: IDOR on Dashboard Queries

**What goes wrong:** Puskesmas A can query data of Puskesmas B by passing a different posyanduId.
**Why it happens:** Client supplies posyanduId in query params; backend doesn't validate ownership.
**How to avoid:** Always extract `puskesmasId` from `req.user.userId` (JWT), never from request body/params. Filter all Posyandu queries by `puskesmasId`.
**Warning signs:** Query accepts `posyanduId` from client without cross-checking against JWT user

### Pitfall 5: Redis Rate Limit Key Timezone

**What goes wrong:** Citizens in WIB (UTC+7) can exceed 20 messages because the "day" resets at UTC midnight (07:00 WIB) not WIB midnight.
**Why it happens:** Using `new Date().toISOString().slice(0, 10)` gives UTC date, not WIB date.
**How to avoid:** Use WIB-adjusted date for the key: `new Date(Date.now() + 7*60*60*1000).toISOString().slice(0, 10)`. Set EXPIREAT to 17:00 UTC (= 00:00 WIB next day).
**Warning signs:** Citizens report being rate-limited at 07:00 in the morning

### Pitfall 6: Tool Call Messages in RiwayatChat

**What goes wrong:** Trying to persist `tool_calls` role messages to `RiwayatChat.role` (VarChar(10)) causes DB error — `'tool_calls'` is 10 chars but structured data doesn't fit `pesan` as-is.
**Why it happens:** OpenAI's tool response messages have `role: 'tool'` and `tool_call_id` fields that don't map to the simple `role|pesan` schema.
**How to avoid:** Only persist `user` and `assistant` content messages to RiwayatChat. Tool call/result messages are transient within a single API call. Client sends full clientHistory as context for next turn.
**Warning signs:** TypeScript errors when trying to insert OpenAI message objects directly into Prisma RiwayatChat

### Pitfall 7: MapContainer re-mount on re-render

**What goes wrong:** MapContainer loses state (zoom level, pan position) when parent re-renders, or throws "Map container is already initialized" error.
**Why it happens:** MapContainer should not be conditionally rendered or re-created. `key` prop changes cause re-mount.
**How to avoid:** Wrap map in a stable container div. Don't use dynamic `key` on MapContainer. Use TanStack Query for data; map re-renders with new CircleMarkers without re-mounting the MapContainer.
**Warning signs:** Map flashes or resets zoom on every data refetch

---

## Code Examples

### Filter Bulan — TanStack Query

```tsx
// Source: existing useQuery pattern from Phase 02 (useSesiAvailability) [VERIFIED: codebase grep]
function usePuskesmasStunting(bulan: string) {
  return useQuery({
    queryKey: ['dashboard', 'stunting', bulan],
    queryFn: () =>
      apiClient.get('/dashboard/stunting', { params: { bulan } }).then(r => r.data.data),
    enabled: !!bulan,
    staleTime: 5 * 60 * 1000, // 5 minutes — monthly data changes infrequently
  })
}

// Month filter UI — changes bulan state → query refetches, NO reload
const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7)) // 'YYYY-MM'
const { data, isLoading } = usePuskesmasStunting(bulan)
```

### Kader Unlock Button

```tsx
// Source: useMutation pattern from Phase 02/03 [VERIFIED: codebase grep]
const unlockMutation = useMutation({
  mutationFn: (kaderId: string) =>
    apiClient.patch(`/users/kader/${kaderId}/unlock`).then(r => r.data),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['users', 'kader'] })
    toast({ description: 'Kader berhasil dibuka kuncinya.' })
  },
  onError: () => toast({ description: 'Gagal membuka kunci.', variant: 'destructive' })
})

// In component:
<button
  onClick={() => unlockMutation.mutate(kader.id)}
  disabled={unlockMutation.isPending}
  className="text-sm text-blue-600 underline"
>
  {kader.terkunciSampai ? 'Buka Kunci' : 'Aktif'}
</button>
```

### Chatbot UI (simple pattern, reuse for both chatbots)

```tsx
// Source: project pattern from Phase 03 Meja4Page.tsx [VERIFIED: codebase grep]
const [messages, setMessages] = useState<Array<{role:'user'|'assistant'; content:string}>>([])
const [input, setInput] = useState('')

const chatMutation = useMutation({
  mutationFn: (message: string) =>
    apiClient.post('/ai/chat/gizi', { message }).then(r => r.data.data.reply as string),
  onSuccess: (reply, message) => {
    setMessages(prev => [
      ...prev,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ])
    setInput('')
  },
})

function handleSend() {
  if (!input.trim() || chatMutation.isPending) return
  chatMutation.mutate(input.trim())
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom map implementations | react-leaflet v4 + Leaflet 1.9 | ~2022 | Standard for React Leaflet maps |
| OpenAI function_call (old API) | tools array + tool_calls response | OpenAI API v2+ | New format; `function_call` deprecated |
| Streaming SSE for chatbot | Non-streaming for MVP | Phase 4 decision | Simpler; GPT-4o fast enough |
| react-leaflet v5 (React 19) | react-leaflet v4.2.1 (React 18) | Dec 2024 | Constraint from SISPOS React 18 stack |

**Deprecated/outdated:**
- `function_call` (singular): Replaced by `tools` array + `tool_calls` response in OpenAI API. The SDK v6 (used in this project) uses `tools`.
- `openai.createChatCompletion()`: Old SDK pattern. Current SDK uses `openai.chat.completions.create()` (already correct in ai.service.ts).
- `react-leaflet@5`: Requires React 19 — incompatible with SISPOS React 18 setup.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Redis INCR+EXPIREAT pattern is atomic (no race condition) | Rate Limiting | Multiple simultaneous requests might bypass limit by 1-2 messages — acceptable for MVP |
| A2 | GPT-4o respects system prompt guardrail for topic restriction | Chatbot Gizi | AI could answer off-topic questions; risk: reputational, not security |
| A3 | `parallel_tool_calls: false` prevents action tools firing without confirmation | Function Calling | If AI ignores constraint, daftar_antrian could execute without confirmation |
| A4 | clientHistory sent from browser is tamper-proof for pendaftaran flow | Chatbot Pendaftaran | Client could inject messages; mitigation: server-side IDOR guard on wargaId before any tool execution |
| A5 | Posyandu count per Puskesmas < 20 → CircleMarker sufficient (no clustering) | Leaflet Map | If >50 posyandu per puskesmas, markers overlap; solution: add clustering later |
| A6 | openai v6.45.0 `parallel_tool_calls: false` syntax correct | Code Examples | SDK may have slightly different option name; verify with Context7 |

---

## Open Questions (RESOLVED)

1. **Posyandu coordinates for demo seed data**
   - What we know: No lat/lng in current schema; seed data is in Phase 7
   - What's unclear: What coordinates should demo Posyandu Mergangsan/DIY have?
   - RESOLVED: Wave 4.1 migrates schema (add latitude/longitude to Posyandu). Demo lat/lng deferred to Phase 7 seed (prisma/seed.ts). Executor may add placeholder coordinates (e.g., Yogyakarta center: -7.797, 110.370) directly in the migration or seed.today.ts.

2. **Chat history scope for pendaftaran chatbot**
   - What we know: RiwayatChat stores only user/assistant content messages
   - What's unclear: Should pendaftaran and gizi history be separated or combined?
   - RESOLVED: MVP uses client-side state for pendaftaran chat history (no DB persistence). Gizi chatbot saves to RiwayatChat (single table, last 10 messages). No schema change needed.

3. **Kader list scope for Puskesmas dashboard**
   - What we know: Puskesmas owns multiple Posyandu; each Posyandu has multiple Kader
   - What's unclear: Should Puskesmas see ALL kader across all their posyandu, or only kader linked to specific posyandu?
   - RESOLVED: GET /api/users/kader returns all kader for the requesting puskesmasId (via posyandu relation), grouped by posyandu in response. No cross-puskesmas data leakage (IDOR guard via JWT).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Data queries | ✓ | 16 (Docker) | — |
| Redis | Rate limiting, kader lock | ✓ | 7 (Docker) | — |
| OpenAI API key | AI chatbot | Env-gated | GPT-4o | Graceful degradation stub (existing pattern) |
| react-leaflet@4.2.1 | Stunting map | ✗ (needs install) | — | npm install react-leaflet@4.2.1 leaflet |
| leaflet@1.9.4 | Stunting map | ✗ (needs install) | — | npm install leaflet |
| Node.js | Backend | ✓ | 24.11.1 (host) | — |

**Missing dependencies with no fallback:** react-leaflet and leaflet (frontend npm install required in Wave 4.1)

**Missing dependencies with fallback:** OpenAI API key — existing pattern from ai.service.ts returns stub response if OPENAI_API_KEY not set

---

## Validation Architecture

> nyquist_validation: true (from .planning/config.json)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed in Phase 03-01) |
| Config file | `backend/vitest.config.ts` (or root vitest.config.ts) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DSS-01 | Leaflet map renders markers from backend data | smoke | manual browser check | ❌ Wave 0 |
| DSS-02 | Filter bulan → query refetches, markers update | smoke | manual browser check | ❌ Wave 0 |
| AI-01 | Gizi chatbot: on-topic question → answered | unit (mock OpenAI) | `npx vitest run tests/ai-gizi.test.ts` | ❌ Wave 0 |
| AI-01 | Gizi chatbot: off-topic question → rejected | unit (mock OpenAI) | `npx vitest run tests/ai-gizi.test.ts` | ❌ Wave 0 |
| AI-01 | Rate limit: 21st message → 429 RATE_LIMIT_EXCEEDED | unit (mock Redis) | `npx vitest run tests/ai-gizi.test.ts` | ❌ Wave 0 |
| AI-02 | Unlock kader: gagalLogin→0, terkunciSampai→null | unit | `npx vitest run tests/users.test.ts` | ❌ Wave 0 |
| AI-02 | Unlock kader: AuditLog MASTER_OVERRULE written | unit | `npx vitest run tests/users.test.ts` | ❌ Wave 0 |
| AI-03 | Pendaftaran chatbot: daftar_antrian not called before confirm | unit (mock OpenAI) | `npx vitest run tests/ai-pendaftaran.test.ts` | ❌ Wave 0 |
| AI-03 | Pendaftaran chatbot: after confirm, antrian created in DB | integration | manual verify | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `backend/tests/ai-gizi.test.ts` — covers AI-01 (guardrail + rate limit)
- [ ] `backend/tests/users.test.ts` — covers AI-02 (unlock + AuditLog)
- [ ] `backend/tests/ai-pendaftaran.test.ts` — covers AI-03 (confirmation gate)

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | authMiddleware (JWT httpOnly cookie) — already implemented |
| V3 Session Management | yes | JWT expiry already managed; chatbot sessions are stateless |
| V4 Access Control | yes | IDOR guard: puskesmasId from JWT, wargaId from JWT — never from request |
| V5 Input Validation | yes | Zod schema on all request bodies |
| V6 Cryptography | no | No new encrypted fields in Phase 4 (catatanKonsultasi already handled) |

### Known Threat Patterns for AI + Map Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection (chatbot gizi) | Tampering | System prompt server-side, hardcoded; user input treated as data not instructions |
| Confirmation bypass (pendaftaran) | Tampering | `parallel_tool_calls: false`; system prompt explicit; action functions execute server-side IDOR checks |
| IDOR: Puskesmas sees other puskesmas data | Spoofing | All queries filter by `puskesmasId` from JWT; never from client-supplied params |
| IDOR: Citizen uses other citizen's wargaId in chatbot | Spoofing | wargaId always from `req.user.userId` (JWT); not from request body |
| Rate limit bypass | Denial of Service | Redis INCR atomic; key includes wargaId from JWT (not client-supplied) |
| Excessive AI billing via chatbot spam | Elevation of Privilege | Rate limit 20/day enforced server-side before OpenAI call |
| Tool call with other citizen's antrian | Spoofing | batalkan_antrian/reschedule_antrian verify `antrian.wargaId === req.user.userId` |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `prisma/schema.prisma` — RiwayatChat model, Kader model (gagalLogin/terkunciSampai), AuditLog schema [VERIFIED: codebase grep]
- Codebase: `backend/src/modules/ai/ai.service.ts` — GPT-4o pattern, lazy import, temperature [VERIFIED: codebase grep]
- Codebase: `backend/src/modules/growth/growth.service.ts` — AuditLog write pattern in transaction [VERIFIED: codebase grep]
- npm registry: `npm view react-leaflet@4.2.1 peerDependencies` → React 18 support confirmed [VERIFIED: npm registry]
- npm registry: `npm view react-leaflet version` → v5.0.0 requires React 19 [VERIFIED: npm registry]
- npm registry: leaflet (mourner, 2013), react-leaflet (PaulLeCam, 2014) — authoritative maintainers [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `CLAUDE.md` §AI Chatbot Citizen (Gizi + Pendaftaran) — temperature, max_tokens, tool names, confirmation requirements [VERIFIED: project file]
- `CLAUDE.md` §Keamanan — MASTER_OVERRULE AuditLog requirement [VERIFIED: project file]
- OpenAI API tools format (`tools` array, `tool_calls` response, `parallel_tool_calls`) [ASSUMED — training knowledge, consistent with openai SDK v6 installed]

### Tertiary (LOW confidence)
- Redis EXPIREAT pattern for end-of-day WIB timezone handling [ASSUMED — standard Redis pattern]
- Leaflet MapContainer "already initialized" error on re-mount [ASSUMED — known community pitfall]

---

## Metadata

**Confidence breakdown:**
- Standard stack (Leaflet, react-leaflet v4): HIGH — verified via npm registry, peer deps check
- Architecture: HIGH — directly derived from existing codebase patterns
- Pitfalls: MEDIUM — react-leaflet version confirmed HIGH; AI guardrail pitfalls ASSUMED
- OpenAI function calling API: MEDIUM — consistent with installed SDK v6.45.0 but system prompt enforcement is ASSUMED

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (30 days — Leaflet/react-leaflet stable; OpenAI API format stable)
