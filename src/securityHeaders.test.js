import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TILE_PROVIDER } from './config/map.js'

/**
 * The security headers live in vercel.json. The Content-Security-Policy only lets the browser load what is listed, so a
 * new outside service (another map provider, say) has to be added there too, or the page stops showing it. These checks
 * are the reminder.
 */
const projectFile = (name) => readFileSync(resolve(process.cwd(), name), 'utf8') // the tests run from the project folder
const vercel = JSON.parse(projectFile('vercel.json'))
const rulesFor = (path) => vercel.headers.filter((rule) => new RegExp(`^${rule.source}$`).test(path)).flatMap((rule) => rule.headers)
const header = (path, key) => rulesFor(path).find((item) => item.key === key)?.value
const directive = (name) =>
  header('/', 'Content-Security-Policy')
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name)
    ?.slice(1) ?? []

describe('Encabezados de seguridad (vercel.json)', () => {
  it('every address gets the basic ones: no guessing types, no framing, a short referrer, only the needed permissions', () => {
    for (const path of ['/', '/mis-historias', '/api/historias', '/h/HIS-2026-001', '/assets/index.js']) {
      expect(header(path, 'X-Content-Type-Options')).toBe('nosniff')
      expect(header(path, 'X-Frame-Options')).toBe('DENY')
      expect(header(path, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      // the microphone (to record), the camera and the location («Usar mi ubicación») are used by the portal itself
      expect(header(path, 'Permissions-Policy')).toMatch(/microphone=\(self\).*geolocation=\(self\)/)
    }
  })

  it('the portal runs only its own scripts: nothing written in the page, nothing from elsewhere', () => {
    expect(directive('script-src')).toEqual(["'self'"])
    expect(directive('default-src')).toEqual(["'self'"])
    expect(directive('object-src')).toEqual(["'none'"])
    expect(directive('frame-ancestors')).toEqual(["'none'"])
    // so the built page must not carry a script of its own inside
    const page = projectFile('index.html')
    expect(page.match(/<script(?![^>]*\bsrc=)[^>]*>/g)).toBeNull()
  })

  it('lets in the map provider of src/config/map.js, for the map and for keeping its pieces without signal', () => {
    const tiles = new URL(TILE_PROVIDER.url.replace(/\{[a-z]\}/g, '0')).origin
    expect(directive('img-src')).toContain(tiles)
    expect(directive('connect-src')).toContain(tiles) // the service worker fetches them to keep them
  })

  it('lets in the photos, audios and videos of the stories, and the video upload straight to Blob', () => {
    const store = 'https://*.public.blob.vercel-storage.com'
    expect(directive('img-src')).toContain(store)
    expect(directive('media-src')).toContain(store)
    expect(directive('media-src')).toContain('blob:') // what was just recorded or picked, before it is sent
    expect(directive('connect-src')).toContain('https://vercel.com') // @vercel/blob/client talks to vercel.com/api/blob
  })

  it('leaves out the API and the shared links: the page at /h/ brings its own, stricter policy', () => {
    expect(header('/api/historias', 'Content-Security-Policy')).toBeUndefined()
    expect(header('/h/HIS-2026-001', 'Content-Security-Policy')).toBeUndefined()
    expect(header('/historias-propias', 'Content-Security-Policy')).toBeDefined() // only /h/…, not anything starting with h
  })
})
