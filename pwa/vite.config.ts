import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

// Sidelearn Learn PWA — its own Vite app, reusing src/core/* and the bundled
// dictionary/frequency JSONs (served from src/public). Offline-capable via a
// service worker that precaches the app shell and runtime-caches the big data
// files; app updates are surfaced with a friendly banner (see useUpdate()).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Served from a subpath: learny.pyrates.io/app/ (the landing page lives at /).
  base: '/app/',
  publicDir: fileURLToPath(new URL('../src/public', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
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
        name: 'Learny',
        short_name: 'Learny',
        description: 'Language learning on the side — lies echte Texte auf deinem Sprachniveau.',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#f3f1fb',
        theme_color: '#ff6b9d',
        icons: [
          { src: 'icon/192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon/512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6_000_000,
        runtimeCaching: [
          {
            // The version manifest must always be fresh — it drives cache-busting.
            urlPattern: ({ url }) => url.pathname.endsWith('data-manifest.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'sidelearn-manifest', networkTimeoutSeconds: 4 },
          },
          {
            // Dictionary/frequency JSONs are requested with a ?v=<content-hash>
            // (see dataUrl), so CacheFirst is correct: changed content = new URL =
            // fresh fetch; unchanged files stay cached (no wasteful re-download).
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sidelearn-data',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
    }),
  ],
});
