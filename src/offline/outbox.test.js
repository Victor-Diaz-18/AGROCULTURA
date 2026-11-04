import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, OfflineError } from '../services/http.js'
import { MAX_VIDEO_ATTEMPTS, STOPPED, flushQueue } from './outbox.js'
import { getQueued, listQueued, queueStory, resetStoreForTests } from './store.js'

const item = (overrides = {}) => ({
  clientId: 'story-0001',
  narratorId: 'u1',
  guardadoEn: '2026-11-04T10:00:00.000Z',
  titulo: 'El camino de mulas',
  texto: 'Antes de que hubiera carretera.',
  epoca: 'Antes de 1960',
  location: { lat: 11.14, lon: -74.118, origen: 'sector', sectorId: 'minca' },
  lugar: '',
  etiquetas: ['#café'],
  formatos: ['Texto'],
  audio: null,
  fotos: [],
  subidos: {},
  fallo: null,
  ...overrides,
})

const withMedia = (overrides = {}) =>
  item({
    audio: { blob: new Blob(['voz'], { type: 'audio/webm' }), seconds: 5, mime: 'audio/webm' },
    fotos: [{ id: 'f1', name: 'foto_01.jpg', blob: new Blob(['foto'], { type: 'image/jpeg' }) }],
    ...overrides,
  })

const AUDIO = { tipo: 'audio', url: 'https://s.public.blob.vercel-storage.com/historias/u1/a.webm', mime: 'audio/webm', bytes: 3 }
const PHOTO = { tipo: 'foto', url: 'https://s.public.blob.vercel-storage.com/historias/u1/f.jpg', mime: 'image/jpeg', bytes: 4 }

beforeEach(async () => {
  await resetStoreForTests()
})

describe('sending the waiting stories', () => {
  it('sends each one, oldest first, and forgets the ones that went', async () => {
    await queueStory(item({ clientId: 'second-02', titulo: 'Segunda', guardadoEn: '2026-11-04T11:00:00.000Z' }))
    await queueStory(item({ clientId: 'first-001', titulo: 'Primera' }))
    const send = vi.fn().mockResolvedValue({})

    const result = await flushQueue('u1', { send })

    expect(send.mock.calls.map(([story]) => story.clientId)).toEqual(['first-001', 'second-02'])
    expect(result.sent.map((story) => story.titulo)).toEqual(['Primera', 'Segunda'])
    expect(result).toMatchObject({ failed: [], stopped: null })
    expect(await listQueued('u1')).toEqual([])
  })

  it('never touches the stories of another narrator', async () => {
    await queueStory(item({ clientId: 'other-001', narratorId: 'u2' }))
    const send = vi.fn()

    const result = await flushQueue('u1', { send })

    expect(send).not.toHaveBeenCalled()
    expect(result.sent).toEqual([])
    expect(await listQueued('u2')).toHaveLength(1)
  })

  it('hands over the files that were saved with the story', async () => {
    await queueStory(withMedia())
    const send = vi.fn().mockResolvedValue({})

    await flushQueue('u1', { send })

    const [story] = send.mock.calls[0]
    expect(await story.audio.blob.text()).toBe('voz')
    expect(await story.fotos[0].blob.text()).toBe('foto')
  })

  it('does not upload again what already went up in an earlier attempt', async () => {
    await queueStory(withMedia({ subidos: { audio: AUDIO } }))
    const send = vi.fn().mockResolvedValue({})

    await flushQueue('u1', { send })

    const [story, { uploaded }] = send.mock.calls[0]
    expect(uploaded.get(story.audio.blob)).toEqual(AUDIO) // the audio is known
    expect(uploaded.get(story.fotos[0].blob)).toBeUndefined() // the photo is not
  })

  it('remembers each file as it goes up, so a later failure does not repeat the upload', async () => {
    await queueStory(withMedia())
    const send = vi.fn(async (story, { onUploaded }) => {
      await onUploaded({ key: 'audio' }, AUDIO)
      await onUploaded({ key: 'f1' }, PHOTO)
      throw new OfflineError()
    })

    await flushQueue('u1', { send })

    expect((await getQueued('story-0001')).subidos).toEqual({ audio: AUDIO, f1: PHOTO })
  })

  it('uses the same id every time, so the server never makes a copy', async () => {
    await queueStory(item())
    const send = vi.fn().mockRejectedValueOnce(new OfflineError()).mockResolvedValue({})

    await flushQueue('u1', { send })
    await flushQueue('u1', { send })

    expect(send.mock.calls.map(([story]) => story.clientId)).toEqual(['story-0001', 'story-0001'])
    expect(await listQueued('u1')).toEqual([])
  })
})

