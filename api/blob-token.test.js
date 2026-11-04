// The Vercel function that hands out upload tokens for videos (F13), run in Node as Vercel runs it.
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayloadFromClientToken } from '@vercel/blob/client'
import handler from './blob-token.js'
import { MAX_VIDEO_BYTES, UploadRefused, bearerToken, checkUpload, verifyToken } from './_lib/video.js'

const SECRET = 'test-secret-test-secret-test-secret-123'
const USER = '665f1c2e8b7d4a0012345678'

/** A token made by the API itself (PyJWT, HS256, same secret): proves both sides speak the same JWT. */
const TOKEN_FROM_PYTHON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjVmMWMyZThiN2Q0YTAwMTIzNDU2NzgiLCJyb2wiOiJuYXJyYWRvciIsIm5vbWJyZSI6IkFuYSBCZWx0clx1MDBlMW4iLCJpYXQiOjE3NjAwMDAwMDAsImV4cCI6NDEwMjQ0NDgwMH0.Ef0So4XzLRtBn5PBsZT1QV47hx5O37V5Syo6XTr-NZ8'

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
function makeToken(claims = {}, { secret = SECRET, header = { alg: 'HS256', typ: 'JWT' } } = {}) {
  const body = { sub: USER, rol: 'narrador', exp: Math.floor(Date.now() / 1000) + 3600, ...claims }
  const signed = `${encode(header)}.${encode(body)}`
  return `${signed}.${createHmac('sha256', secret).update(signed).digest('base64url')}`
}

describe('verifyToken: the session token the API gave at sign-in', () => {
  it('accepts a token made by the Python API', () => {
    expect(verifyToken(TOKEN_FROM_PYTHON, SECRET)).toMatchObject({ sub: USER, rol: 'narrador', nombre: 'Ana Beltrán' })
  })

  it('accepts a narrator and an administrator', () => {
    expect(verifyToken(makeToken({ rol: 'narrador' }), SECRET)).not.toBeNull()
    expect(verifyToken(makeToken({ rol: 'administrador' }), SECRET)).not.toBeNull()
  })

  it.each([
    ['one signed with another secret', makeToken({}, { secret: 'another-secret-another-secret-another-1' })],
    ['one that says it needs no signature (alg none)', `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: USER, rol: 'narrador', exp: 9999999999 })}.`],
    ['one with another algorithm in its header', makeToken({}, { header: { alg: 'HS512', typ: 'JWT' } })],
    ['one that has expired', makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 })],
    ['one without an expiry', makeToken({ exp: undefined })],
    ['one without who it is for', makeToken({ sub: '' })],
    ['one for a role that cannot upload', makeToken({ rol: 'visitante' })],
    ['one that is not a token', 'not-a-token'],
    ['an empty one', ''],
  ])('refuses %s', (_name, token) => {
    expect(verifyToken(token, SECRET)).toBeNull()
  })

  it('refuses a token whose content was changed after it was signed', () => {
    const [head, , signature] = makeToken({ rol: 'narrador' }).split('.')
    const forged = `${head}.${encode({ sub: 'someone-else', rol: 'administrador', exp: 9999999999 })}.${signature}`

    expect(verifyToken(forged, SECRET)).toBeNull()
  })

  it('refuses everything when the secret is missing or too short, as the API does', () => {
    expect(verifyToken(makeToken(), '')).toBeNull()
    expect(verifyToken(makeToken({}, { secret: 'short' }), 'short')).toBeNull()
  })

  it('allows a few seconds of difference between clocks, not minutes', () => {
    const now = Date.now()
    expect(verifyToken(makeToken({ exp: Math.floor(now / 1000) - 5 }), SECRET, now)).not.toBeNull()
    expect(verifyToken(makeToken({ exp: Math.floor(now / 1000) - 60 }), SECRET, now)).toBeNull()
  })
})

describe('bearerToken', () => {
  it('reads "Bearer <token>"', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
    expect(bearerToken('bearer abc')).toBe('abc')
  })

  it.each([undefined, '', 'abc', 'Basic abc', 'Bearer', 'Bearer a b'])('gives nothing for %j', (header) => {
    expect(bearerToken(header)).toBeNull()
  })
})

