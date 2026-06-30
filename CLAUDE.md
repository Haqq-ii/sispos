# SISPOS — Sistem Informasi Posyandu
> Spec file untuk Claude Code + GSD Framework
> Dibaca otomatis setiap sesi oleh Claude Code dan GSD subagent.
> Jangan hapus atau edit manual.

---

## Deskripsi Produk

SISPOS adalah Progressive Web App (PWA) untuk digitalisasi layanan Posyandu Indonesia. Mengelola antrian online dengan progressive countdown queue adaptif (mirip GoFood), pencatatan kesehatan balita, Decision Support System deteksi stunting dini, dan laporan bulanan e-PPGBM.

Tiga role pengguna: Citizen (orang tua balita) · Kader/Staff Posyandu · Puskesmas

---

## Tech Stack (TIDAK BOLEH DIGANTI)

| Layer | Teknologi |
|---|---|
| Frontend | React + Vite, TypeScript, Tailwind CSS, shadcn/ui, Lucide React |
| State | Zustand (UI state only) + TanStack Query (server state only) |
| Form | React Hook Form + Zod |
| Routing | React Router v6 |
| Realtime | Socket.IO Client |
| PWA | Workbox (Offline-First) |
| HTTP | Axios (interceptor JWT dari httpOnly cookie) |
| Backend | Node.js + Express, TypeScript, Modular Monolith |
| ORM | Prisma ORM + Prisma Migrate |
| Auth | JWT httpOnly cookie + bcrypt |
| Validasi | Zod (schema share FE ↔ BE via /shared/schemas) |
| Realtime Server | Socket.IO + Redis adapter |
| Job Queue | BullMQ (SELALU enqueue WA, jangan kirim langsung) |
| Upload | Multer |
| Export | ExcelJS (.xlsx) + pdfkit (.pdf) |
| Logging | Pino |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| AI Chatbot | OpenAI GPT-4o (temperature 0.6, guardrail ketat) |
| AI Pendaftaran | OpenAI GPT-4o Function Calling (temperature 0.4) |
| AI Early Warning | OpenAI GPT-4o |
| STT | Google Cloud Speech-to-Text (id-ID) |
| WhatsApp | Fonnte API |
| Maps | Leaflet + OpenStreetMap |
| Proxy | Nginx (satu-satunya port expose ke host: 80) |

---

## Arsitektur Docker (5 Container)

```
Internet → sispos-nginx:80
  ├── /api/*        → sispos-backend:3000
  ├── /socket.io/*  → sispos-backend:3000 (WebSocket)
  └── /*            → sispos-frontend:5173
sispos-backend → sispos-db:5432
sispos-backend → sispos-redis:6379
Network: sispos-network (bridge). Hanya Nginx expose ke host.
```

---

## Struktur Folder Backend (Modular Monolith)

```
backend/src/
├── modules/
│   ├── auth/           ← login, register, OTP, JWT, refresh
│   ├── users/          ← profil warga, kader, puskesmas
│   ├── posyandu/       ← posyandu, jadwal, slot sesi
│   ├── child/          ← balita, family account, multi-profil
│   ├── queue/          ← antrian, countdown engine, realtime
│   ├── growth/         ← pemeriksaan, Z-Score WHO, grafik
│   ├── immunization/   ← imunisasi, riwayat vaksin
│   ├── ai/             ← OpenAI chatbot + function calling + early warning
│   ├── voice/          ← Google Cloud STT
│   ├── dashboard/      ← monitoring kader & puskesmas
│   ├── reports/        ← ekspor Excel + PDF
│   └── notification/   ← Fonnte + BullMQ retry
├── shared/
│   ├── schemas/        ← Zod schemas (share FE ↔ BE)
│   ├── middleware/     ← auth, validate, audit-log
│   ├── data/           ← who-growth-tables.json
│   └── utils/          ← zscore, encrypt, date helpers
└── config/
    ├── db.ts, redis.ts, socket.ts, env.ts
```

---

## Aturan Wajib — TIDAK BOLEH DILANGGAR

### Kode
- TypeScript strict mode — tidak boleh `any` tanpa alasan eksplisit
- Jangan hardcode API key, URL, secret — selalu `process.env.VAR`
- Selalu parameterized query — tidak boleh string concatenation SQL
- Setiap endpoint dilindungi `authMiddleware` kecuali `/api/auth/*`
- Zustand hanya UI state, TanStack Query untuk semua server state

### Antrian (KRITIS)
- Selalu gunakan Prisma transaction + `$queryRaw SELECT FOR UPDATE` saat ambil slot
- Formula estimasi: `jamMulai + (nomorUrut - 1) × durasiRata`
- Cold start: pakai `estimasiDurasiMenit` dari Jadwal (diisi Puskesmas)
- Adaptif: update `durasiRataAktual` = moving average setiap antrian selesai di Meja 5
- Broadcast Socket.IO ke room `sesi:{slotId}` setiap ada perubahan