describe('when something goes wrong', () => {
  it('stops at the first sign that the signal is gone and keeps everything', async () => {
    await queueStory(item({ clientId: 'first-001' }))
    await queueStory(item({ clientId: 'second-02', guardadoEn: '2026-11-04T11:00:00.000Z' }))
    const send = vi.fn().mockRejectedValue(new OfflineError())

    const result = await flushQueue('u1', { send })

    expect(send).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ sent: [], failed: [], stopped: STOPPED.offline })
    expect(await listQueued('u1')).toHaveLength(2)
  })

  it('stops when the session expired', async () => {
    await queueStory(item())
    const send = vi.fn().mockRejectedValue(new ApiError(401, 'Tu sesión venció.'))

    const result = await flushQueue('u1', { send })

    expect(result.stopped).toBe(STOPPED.auth)
    expect(await listQueued('u1')).toHaveLength(1)
  })

  it.each([500, 503, 408, 429])('stops when the server answers %s, since trying later may work', async (status) => {
    await queueStory(item())
    const send = vi.fn().mockRejectedValue(new ApiError(status, 'Error'))

    const result = await flushQueue('u1', { send })

    expect(result.stopped).toBe(STOPPED.server)
    expect(await listQueued('u1')).toHaveLength(1)
    expect((await listQueued('u1'))[0].fallo).toBeNull()
  })

  it('a story the server refuses keeps the reason, does not hold back the next one and is not retried by itself', async () => {
    await queueStory(item({ clientId: 'bad-00001' }))
    await queueStory(item({ clientId: 'good-0001', guardadoEn: '2026-11-04T11:00:00.000Z' }))
    const send = vi.fn(async (story) => {
      if (story.clientId === 'bad-00001') throw new ApiError(413, 'El audio pesa demasiado.')
      return {}
    })

    const first = await flushQueue('u1', { send })

    expect(first.sent.map((story) => story.clientId)).toEqual(['good-0001'])
    expect(first.failed).toMatchObject([{ clientId: 'bad-00001', fallo: 'El audio pesa demasiado.' }])
    expect(first.stopped).toBeNull()
    expect((await listQueued('u1'))[0]).toMatchObject({ clientId: 'bad-00001', fallo: 'El audio pesa demasiado.' })

    send.mockClear()
    const second = await flushQueue('u1', { send })

    expect(send).not.toHaveBeenCalled()
    expect(second).toMatchObject({ sent: [], failed: [], stopped: null })
  })

  it('an unexpected error also keeps the story, with a plain reason', async () => {
    await queueStory(item())
    const send = vi.fn().mockRejectedValue(new TypeError('boom'))

    const result = await flushQueue('u1', { send })

    expect(result.failed[0].fallo).toBe('No pudimos enviar esta historia.')
    expect(await listQueued('u1')).toHaveLength(1)
  })
})