describe('checkUpload: what a token may be used for', () => {
  it('allows one video in the person’s own folder, up to 25 MB', () => {
    const allowed = checkUpload(`historias/${USER}/video-abc123.mp4`, USER)

    expect(allowed.maximumSizeInBytes).toBe(25 * 1024 * 1024)
    expect(MAX_VIDEO_BYTES).toBe(25 * 1024 * 1024)
    expect(allowed.allowedContentTypes).toEqual(['video/mp4', 'video/quicktime', 'video/webm'])
    expect(allowed.addRandomSuffix).toBe(true)
    expect(allowed.allowOverwrite).toBe(false)
  })

  it.each(['mp4', 'mov', 'webm', 'MP4'])('accepts the extension %s', (extension) => {
    expect(() => checkUpload(`historias/${USER}/v.${extension}`, USER)).not.toThrow()
  })

  it.each([
    ['another person’s folder', `historias/someone-else/v.mp4`],
    ['outside the stories folder', `otros/${USER}/v.mp4`],
    ['the root', 'v.mp4'],
    ['a sub-folder', `historias/${USER}/a/b.mp4`],
    ['going up a folder', `historias/${USER}/../x/v.mp4`],
    ['a name that goes up', `historias/${USER}/..v.mp4`],
    ['a hidden file', `historias/${USER}/.v.mp4`],
    ['no name', `historias/${USER}/`],
    ['a name with spaces', `historias/${USER}/mi video.mp4`],
  ])('refuses %s', (_name, pathname) => {
    expect(() => checkUpload(pathname, USER)).toThrow(UploadRefused)
  })

  it.each(['v.exe', 'v.html', 'v.jpg', 'v.mp3', 'v'])('refuses a file that is not a video: %s', (name) => {
    expect(() => checkUpload(`historias/${USER}/${name}`, USER)).toThrow('Solo se pueden subir videos')
  })
})

/** What Vercel gives a Node function: a request with a parsed body, and a response with status() and json(). */
function call({ method = 'POST', authorization, body } = {}) {
  const request = { method, headers: { ...(authorization ? { authorization } : {}), host: 'agrocultura.vercel.app' }, body }
  const response = { code: null, payload: null, status(code) { this.code = code; return this }, json(payload) { this.payload = payload; return this } }
  return handler(request, response).then(() => response)
}
const asksForToken = (pathname) => ({ type: 'blob.generate-client-token', payload: { pathname, multipart: true, clientPayload: null } })

describe('POST /api/blob-token', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', SECRET)
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_teststore_0123456789abcdefghij')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('gives a client token for the person’s own video, limited to that path, to video types and to 25 MB', async () => {
    const path = `historias/${USER}/video-abc123.mp4`

    const response = await call({ authorization: `Bearer ${makeToken()}`, body: asksForToken(path) })

    expect(response.code).toBe(200)
    expect(response.payload.type).toBe('blob.generate-client-token')
    const limits = getPayloadFromClientToken(response.payload.clientToken)
    expect(limits.pathname).toBe(path)
    expect(limits.maximumSizeInBytes).toBe(MAX_VIDEO_BYTES)
    expect(limits.allowedContentTypes).toEqual(['video/mp4', 'video/quicktime', 'video/webm'])
    expect(limits.addRandomSuffix).toBe(true)
  })

  it('answers 401 without a session, with a bad one, and with one for another secret', async () => {
    for (const authorization of [undefined, 'Bearer nope', `Bearer ${makeToken({}, { secret: 'another-secret-another-secret-another-1' })}`]) {
      const response = await call({ authorization, body: asksForToken(`historias/${USER}/v.mp4`) })
      expect(response.code).toBe(401)
      expect(response.payload.detail).toMatch(/sesión/)
    }
  })

  it('answers 400 with the reason when the file is not allowed', async () => {
    const authorization = `Bearer ${makeToken()}`

    const foreign = await call({ authorization, body: asksForToken('historias/someone-else/v.mp4') })
    const notVideo = await call({ authorization, body: asksForToken(`historias/${USER}/v.exe`) })

    expect(foreign.code).toBe(400)
    expect(foreign.payload.detail).toBe('No se puede subir el video a esa dirección.')
    expect(notVideo.code).toBe(400)
    expect(notVideo.payload.detail).toMatch(/MP4, MOV o WebM/)
  })

  it('answers 405 to anything but POST', async () => {
    expect((await call({ method: 'GET' })).code).toBe(405)
  })

  it('says what is missing when the server is not configured', async () => {
    vi.stubEnv('JWT_SECRET', '')
    expect((await call({ authorization: `Bearer ${makeToken()}`, body: asksForToken(`historias/${USER}/v.mp4`) })).payload.detail).toMatch(/JWT_SECRET/)

    vi.stubEnv('JWT_SECRET', SECRET)
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    const response = await call({ authorization: `Bearer ${makeToken()}`, body: asksForToken(`historias/${USER}/v.mp4`) })
    expect(response.code).toBe(503)
    expect(response.payload.detail).toMatch(/Blob/)
  })

  it('does not leak internals when something unexpected fails', async () => {
    const response = await call({ authorization: `Bearer ${makeToken()}`, body: { type: 'something-else', payload: {} } })

    expect(response.code).toBe(500)
    expect(response.payload.detail).toBe('No pudimos preparar la subida del video. Intenta de nuevo.')
    expect(JSON.stringify(response.payload)).not.toMatch(/vercel_blob_rw/)
  })
})
