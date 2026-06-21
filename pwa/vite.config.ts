import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// Sidelearn Learn PWA — its own Vite app, reusing src/core/* and the bundled
// dictionary/frequency JSONs (served from src/public). Offline-capable via a
// service worker that precaches the app shell and runtime-caches the big data
// files; app updates are surfaced with a friendly banner (see useUpdate()).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../src/public', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('../.output/pwa', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon/*.png'],
      manifest: {
        name: 'Sidelearn',
        short_name: 'Sidelearn',
        description: 'Lies echte Texte auf deinem Sprachniveau.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#191820',
        theme_color: '#6b57d6',
        icons: [
          { src: 'icon/192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon/512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // App shell precached; large dictionary/frequency JSONs cached on first
        // use (cache-first, they're immutable per deploy).
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6_000_000,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sidelearn-data',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