describe('the video that goes after the story (F13)', () => {
  const VIDEO_MEDIO = { tipo: 'video', url: 'https://s.public.blob.vercel-storage.com/historias/u1/v.mp4', mime: 'video/mp4', bytes: 4 }
  const withVideo = (overrides = {}) => item({ video: { id: 'v1', name: 'video_01.mp4', mime: 'video/mp4', blob: new Blob(['clip'], { type: 'video/mp4' }) }, formatos: ['Video'], ...overrides })
  const story = vi.fn()
  const sendVideoFile = vi.fn()

  beforeEach(() => {
    story.mockReset().mockResolvedValue({ codigo: 'HIS-2026-001' })
    sendVideoFile.mockReset().mockResolvedValue({})
  })
  const flush = (options) => flushQueue('u1', { send: story, sendVideoFile, ...options })

  it('sends the story first and then its video, to the story the server just made', async () => {
    await queueStory(withVideo())

    const result = await flush()

    expect(story).toHaveBeenCalledTimes(1)
    expect(sendVideoFile).toHaveBeenCalledTimes(1)
    const [codigo, video, options] = sendVideoFile.mock.calls[0]
    expect(codigo).toBe('HIS-2026-001')
    expect(await video.blob.text()).toBe('clip')
    expect(options.userId).toBe('u1')
    expect(result).toMatchObject({ failed: [], stopped: null })
    expect(result.sent).toHaveLength(1)
    expect(result.videos).toHaveLength(1)
    expect(await listQueued('u1')).toEqual([])
  })

  it('a story without video never touches the video code', async () => {
    await queueStory(item())

    const result = await flush()

    expect(sendVideoFile).not.toHaveBeenCalled()
    expect(result.videos).toEqual([])
  })

  it('if the signal goes after the story, the story is in and only the video is left (it is not sent again)', async () => {
    await queueStory(withVideo({ audio: { blob: new Blob(['voz'], { type: 'audio/webm' }), seconds: 5, mime: 'audio/webm' }, texto: 'Un texto largo.' }))
    sendVideoFile.mockRejectedValueOnce(new OfflineError())

    const first = await flush()

    expect(first.sent).toHaveLength(1) // the story reached the server
    expect(first.videos).toEqual([])
    expect(first.stopped).toBe(STOPPED.offline)
    const [left] = await listQueued('u1')
    expect(left).toMatchObject({ fase: 'video', codigo: 'HIS-2026-001', tieneVideo: true, tieneAudio: false, cantidadFotos: 0, texto: '' }) // the rest of the story was let go

    const second = await flush()

    expect(story).toHaveBeenCalledTimes(1) // no second story
    expect(sendVideoFile).toHaveBeenCalledTimes(2)
    expect(sendVideoFile.mock.calls[1][0]).toBe('HIS-2026-001')
    expect(second.sent).toEqual([])
    expect(second.videos).toHaveLength(1)
    expect(await listQueued('u1')).toEqual([])
  })

  it('a video-only item (the story went up online) is just sent', async () => {
    await queueStory(item({ fase: 'video', codigo: 'HIS-2026-007', ...withVideo(), clientId: 'story-0001' }))

    const result = await flush()

    expect(story).not.toHaveBeenCalled()
    expect(sendVideoFile.mock.calls[0][0]).toBe('HIS-2026-007')
    expect(result).toMatchObject({ sent: [], failed: [], stopped: null })
    expect(result.videos).toHaveLength(1)
  })

  it('does not upload again a video that went up and only failed to be added to the story', async () => {
    await queueStory(withVideo({ fase: 'video', codigo: 'HIS-2026-007', subidos: { video: VIDEO_MEDIO } }))

    await flush()

    const [, video, options] = sendVideoFile.mock.calls[0]
    expect(options.uploaded.get(video.blob)).toEqual(VIDEO_MEDIO)
  })

  it('remembers the upload as it happens', async () => {
    await queueStory(withVideo({ fase: 'video', codigo: 'HIS-2026-007' }))
    sendVideoFile.mockImplementation(async (_code, _video, options) => {
      await options.onUploaded({ key: 'video' }, VIDEO_MEDIO)
      throw new OfflineError()
    })

    await flush()

    expect((await getQueued('story-0001')).subidos).toEqual({ video: VIDEO_MEDIO })
  })

  it('tells how the video is going up', async () => {
    await queueStory(withVideo({ fase: 'video', codigo: 'HIS-2026-007' }))
    sendVideoFile.mockImplementation(async (_code, _video, options) => options.onProgress(40))
    const onVideoProgress = vi.fn()

    await flush({ onVideoProgress })

    expect(onVideoProgress).toHaveBeenCalledWith('story-0001', 40)
  })

  it('a server in trouble stops the round and counts the attempt; after five the video waits for the person', async () => {
    await queueStory(withVideo({ fase: 'video', codigo: 'HIS-2026-007' }))
    sendVideoFile.mockRejectedValue(new ApiError(503, 'No pudimos subir el video. Se intentará de nuevo.'))

    for (let attempt = 1; attempt < MAX_VIDEO_ATTEMPTS; attempt++) {
      const result = await flush()
      expect(result.stopped).toBe(STOPPED.server)
      expect((await listQueued('u1'))[0]).toMatchObject({ intentos: attempt, fallo: null })
    }
    const last = await flush()

    expect(last.stopped).toBeNull()
    expect(last.failed).toMatchObject([{ fase: 'video', fallo: 'No pudimos subir el video. Revisa tu conexión y toca «Reintentar».' }])
    expect((await listQueued('u1'))[0].fallo).toMatch(/Reintentar/)

    sendVideoFile.mockClear()
    await flush()
    expect(sendVideoFile).not.toHaveBeenCalled() // not retried by itself any more
  })

  it('the server refusing the video for good keeps its reason and lets the next one go', async () => {
    await queueStory(withVideo({ fase: 'video', codigo: 'HIS-2026-007', clientId: 'story-bad1' }))
    await queueStory(withVideo({ fase: 'video', codigo: 'HIS-2026-008', clientId: 'story-good', guardadoEn: '2026-11-04T11:00:00.000Z' }))
    sendVideoFile.mockImplementation(async (codigo) => {
      if (codigo === 'HIS-2026-007') throw new ApiError(409, 'Esta historia ya fue revisada: ya no se le puede agregar un video.')
      return {}
    })

    const result = await flush()

    expect(result.videos.map((video) => video.clientId)).toEqual(['story-good'])
    expect(result.failed).toMatchObject([{ clientId: 'story-bad1', fase: 'video', fallo: 'Esta historia ya fue revisada: ya no se le puede agregar un video.' }])
    expect((await listQueued('u1')).map((left) => left.clientId)).toEqual(['story-bad1'])
  })

  it('an expired session stops the round with the video kept', async () => {
    await queueStory(withVideo({ fase: 'video', codigo: 'HIS-2026-007' }))
    sendVideoFile.mockRejectedValue(new ApiError(401, 'Tu sesión venció.'))

    const result = await flush()

    expect(result.stopped).toBe(STOPPED.auth)
    expect(await listQueued('u1')).toHaveLength(1)
  })
})
