import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// In development the API runs separately (uvicorn on :8000) and Vite proxies
// /api to it, so the browser only ever talks to one origin, as in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
})
