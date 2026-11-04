import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetConnectivityForTests } from '../offline/connectivity.js'
import { buildStoryPayload, sendStory, uploadMedia } from './stories.js'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const draft = (overrides = {}) => ({
  clientId: 'borrador-123456',
  titulo: 'El camino de mulas',
  texto: 'Texto',
  epoca: 'Antes de 1960',
  etiquetas: ['#café'],
  location: { lat: 11.14, lon: -74.118, origen: 'sector', sectorId: 'minca' },
  audio: null,
  fotos: [],
  ...overrides,
})

beforeEach(() => resetConnectivityForTests())
afterEach(() => vi.unstubAllGlobals())

describe('buildStoryPayload', () => {
  it('maps what the person filled in to what the API expects', () => {
    const payload = buildStoryPayload(draft(), [{ tipo: 'audio', url: 'https://x/a.webm', mime: 'audio/webm', bytes: 10, duracion_s: 30 }])

    expect(payload).toEqual({
      client_id: 'borrador-123456',
      titulo: 'El camino de mulas',
      texto: 'Texto',
      epoca: 'Antes de 1960',
      sector_id: 'minca',
      etiquetas: ['#café'],
      ubicacion: { lat: 11.14, lon: -74.118 },
      ubicacion_origen: 'sector',
      medios: [{ tipo: 'audio', url: 'https://x/a.webm', mime: 'audio/webm', bytes: 10, duracion_s: 30 }],
    })
  })

  it('does not send a duration for a photo', () => {
    const payload = buildStoryPayload(draft(), [{ tipo: 'foto', url: 'https://x/f.jpg', mime: 'image/jpeg', bytes: 5, duracion_s: null }])

    expect(payload.medios[0]).not.toHaveProperty('duracion_s')
  })
})

describe('uploadMedia', () => {
  it('sends the file as multipart with its type and duration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ url: 'https://x/a.webm' }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await uploadMedia({ blob: new Blob(['abc'], { type: 'audio/webm' }), tipo: 'audio', name: 'audio.webm', duracion: 95.4 })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/medios')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('tipo')).toBe('audio')
    expect(options.body.get('duracion_s')).toBe('95')
    expect(options.body.get('archivo').name).toBe('audio.webm')
  })
})

describe('sendStory', () => {
  const photo = (n) => ({ id: n, blob: new Blob([`photo-${n}`], { type: 'image/jpeg' }), name: `foto_0${n}.jpg` })

  it('uploads the audio and the photos, then creates the story, reporting progress', async () => {
    const calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        calls.push(url)
        return url === '/api/medios'
          ? jsonResponse({ tipo: 'foto', url: `https://x/${calls.length}.jpg`, mime: 'image/jpeg', bytes: 3, duracion_s: null }, 201)
          : jsonResponse({ codigo: 'HIS-2026-001', estado: 'revision' }, 201)
      }),
    )
    const progress = vi.fn()

    const story = await sendStory(draft({ audio: { blob: new Blob(['a']), seconds: 30 }, fotos: [photo(1), photo(2)] }), { onProgress: progress })

    expect(story.codigo).toBe('HIS-2026-001')
    expect(calls).toEqual(['/api/medios', '/api/medios', '/api/medios', '/api/historias'])
    expect(progress.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('does not upload a file twice when the person retries after a failure', async () => {
    const uploads = []
    let failStory = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url === '/api/medios') {
          uploads.push(url)
          return jsonResponse({ tipo: 'foto', url: `https://x/${uploads.length}.jpg`, mime: 'image/jpeg', bytes: 3 }, 201)
        }
        if (failStory) {
          failStory = false
          return jsonResponse({ detail: 'Error' }, 500)
        }
        return jsonResponse({ codigo: 'HIS-2026-001', estado: 'revision' }, 201)
      }),
    )
    const uploaded = new WeakMap()
    const sameDraft = draft({ fotos: [photo(1)] })

    await expect(sendStory(sameDraft, { uploaded })).rejects.toThrow()
    await expect(sendStory(sameDraft, { uploaded })).resolves.toMatchObject({ codigo: 'HIS-2026-001' })

    expect(uploads).toHaveLength(1) // the photo went up once
  })

  it('stops at the first failed upload and does not create the story', async () => {
    const calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        calls.push(url)
        return jsonResponse({ detail: 'No pudimos guardar el archivo.' }, 503)
      }),
    )

    await expect(sendStory(draft({ fotos: [photo(1), photo(2)] }))).rejects.toThrow('No pudimos guardar el archivo.')

    expect(calls).toEqual(['/api/medios'])
  })
})
