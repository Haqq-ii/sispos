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

## Dokumentasi Progress
Lihat `docs/PROGRESS.md` untuk status development dan history keputusan teknis.
