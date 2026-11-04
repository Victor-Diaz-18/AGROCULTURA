import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_VIDEO_BYTES } from '../config/constants.js'
import { resetConnectivityForTests, setSimulatedOffline } from '../offline/connectivity.js'
import { ApiError, OfflineError } from './http.js'
import { VIDEO_MESSAGES, checkVideoFile, sendVideo, uploadVideo, videoMime } from './video.js'

const put = vi.fn()
vi.mock('@vercel/blob/client', () => ({ put: (...args) => put(...args) }))

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const clip = (type = 'video/mp4', name = 'v.mp4') => new File([new Uint8Array(1000)], name, { type })
const URL_UP = 'https://store1.public.blob.vercel-storage.com/historias/u1/video-abc.mp4-Zz9'

let calls
function stubApi(answers = {}) {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      calls.push([String(url), init])
      const answer = answers[String(url)] ?? (() => jsonResponse({ detail: 'No encontrado' }, 404))
      return answer(init)
    }),
  )
}
const tokenOk = () => jsonResponse({ type: 'blob.generate-client-token', clientToken: 'client-token-123' })
const attached = (init) => jsonResponse({ codigo: 'HIS-2026-001', estado: 'revision', titulo: 'x', enviada_en: '' }, init ? 200 : 200)

beforeEach(() => {
  resetConnectivityForTests()
  localStorage.setItem('agrocultura.token', 'session-token')
  put.mockReset().mockResolvedValue({ url: URL_UP })
})
afterEach(() => vi.unstubAllGlobals())

describe('which videos we take', () => {
  it('knows the type from the file, or from its extension when the phone says nothing', () => {
    expect(videoMime(clip('video/mp4'))).toBe('video/mp4')
    expect(videoMime(clip('video/quicktime', 'IMG_1.MOV'))).toBe('video/quicktime')
    expect(videoMime(clip('', 'recording.mov'))).toBe('video/quicktime')
    expect(videoMime(clip('', 'clip.webm'))).toBe('video/webm')
    expect(videoMime(clip('video/x-matroska', 'a.mkv'))).toBeNull()
    expect(videoMime(clip('image/png', 'a.png'))).toBeNull()
    expect(videoMime(clip('', 'noextension'))).toBeNull()
  })

  it('takes a video of 25 MB or less', () => {
    expect(checkVideoFile(clip())).toEqual({ mime: 'video/mp4' })
    const exact = clip()
    Object.defineProperty(exact, 'size', { value: MAX_VIDEO_BYTES })
    expect(checkVideoFile(exact)).toEqual({ mime: 'video/mp4' })
  })

  it('refuses what is not a video, what is too heavy and what is empty, in the person’s words', () => {
    expect(checkVideoFile(clip('image/png', 'foto.png')).problem).toBe('No pudimos leer «foto.png». Usa un video MP4, MOV o WebM.')
    const heavy = clip()
    Object.defineProperty(heavy, 'size', { value: MAX_VIDEO_BYTES + 1 })
    expect(checkVideoFile(heavy).problem).toMatch(/pesa .* y lo máximo es 25[,.]\d* MB|lo máximo es 26/)
    expect(checkVideoFile(new File([], 'v.mp4', { type: 'video/mp4' })).problem).toMatch(/No pudimos leer/)
  })
})

