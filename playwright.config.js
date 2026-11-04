import { defineConfig, devices } from '@playwright/test'

/**
 * The end-to-end tour (optional: `npm run e2e`). It builds the app, starts the real API on a throwaway in-memory
 * database (e2e/server.py) and drives a real Chromium through what the families and the team do.
 * It is not part of `npm test`: it needs a browser (`npx playwright install chromium`, once).
 */
const API_PORT = 8010
const SITE_PORT = 4173

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // the tour shares one database, one step after another
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${SITE_PORT}`,
    serviceWorkers: 'block', // the service worker has its own checks; here pages must not come from a cache
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
    { name: 'movil', use: { ...devices['Pixel 7'] }, testMatch: '**/accesibilidad.spec.js' },
  ],
  webServer: [
    {
      command: `python e2e/server.py`,
      env: { E2E_API_PORT: String(API_PORT) },
      url: `http://127.0.0.1:${API_PORT}/api/salud`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${SITE_PORT} --strictPort`,
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
      url: `http://127.0.0.1:${SITE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
