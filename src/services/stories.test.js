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
  it('maps what the person filled in to what the API expects (the point, not the sector: the server finds it)', () => {
    const payload = buildStoryPayload(draft(), [{ tipo: 'audio', url: 'https://x/a.webm', mime: 'audio/webm', bytes: 10, duracion_s: 30 }])

    expect(payload).toEqual({
      client_id: 'borrador-123456',
      titulo: 'El camino de mulas',
      texto: 'Texto',
      epoca: 'Antes de 1960',
      etiquetas: ['#café'],
      ubicacion_modo: 'aproximada',
      ubicacion: { lat: 11.14, lon: -74.118 },
      ubicacion_origen: 'sector',
      anonima: false,
      medios: [{ tipo: 'audio', url: 'https://x/a.webm', mime: 'audio/webm', bytes: 10, duracion_s: 30 }],
    })
  })

  describe('where, whose name and the authorization', () => {
    const accepted = { version: '2026-11-1', variante: 'aproximada_con_nombre', aceptadoEn: '2026-11-04T10:00:00.000Z' }

    it('sends no point at all when the story has no place on the map, only the reference name', () => {
      const payload = buildStoryPayload(draft({ ubicacionModo: 'ninguna', lugar: 'Finca Los Mangos' }), [])

      expect(payload.ubicacion_modo).toBe('ninguna')
      expect(payload).not.toHaveProperty('ubicacion')
      expect(payload).not.toHaveProperty('ubicacion_origen')
      expect(payload.lugar_nombre).toBe('Finca Los Mangos')
      expect(JSON.stringify(payload)).not.toContain('11.14') // not even a point left in the form
    })

    it('sends no point for a story without a place even if the draft has none chosen', () => {
      expect(() => buildStoryPayload(draft({ ubicacionModo: 'ninguna', location: null }), [])).not.toThrow()
    })

    it('a draft kept before this option existed still sends its point', () => {
      const payload = buildStoryPayload(draft(), [])

      expect(payload.ubicacion_modo).toBe('aproximada')
      expect(payload.ubicacion).toEqual({ lat: 11.14, lon: -74.118 })
    })

    it('sends "publicar sin mi nombre" as a choice, never the name', () => {
      expect(buildStoryPayload(draft({ anonima: true }), []).anonima).toBe(true)
      expect(buildStoryPayload(draft(), []).anonima).toBe(false)
    })

    it('sends the name of the farm only when there is one', () => {
      expect(buildStoryPayload(draft({ finca: 'Café Don Aurelio' }), []).finca_nombre).toBe('Café Don Aurelio')
      expect(buildStoryPayload(draft({ finca: '' }), [])).not.toHaveProperty('finca_nombre')
    })

    it('sends the consent with the version of the text and the moment it was ticked', () => {
      expect(buildStoryPayload(draft({ consentimiento: accepted }), []).consentimiento).toEqual({
        aceptado: true,
        version: '2026-11-1',
        aceptado_en: '2026-11-04T10:00:00.000Z',
      })
      expect(buildStoryPayload(draft(), [])).not.toHaveProperty('consentimiento')
    })
  })

  it('sends the name of the place only when there is one', () => {
    expect(buildStoryPayload(draft({ lugar: 'Finca La Esperanza' }), []).lugar_nombre).toBe('Finca La Esperanza')
    expect(buildStoryPayload(draft({ lugar: '' }), [])).not.toHaveProperty('lugar_nombre')
    expect(buildStoryPayload(draft(), [])).not.toHaveProperty('lugar_nombre')
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

  it('tells which file just went up (so a story kept on the phone can remember it), and only the ones that really did', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url === '/api/medios'
          ? jsonResponse({ tipo: 'foto', url: 'https://x/new.jpg', mime: 'image/jpeg', bytes: 3 }, 201)
          : jsonResponse({ codigo: 'HIS-2026-001', estado: 'revision' }, 201),
      ),
    )
    const known = photo(1)
    const fresh = photo(2)
    const uploaded = new WeakMap([[known.blob, { tipo: 'foto', url: 'https://x/old.jpg', mime: 'image/jpeg', bytes: 3 }]])
    const onUploaded = vi.fn()

    await sendStory(draft({ audio: { blob: new Blob(['a']), seconds: 30 }, fotos: [known, fresh] }), { uploaded, onUploaded })

    expect(onUploaded.mock.calls.map(([file]) => file.key)).toEqual(['audio', 2]) // the known photo was not uploaded again
    expect(onUploaded.mock.calls[1][1].url).toBe('https://x/new.jpg')
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
