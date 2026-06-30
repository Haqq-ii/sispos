---
phase: 00-infrastructure-setup
plan: "03"
subsystem: frontend
tags: [react, vite, typescript, tailwind, shadcn-ui, pwa, zustand, tanstack-query, axios, react-router]
dependency_graph:
  requires:
    - docker-compose.yml (sispos-frontend build context ./frontend — from 00-01)
    - nginx/nginx.conf (/* → frontend:5173 proxy — from 00-01)
  provides:
    - frontend/Dockerfile (Vite dev server container on port 5173)
    - frontend/package.json (all dependencies pinned)
    - frontend/vite.config.ts (VitePWA with NetworkOnly /api/*)
    - frontend/public/manifest.json (valid PWA manifest)
    - frontend/src/main.tsx (React root with QueryClientProvider)
    - frontend/src/lib/axios.ts (Axios client → /api, withCredentials)
    - frontend/src/stores/useAuthStore.ts (typed Zustand auth store)
    - frontend/src/router/index.tsx (React Router v6 routes for 3 roles)
  affects:
    - Plan 00-04 (docker compose up — brings frontend container live)
    - All subsequent UI phases (Phase 1+ will add real pages/components on this scaffold)
tech_stack:
  added:
    - React 18.3.1
    - Vite 5.3.1
    - TypeScript 5.4.5 (strict mode)
    - Tailwind CSS 3.4.4
    - shadcn/ui (manual setup via components.json)
    - vite-plugin-pwa 0.20.0 (Workbox offline-first)
    - React Router v6.23.1
    - Zustand 4.5.2 (UI state only)
    - TanStack Query v5.45.0 (server state)
    - Axios 1.7.2 (JWT httpOnly cookie transport)
    - socket.io-client 4.7.5
    - lucide-react 0.400.0
    - clsx + tailwind-merge (cn() utility)
  patterns:
    - Lazy-loaded routes via React.lazy + Suspense
    - Zustand persist middleware for auth state (localStorage)
    - Axios response interceptor for 401 → redirect /login
    - VitePWA with manifest: false (public/manifest.json direct)
    - NetworkOnly workbox handler for /api/* (JWT security requirement)
    - TypeScript strict + noImplicitAny throughout
key_files:
  created:
    - frontend/Dockerfile
    - frontend/package.json
    - frontend/tsconfig.json
    - frontend/tsconfig.node.json
    - frontend/index.html
    - frontend/vite.config.ts
    - frontend/tailwind.config.js
    - frontend/postcss.config.js
    - frontend/components.json
    - frontend/public/manifest.json
    - frontend/public/favicon.svg
    - frontend/src/index.css
    - frontend/src/main.tsx
    - frontend/src/App.tsx
    - frontend/src/router/index.tsx
    - frontend/src/lib/utils.ts
    - frontend/src/lib/axios.ts
    - frontend/src/lib/queryClient.ts
    - frontend/src/stores/useAuthStore.ts
    - frontend/src/pages/CitizenDashboardPage.tsx
    - frontend/src/pages/KaderDashboardPage.tsx
    - frontend/src/pages/PuskesmasDashboardPage.tsx
    - frontend/src/pages/NotFoundPage.tsx
  modified:
    - .gitignore (added !manifest.json exception — Rule 3 auto-fix)
decisions:
  - "VitePWA manifest: false — use public/manifest.json directly to avoid duplicate manifests and keep PWA config in one place"
  - "Axios interceptor uses type-narrowing instead of axios.isAxiosError() to avoid any types (TypeScript strict compliance)"
  - "Placeholder pages use HTML entity codes instead of emoji literals to avoid encoding issues across environments"
  - "Tailwind custom primary colors defined as explicit hex values (not CSS variables) for Tailwind JIT compatibility"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 00 Plan 03: Frontend Scaffold Summary

**One-liner:** React 18 + Vite 5 frontend scaffold with Tailwind CSS, shadcn/ui config, VitePWA (NetworkOnly /api/*), Zustand auth store, TanStack Query v5, Axios JWT cookie client, and React Router v6 placeholder routes for all three SISPOS roles.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Dockerfile, package.json, Vite, Tailwind, shadcn/ui, PWA manifest, index.css | `4a43aa7` | Done |
| 2 | main.tsx, App.tsx, router, axios, queryClient, Zustand store, 4 placeholder pages | `2cb56dc` | Done |

## Files Created (Task 1)

**Container setup:**
- `frontend/Dockerfile` — `FROM node:20-alpine`, `CMD npm run dev -- --host 0.0.0.0 --port 5173`

**Vite + TypeScript:**
- `frontend/package.json` — React 18, Vite 5, all required deps; `"type": "module"`
- `frontend/tsconfig.json` — `strict: true`, `noImplicitAny: true`, `@/*` path alias → `./src/*`
- `frontend/tsconfig.node.json` — composite build for vite.config.ts
- `frontend/vite.config.ts` — VitePWA plugin with `runtimeCaching` NetworkOnly for `/api/` pattern; `server.host: 0.0.0.0`

**Tailwind + shadcn/ui:**
- `frontend/tailwind.config.js` — SISPOS green brand colors (#16a34a), shadcn/ui CSS variable tokens, content includes `./src/**/*.{ts,tsx}`
- `frontend/postcss.config.js` — tailwindcss + autoprefixer
- `frontend/components.json` — shadcn/ui config: `style: "default"`, aliases `@/components`, `@/lib/utils`
- `frontend/src/index.css` — `@tailwind base/components/utilities` + `:root` CSS variables for shadcn/ui

**PWA:**
- `frontend/public/manifest.json` — `name`, `short_name: "SISPOS"`, `start_url: "/"`, `display: "standalone"`, icons array with favicon.svg
- `frontend/public/favicon.svg` — green circle "P" placeholder (Posyandu branding)
- `frontend/index.html` — `lang="id"`, `<link rel="manifest">`, `theme-color: #16a34a`

## Files Created (Task 2)

**React entry:**
- `frontend/src/main.tsx` — `React.StrictMode` + `QueryClientProvider` wrapping `App`
- `frontend/src/App.tsx` — `BrowserRouter` + `AppRouter`

**Router:**
- `frontend/src/router/index.tsx` — lazy-loaded routes: `/` → redirect `/citizen/dashboard`, `/citizen/dashboard`, `/kader/dashboard`, `/puskesmas/dashboard`, `*` → NotFound

**Lib utilities:**
- `frontend/src/lib/utils.ts` — `cn()` helper using clsx + tailwind-merge
- `frontend/src/lib/axios.ts` — `baseURL: '/api'`, `withCredentials: true`, 401 interceptor → `/login`
- `frontend/src/lib/queryClient.ts` — TanStack Query v5: `staleTime: 5min`, `gcTime: 10min`, `retry: 1`

**State:**
- `frontend/src/stores/useAuthStore.ts` — Zustand with persist: `user: AuthUser | null`, `isAuthenticated`, `setUser`, `clearAuth`; types `RolePengguna = 'citizen' | 'kader' | 'ketua_kader' | 'puskesmas'`

**Placeholder pages (Bahasa Indonesia UI):**
- `frontend/src/pages/CitizenDashboardPage.tsx` — "Dashboard Warga"
- `frontend/src/pages/KaderDashboardPage.tsx` — "Dashboard Kader"
- `frontend/src/pages/PuskesmasDashboardPage.tsx` — "Dashboard Puskesmas"
- `frontend/src/pages/NotFoundPage.tsx` — 404, "Halaman tidak ditemukan", link "Kembali ke Beranda"

## Deviations from Plan

### Auto-fixed: manifest.json gitignore exclusion (Rule 3 — Blocking Issue)

- **Found during:** Task 1
- **Issue:** `.gitignore` has `*.json` pattern that blocks `frontend/public/manifest.json` from being staged. The existing exceptions (`!package.json`, `!components.json`, etc.) did not include `!manifest.json`, causing `git add` to fail.
- **Fix:** Added `!manifest.json` to `.gitignore` exception list
- **Files modified:** `.gitignore`
- **Commit:** `4a43aa7` (included in Task 1 commit)

### Auto-adjusted: Emoji literals replaced with HTML entity codes (Rule 1 — Bug prevention)

- **Found during:** Task 2
- **Issue:** Plan spec used emoji literals directly in JSX (`👶`, `🏥`, `📊`). Emoji characters can cause encoding problems on Windows (CRLF conversion, file encoding mismatches in Docker containers built on Linux).
- **Fix:** Replaced with HTML entity codes (`&#128118;`, `&#127973;`, `&#128202;`) which are unambiguous and encoding-safe
- **Files modified:** CitizenDashboardPage.tsx, KaderDashboardPage.tsx, PuskesmasDashboardPage.tsx

### Auto-adjusted: Axios error interceptor uses type-narrowing (Rule 2 — TypeScript strict compliance)

- **Found during:** Task 2
- **Issue:** Plan spec used `error.response?.status` without type guard, which would fail TypeScript strict mode (`error` has type `unknown` in interceptors).
- **Fix:** Added explicit type-narrowing guard (`typeof error === 'object' && 'response' in error...`) to check response.status without using `any`
- **Files modified:** `frontend/src/lib/axios.ts`

## Known Stubs

The following placeholder pages have stub content (intentional for Phase 0 scaffold):

| Stub | File | Reason |
|------|------|--------|
| "Halaman ini akan diisi pada Phase 2+" | CitizenDashboardPage.tsx | Placeholder only; Phase 1-2 will add real auth + citizen features |
| "Halaman ini akan diisi pada Phase 3" | KaderDashboardPage.tsx | Placeholder only; Phase 3 will add kader workflow |
| "Halaman ini akan diisi pada Phase 4" | PuskesmasDashboardPage.tsx | Placeholder only; Phase 4 will add puskesmas monitoring |

These stubs are intentional. The plan goal is achieved: the container starts, routes render, and the PWA scaffold is valid. Real content is in scope for subsequent phases.

## Verification Results

| Check | Result |
|-------|--------|
| Dockerfile CMD: `--host 0.0.0.0 --port 5173` | PASS |
| package.json: react, react-router-dom, zustand, @tanstack/react-query, axios, socket.io-client, lucide-react | PASS |
| tsconfig.json: strict: true, @/* path alias | PASS |
| vite.config.ts: VitePWA + NetworkOnly for /api/ | PASS |
| public/manifest.json: standalone display, icons array | PASS |
| tailwind.config.js: content includes ./src/**/*.{ts,tsx} | PASS |
| components.json: style default, @/components alias | PASS |
| src/index.css: @tailwind directives + CSS variables | PASS |
| main.tsx: QueryClientProvider + StrictMode | PASS |
| lib/axios.ts: baseURL '/api', withCredentials: true | PASS |
| stores/useAuthStore.ts: typed, setUser, clearAuth | PASS |
| router/index.tsx: routes for all 3 roles + 404 | PASS |
| No TypeScript `any` types in src/ | PASS |
| Bahasa Indonesia text in all placeholder pages | PASS |

## Threat Surface Scan

Mitigations from threat register applied:
- **T-00-03-A**: Only `VITE_API_BASE_URL=/api` and `VITE_SOCKET_URL=/` in docker-compose env — no API keys in frontend env
- **T-00-03-B**: `vite.config.ts` VitePWA sets `handler: 'NetworkOnly'` for `urlPattern: /^\/api\//` — SW never caches API responses
- **T-00-03-C**: `useAuthStore` comment documents that JWT httpOnly cookie is the real auth signal; Zustand is UI display only
- **T-00-03-D**: Accepted — placeholder pages have no real data; ProtectedRoute added in Phase 1

No new trust boundaries or network endpoints introduced beyond plan scope.

## Self-Check: PASSED

Files exist:
- `frontend/Dockerfile` — FOUND
- `frontend/package.json` — FOUND
- `frontend/vite.config.ts` — FOUND
- `frontend/public/manifest.json` — FOUND
- `frontend/src/main.tsx` — FOUND
- `frontend/src/lib/axios.ts` — FOUND
- `frontend/src/stores/useAuthStore.ts` — FOUND
- `frontend/src/router/index.tsx` — FOUND

Commits exist:
- `4a43aa7` — Task 1 (Dockerfile, Vite, Tailwind, PWA config)
- `2cb56dc` — Task 2 (React entry, router, stores, pages)