describe('uploadVideo: straight to Blob, with a token from the API', () => {
  it('asks for a token for a path in the person’s own folder, then uploads with it and answers the medio', async () => {
    stubApi({ '/api/blob-token': tokenOk })
    const progress = vi.fn()
    put.mockImplementation(async (_path, _blob, options) => {
      options.onUploadProgress({ loaded: 5, total: 10, percentage: 49.6 })
      return { url: URL_UP }
    })

    const medio = await uploadVideo({ blob: clip(), mime: 'video/mp4' }, { userId: 'u1', onProgress: progress })

    expect(medio).toEqual({ tipo: 'video', url: URL_UP, mime: 'video/mp4', bytes: 1000 })
    const [url, init] = calls[0]
    expect(url).toBe('/api/blob-token')
    expect(init.headers.Authorization).toBe('Bearer session-token')
    const asked = JSON.parse(init.body)
    expect(asked.type).toBe('blob.generate-client-token')
    expect(asked.payload.pathname).toMatch(/^historias\/u1\/video-[A-Za-z0-9-]+\.mp4$/)
    expect(put).toHaveBeenCalledTimes(1)
    const [pathname, blob, options] = put.mock.calls[0]
    expect(pathname).toBe(asked.payload.pathname)
    expect(blob.size).toBe(1000)
    expect(options).toMatchObject({ access: 'public', token: 'client-token-123', contentType: 'video/mp4', multipart: true })
    expect(progress).toHaveBeenCalledWith(50)
  })

  it('names the file after its real type (an iPhone video is a .mov)', async () => {
    stubApi({ '/api/blob-token': tokenOk })

    await uploadVideo({ blob: clip('video/quicktime', 'IMG.MOV'), mime: 'video/quicktime' }, { userId: 'u1' })

    expect(JSON.parse(calls[0][1].body).payload.pathname).toMatch(/\.mov$/)
  })

  it('says it is not available when this way of running has no such function (404)', async () => {
    stubApi() // /api/blob-token answers 404

    await expect(uploadVideo({ blob: clip(), mime: 'video/mp4' }, { userId: 'u1' })).rejects.toMatchObject({ status: 503, message: VIDEO_MESSAGES.unavailable })
    expect(put).not.toHaveBeenCalled()
  })

  it('lets an expired session through as it is, so the person is asked to sign in again', async () => {
    stubApi({ '/api/blob-token': () => jsonResponse({ detail: 'Tu sesión no es válida o venció. Ingresa de nuevo.' }, 401) })

    await expect(uploadVideo({ blob: clip(), mime: 'video/mp4' }, { userId: 'u1' })).rejects.toMatchObject({ status: 401 })
  })

  it('passes on the reason when the function refuses the file', async () => {
    stubApi({ '/api/blob-token': () => jsonResponse({ detail: 'Solo se pueden subir videos MP4, MOV o WebM.' }, 400) })

    await expect(uploadVideo({ blob: clip(), mime: 'video/mp4' }, { userId: 'u1' })).rejects.toMatchObject({ status: 400, message: 'Solo se pueden subir videos MP4, MOV o WebM.' })
  })

  it('does not touch the network without signal', async () => {
    stubApi({ '/api/blob-token': tokenOk })
    setSimulatedOffline(true)

    await expect(uploadVideo({ blob: clip(), mime: 'video/mp4' }, { userId: 'u1' })).rejects.toBeInstanceOf(OfflineError)
    expect(calls).toHaveLength(0)
  })

  it('turns an upload that broke on the way into "try again later" (a server-type error, never a refusal of the story)', async () => {
    stubApi({ '/api/blob-token': tokenOk })
    put.mockRejectedValue(new Error('Vercel Blob: connection reset'))

    const failure = await uploadVideo({ blob: clip(), mime: 'video/mp4' }, { userId: 'u1' }).catch((error) => error)

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.status).toBe(503)
    expect(failure.message).toBe(VIDEO_MESSAGES.interrupted)
  })

  it('says "no signal" when the connection went away during the upload', async () => {
    stubApi({ '/api/blob-token': tokenOk })
    put.mockImplementation(async () => {
      setSimulatedOffline(true)
      throw new Error('network')
    })

    await expect(uploadVideo({ blob: clip(), mime: 'video/mp4' }, { userId: 'u1' })).rejects.toBeInstanceOf(OfflineError)
  })
})

describe('sendVideo: upload it and add it to the story', () => {
  it('uploads, then tells the API where the video is', async () => {
    stubApi({ '/api/blob-token': tokenOk, '/api/historias/HIS-2026-001/video': attached })
    const onUploaded = vi.fn()

    await sendVideo('HIS-2026-001', { blob: clip(), mime: 'video/mp4' }, { userId: 'u1', onUploaded })

    const attach = calls.find(([url]) => url === '/api/historias/HIS-2026-001/video')
    expect(JSON.parse(attach[1].body)).toEqual({ url: URL_UP, mime: 'video/mp4', bytes: 1000 })
    expect(onUploaded).toHaveBeenCalledWith({ key: 'video' }, { tipo: 'video', url: URL_UP, mime: 'video/mp4', bytes: 1000 })
  })

  it('does not upload twice a video that already went up (only adds it to the story again)', async () => {
    stubApi({ '/api/blob-token': tokenOk, '/api/historias/HIS-2026-001/video': attached })
    const blob = clip()
    const uploaded = new WeakMap([[blob, { tipo: 'video', url: URL_UP, mime: 'video/mp4', bytes: 1000 }]])

    await sendVideo('HIS-2026-001', { blob, mime: 'video/mp4' }, { userId: 'u1', uploaded })

    expect(put).not.toHaveBeenCalled()
    expect(calls.map(([url]) => url)).toEqual(['/api/historias/HIS-2026-001/video'])
  })

  it('remembers the upload when adding it to the story fails, so the retry does not upload again', async () => {
    let attempts = 0
    stubApi({ '/api/blob-token': tokenOk, '/api/historias/HIS-2026-001/video': () => (++attempts === 1 ? jsonResponse({ detail: 'Error' }, 500) : attached()) })
    const uploaded = new WeakMap()
    const video = { blob: clip(), mime: 'video/mp4' }

    await expect(sendVideo('HIS-2026-001', video, { userId: 'u1', uploaded })).rejects.toMatchObject({ status: 500 })
    await sendVideo('HIS-2026-001', video, { userId: 'u1', uploaded })

    expect(put).toHaveBeenCalledTimes(1)
  })
})
