import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { TILE_PROVIDER } from './src/config/map.js'

// In development the API runs separately (uvicorn on :8000, or API_URL) and Vite proxies
// /api to it, so the browser only ever talks to one origin, as in production.
const api = { '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:8000', changeOrigin: true } }

// The map tiles the person has already looked at are kept for when there is no signal (F10).
// Only those: nothing is downloaded ahead of time (OpenStreetMap's tile policy forbids that).
const tileHost = new URL(TILE_PROVIDER.url.replace('{s}', 'a')).hostname
// A RegExp, not a function: the service worker is a separate file and a function would lose `tileHost` when copied into it.
const tileUrls = new RegExp(`^https://${tileHost.replace(/\./g, '\\.')}/`)

/**
 * The app as an installable page that opens without signal (F10, PWA).
 * The service worker keeps the app itself (pages, scripts, styles, fonts, icons); the data is kept by the app in
 * IndexedDB (see src/offline/store.js), never by the service worker, so private answers (a narrator's own stories)
 * are not left in a cache a different person on the same phone could read.
 */
const pwa = VitePWA({
  // A new version waits until the person agrees ("Hay una versión nueva", src/offline/updates.js): updating reloads the
  // page, which must not happen by surprise while somebody is recording.
  registerType: 'prompt',
  injectRegister: false, // the app registers it itself, to hear about new versions
  manifest: {
    name: 'AGROCULTURA',
    short_name: 'AGROCULTURA',
    description: 'Memoria histórica y patrimonio cultural de la cultura cafetera de Minca y sectores aledaños.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#1F3A2E',
    background_color: '#F2F4F0',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    navigateFallback: '/index.html', // any page of the app opens offline...
    navigateFallbackDenylist: [/^\/api\//], // ...but the API is never answered with the page
    cleanupOutdatedCaches: true,
    clientsClaim: true, // the very first visit is already served by the worker, with no reload needed
    runtimeCaching: [
      {
        urlPattern: tileUrls,
        handler: 'CacheFirst',
        options: {
          cacheName: 'mapa-teselas',
          expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [200] }, // tiles are asked for with CORS (see config/map.js), so they are not opaque
        },
      },
    ],
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'test' ? [] : [pwa])],
  // The tests have no service worker plugin: its registration module is replaced by one they can steer.
  resolve: mode === 'test' ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwaRegister.js', import.meta.url)) } } : {},
  server: { port: 5173, proxy: api },
  preview: { port: 4173, proxy: api }, // `npm run preview` serves the built app (with its service worker) against the local API
  test: {
    css: false,
    projects: [
      // The app, in a browser-like environment.
      {
        extends: true,
        // The design's feature codes are shown here so the tests can name things as the design does; src/codes.test.jsx checks them hidden.
        test: { name: 'app', environment: 'jsdom', setupFiles: ['./src/test/setup.js'], include: ['src/**/*.test.{js,jsx}'], env: { VITE_SHOW_CODES: 'true' } },
      },
      // The Vercel functions written in Node (api/*.js), run in Node as Vercel runs them.
      { extends: true, test: { name: 'functions', environment: 'node', include: ['api/**/*.test.js'] } },
    ],
  },
}))
