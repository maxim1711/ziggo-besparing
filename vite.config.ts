import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  // GitHub Pages serveert de app onder deze submap. NIET wijzigen: assets, manifest en
  // service worker (scope) zijn hierop afgestemd. Gebruik in code import.meta.env.BASE_URL.
  base: '/ziggo-besparing/',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: 'index.html' },
      manifest: {
        name: 'Overstapadvies',
        short_name: 'Overstapadvies',
        description: 'Onafhankelijke vergelijking van internet- en tv-abonnementen',
        lang: 'nl',
        theme_color: '#5b21b6',
        background_color: '#faf9fc',
        display: 'standalone',
        orientation: 'any',
        // Relatief t.o.v. het manifest, dus altijd binnen de submap van de app.
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
