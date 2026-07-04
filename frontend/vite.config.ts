import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: false, // Use public/manifest.json directly
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // CRITICAL: Specific BackgroundSync patterns MUST appear BEFORE the catch-all.
        // Workbox matches first-wins — wrong order silently breaks offline sync (Pitfall 1).
        runtimeCaching: [
          // Entry 1: Meja 1 — kehadiran hadir
          {
            urlPattern: /^\/api\/antrian\/[^/]+\/hadir$/,
            handler: 'NetworkOnly' as const,
            options: {
              backgroundSync: {
                name: 'kehadiran_queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          // Entry 2: Meja 1 — kehadiran tangguhkan
          {
            urlPattern: /^\/api\/antrian\/[^/]+\/tangguhkan$/,
            handler: 'NetworkOnly' as const,
            options: {
              backgroundSync: {
                name: 'kehadiran_queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          // Entry 3: Meja 2/3/4 — pemeriksaan create + patch
          {
            urlPattern: /^\/api\/growth\/pemeriksaan/,
            handler: 'NetworkOnly' as const,
            options: {
              backgroundSync: {
                name: 'pemeriksaan_queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          // Entry 4: Meja 5 — imunisasi
          {
            urlPattern: /^\/api\/immunization/,
            handler: 'NetworkOnly' as const,
            options: {
              backgroundSync: {
                name: 'meja5_queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          // CATCH-ALL: must remain LAST — never cache API responses
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
            options: { cacheName: 'api-network-only' },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
