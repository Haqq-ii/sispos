# SISPOS — Sistem Informasi Posyandu

Progressive Web App untuk digitalisasi layanan Posyandu Indonesia.

## Cara Mulai Development

### 1. Siapkan environment
```bash
cp .env.example .env
# Edit .env dan isi semua value
```

### 2. Jalankan semua container
```bash
docker compose up --build
```

### 3. Jalankan migrasi database
```bash
docker compose exec sispos-backend npx prisma migrate dev
```

### 4. Seed data
```bash
# Urutan wajib: wilayah dulu, lalu massal, lalu demo
docker compose exec sispos-backend npx tsx prisma/seed.wilayah.ts
docker compose exec sispos-backend npx prisma db seed
docker compose exec sispos-backend npx tsx prisma/seed.demo.ts
```

### 5. Buka aplikasi
- Frontend: http://localhost
- Prisma Studio: `docker compose exec sispos-backend npx prisma studio`

## Akun Demo (untuk presentasi)
| Role | Login | Password/PIN |
|---|---|---|
| Citizen | NIK: 3471012345670001 | Demo1234! |
| Kader | HP: 081234560001 | PIN: 123456 |
| Puskesmas | demo@puskesmas-mergangsan.go.id | Demo1234! |

## Reset data sebelum presentasi
```bash
docker compose exec sispos-backend npx prisma migrate reset --force
docker compose exec sispos-backend npx tsx prisma/seed.wilayah.ts
docker compose exec sispos-backend npx prisma db seed
docker compose exec sispos-backend npx tsx prisma/seed.demo.ts
```

## Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Node.js + Express + TypeScript + Prisma ORM
- Database: PostgreSQL 16
- Cache/Queue: Redis 7 + BullMQ
- Realtime: Socket.IO
- AI: OpenAI GPT-4o + Google Cloud STT
- WhatsApp: Fonnte API
- Infra: Docker (5 container) + Nginx

## Struktur Direktori Proyek
```text
sispos/
|-- backend/                    # Aplikasi backend Node.js, Express, dan TypeScript
|   |-- src/
|   |   |-- config/             # Konfigurasi database, environment, Redis, dan Socket.IO
|   |   |-- modules/            # Modul fitur utama backend
|   |   |   |-- ai/             # Layanan AI untuk chat, gizi, dan pendaftaran
|   |   |   |-- antrian/        # Manajemen antrian warga
|   |   |   |-- audit/          # Audit log aktivitas sistem
|   |   |   |-- auth/           # Autentikasi dan otorisasi pengguna
|   |   |   |-- child/          # Data balita/anak
|   |   |   |-- dashboard/      # Data ringkasan dashboard
|   |   |   |-- growth/         # Pemeriksaan pertumbuhan dan status gizi
|   |   |   |-- immunization/   # Data imunisasi
|   |   |   |-- jadwal/         # Jadwal layanan Posyandu
|   |   |   |-- notification/   # Worker, queue, dan notifikasi
|   |   |   |-- posyandu/       # Data Posyandu
|   |   |   |-- queue/          # Alur pelayanan kader per meja
|   |   |   |-- reports/        # Laporan harian dan bulanan
|   |   |   |-- users/          # Manajemen pengguna dan kader
|   |   |   |-- voice/          # Layanan voice/STT
|   |   |   `-- wilayah/        # Data wilayah administrasi
|   |   |-- shared/             # Middleware, schema, utilitas, dan data bersama
|   |   |-- app.ts              # Inisialisasi aplikasi Express
|   |   `-- server.ts           # Entry point server backend
|   |-- tests/                  # Unit/integration test backend
|   |-- Dockerfile              # Image Docker backend
|   `-- package.json            # Dependency dan script backend
|-- frontend/                   # Aplikasi frontend React, Vite, dan TypeScript
|   |-- public/                 # Asset publik, ikon, favicon, dan manifest PWA
|   |-- src/
|   |   |-- components/         # Komponen UI dan komponen fitur
|   |   |-- hooks/              # Custom hooks React
|   |   |-- layouts/            # Layout halaman berdasarkan role
|   |   |-- lib/                # API client, socket, validasi, dan utilitas frontend
|   |   |-- pages/              # Halaman aplikasi
|   |   |   |-- auth/           # Halaman login, register, OTP, dan onboarding
|   |   |   |-- citizen/        # Halaman warga
|   |   |   |-- kader/          # Halaman kader dan pelayanan meja
|   |   |   `-- puskesmas/      # Halaman admin Puskesmas
|   |   |-- router/             # Konfigurasi routing dan protected route
|   |   |-- stores/             # State management frontend
|   |   |-- App.tsx             # Root component React
|   |   `-- main.tsx            # Entry point frontend
|   |-- Dockerfile              # Image Docker frontend
|   `-- package.json            # Dependency dan script frontend
|-- prisma/                     # Prisma schema, migration, dan seed database
|   |-- migrations/             # Riwayat migrasi database
|   |-- schema.prisma           # Definisi model database
|   `-- seed*.ts                # Script pengisian data awal/demo
|-- nginx/                      # Konfigurasi reverse proxy Nginx
|-- docs/                       # Dokumentasi proyek
|-- docker-compose.yml          # Orkestrasi service aplikasi
|-- tsconfig.json               # Konfigurasi TypeScript root
`-- README.md                   # Dokumentasi utama proyek

## Dokumentasi Progress
Lihat `docs/PROGRESS.md` untuk status development dan history keputusan teknis.