### Keamanan (UU PDP No. 27/2022)
- Kolom `catatanKonsultasi` dan `rekomendasiAi` WAJIB dienkripsi sebelum simpan
- Setiap INSERT/UPDATE di Pemeriksaan dan Imunisasi WAJIB tulis AuditLog
- Kader gagal PIN 10x → terkunci 30 menit, reset via master overrule Puskesmas

### AI Chatbot Citizen (Gizi)
- Temperature: 0.6, max_tokens: 300
- Hanya jawab: gizi balita, tumbuh kembang, imunisasi, posyandu
- Topik lain → tolak dengan pesan sopan Bahasa Indonesia
- Rate limit: 20 pesan/hari per citizen

### AI Chatbot Citizen (Pendaftaran Antrian — Function Calling)
- Temperature: 0.4 (lebih deterministik untuk aksi nyata)
- Tools: get_jadwal_tersedia, get_profil_balita, daftar_antrian
- `daftar_antrian` HANYA dipanggil setelah citizen konfirmasi eksplisit
- Wajib tampilkan ringkasan dulu sebelum minta konfirmasi
- `daftar_antrian` memanggil POST /api/antrian/ambil (SELECT FOR UPDATE tetap aktif)

### Z-Score WHO
- JANGAN generate formula dari ingatan
- Gunakan tabel LMS dari: `backend/src/shared/data/who-growth-tables.json`
- Formula: `Z = ((nilai/M)^L - 1) / (L × S)`

### WhatsApp
- SELALU enqueue ke BullMQ dulu, jangan kirim langsung ke Fonnte
- Retry 3x dengan exponential backoff (1s, 5s, 30s)

### Export
- Excel via ExcelJS, PDF via pdfkit (bukan puppeteer)
- Format e-PPGBM harus 100% sesuai standar Kemenkes
- Berlaku untuk kader (rekap harian) dan puskesmas (laporan bulanan)

### Figma MCP
- Dipakai mulai Phase 3 ke atas — jangan di Phase 0-2
- Setup: `claude plugin install figma@claude-plugins-official`
- Saat prompt: selalu sebutkan komponen shadcn/ui, hook, dan store yang sudah ada

---

## Konvensi Kode

```
File:            kebab-case        → auth.routes.ts
Komponen React:  PascalCase        → CountdownTimer.tsx
Fungsi/variabel: camelCase         → getEstimasiWaktu
Model Prisma:    PascalCase        → SlotSesi, Antrian
Kolom Prisma:    camelCase         → nomorUrut, waktuCheckin
ENV:             UPPER_SNAKE_CASE  → OPENAI_API_KEY
```

### API Response
```typescript
{ success: true, data: {...}, message: "..." }
{ success: false, error: "KODE_ERROR", message: "Pesan Bahasa Indonesia" }
{ success: true, data: [...], meta: { total, page, limit } }
```

---

## Role & Login

| Role | Identifier | Auth | Redirect |
|---|---|---|---|
| citizen | NIK 16 digit | password (bcrypt) | /citizen/dashboard |
| kader | No HP | PIN 6 digit (bcrypt) | /kader/dashboard |
| ketua_kader | No HP | PIN 6 digit (bcrypt) | /kader/dashboard |
| puskesmas | Email | password (bcrypt) | /puskesmas/dashboard |

Single gateway `/api/auth/login` — deteksi role dari format identifier.

---

## Socket.IO Events

```typescript
socket.emit('queue:join', { slotId, antrianId })
socket.to(`sesi:${slotId}`).emit('queue:update', {
  nomorAktif, durasiRataAktual, antrianList
})
socket.to(socketId).emit('queue:almost', { menit, pesan })
```

---

## Bahasa & Format

- UI: Bahasa Indonesia semua
- Tanggal: DD/MM/YYYY, Jam: HH:MM WIB, Desimal: koma → 8,5 kg

---

## Seed Data

```
prisma/seed.wilayah.ts  → PERTAMA: data wilayah DIY + Jateng + Jatim
prisma/seed.ts          → data massal: >100 balita, >10 posyandu, 12 bln riwayat
prisma/seed.demo.ts     → TERAKHIR: akun presentasi yang nyambung ke seed massal

Akun demo:
- Citizen: NIK 3471012345670001, password Demo1234!
- Kader:   HP 081234560001, PIN 123456
- Puskesmas: demo@puskesmas-mergangsan.go.id, Demo1234!
```

---

## Protokol Debugging

Saat ada error, JANGAN loop fix-test sendiri. Lakukan:
1. Baca error + identifikasi file relevan (max 3 file)
2. Propose fix dengan penjelasan singkat
3. Tunjukkan diff sebelum apply
4. Tunggu konfirmasi sebelum apply
5. JANGAN ubah file di luar yang relevan dengan error
