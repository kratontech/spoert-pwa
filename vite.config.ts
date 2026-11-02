import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'SPOERT — Booking Lapangan',
        short_name: 'SPOERT',
        description: 'Booking lapangan olahraga (versi demo frontend-only)',
        theme_color: '#0f5132',
        background_color: '#f4f7f2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // library ekspor (PDF/Excel) besar & jarang dipakai: jangan di-precache, cukup di-cache saat pertama dipakai
        globIgnores: ['**/jspdf*', '**/html2canvas*', '**/index.es-*', '**/purify*', '**/universal-*', '**/exporters-*', '**/browser-*'],
        runtimeCaching: [{
          urlPattern: ({ url }: { url: URL }) => /\/assets\/(jspdf|html2canvas|index\.es|purify|universal|exporters|browser)[^/]*\.js$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'export-libs', expiration: { maxEntries: 20 } },
        }],
      },
    }),
  ],
})
