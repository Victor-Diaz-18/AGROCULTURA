import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  breakStoreForTests,
  cacheDelete,
  cacheGet,
  cacheSet,
  clearWorkingDraft,
  deviceStorage,
  getQueued,
  listQueued,
  loadWorkingDraft,
  queueStory,
  removeQueued,
  resetStoreForTests,
  saveWorkingDraft,
  updateQueued,
} from './store.js'

const draft = (overrides = {}) => ({
  clientId: 'draft-0001',
  step: 2,
  texto: 'Mi abuelo sembró el primer cafetal.',
  titulo: 'El primer cafetal',
  location: { lat: 11.14, lon: -74.118, origen: 'sector', sectorId: 'minca' },
  lugar: '',
  epoca: 'Antes de 1960',
  etiquetas: ['#café'],
  audio: { blob: new Blob(['voz'], { type: 'audio/webm' }), seconds: 12, mime: 'audio/webm' },
  fotos: [{ id: 'f1', name: 'foto_01.jpg', blob: new Blob(['foto-uno'], { type: 'image/jpeg' }) }],
  photoNumber: 2,
  ...overrides,
})

const queued = (overrides = {}) => ({
  ...draft(),
  narratorId: 'u1',
  guardadoEn: '2026-11-04T10:00:00.000Z',
  formatos: ['Audio', 'Foto'],
  subidos: {},
  fallo: null,
  ...overrides,
})

const textOf = (blob) => blob.text()

beforeEach(async () => {
  await resetStoreForTests()
})

describe('the story being told', () => {
  it('comes back as it was left, files included', async () => {
    await saveWorkingDraft('u1', draft())

    const back = await loadWorkingDraft('u1')

    expect(back).toMatchObject({ clientId: 'draft-0001', step: 2, titulo: 'El primer cafetal', photoNumber: 2 })
    expect(back.location).toEqual({ lat: 11.14, lon: -74.118, origen: 'sector', sectorId: 'minca' })
    expect(back.audio).toMatchObject({ seconds: 12, mime: 'audio/webm' })
    expect(back.audio.blob.type).toBe('audio/webm')
    expect(await textOf(back.audio.blob)).toBe('voz')
    expect(back.fotos).toHaveLength(1)
    expect(back.fotos[0]).toMatchObject({ id: 'f1', name: 'foto_01.jpg' })
    expect(await textOf(back.fotos[0].blob)).toBe('foto-uno')
  })

  it('has no audio when there is none', async () => {
    await saveWorkingDraft('u1', draft({ audio: null, fotos: [] }))

    const back = await loadWorkingDraft('u1')

    expect(back.audio).toBeNull()
    expect(back.fotos).toEqual([])
  })

  it('is one per narrator and saving again replaces it', async () => {
    await saveWorkingDraft('u1', draft({ titulo: 'Primero' }))
    await saveWorkingDraft('u1', draft({ titulo: 'Segundo' }))
    await saveWorkingDraft('u2', draft({ titulo: 'De otra persona' }))

    expect((await loadWorkingDraft('u1')).titulo).toBe('Segundo')
    expect((await loadWorkingDraft('u2')).titulo).toBe('De otra persona')
    expect(await loadWorkingDraft('u3')).toBeNull()
  })

  it('can be cleared', async () => {
    await saveWorkingDraft('u1', draft())

    await clearWorkingDraft('u1')

    expect(await loadWorkingDraft('u1')).toBeNull()
  })
})

describe('the video of a story (F13)', () => {
  const video = () => ({ id: 'v1', name: 'video_01.mp4', mime: 'video/mp4', blob: new Blob(['clip-bytes'], { type: 'video/mp4' }) })

  it('comes back with the story being told, with its type and bytes', async () => {
    await saveWorkingDraft('u1', draft({ video: video() }))

    const back = await loadWorkingDraft('u1')

    expect(back.video).toMatchObject({ id: 'v1', name: 'video_01.mp4', mime: 'video/mp4' })
    expect(back.video.blob.type).toBe('video/mp4')
    expect(await textOf(back.video.blob)).toBe('clip-bytes')
  })

  it('is let go of when the person takes it out, and with the draft when it is cleared', async () => {
    await saveWorkingDraft('u1', draft({ video: video() }))
    await saveWorkingDraft('u1', draft({ video: null }))
    expect((await loadWorkingDraft('u1')).video).toBeNull()

    await saveWorkingDraft('u1', draft({ video: video() }))
    await clearWorkingDraft('u1')
    expect(await loadWorkingDraft('u1')).toBeNull()
    await saveWorkingDraft('u1', draft())
    expect((await loadWorkingDraft('u1')).video).toBeNull() // nothing of the old video stayed behind
  })

  it('is written when it changes, not at every save of the text (it can weigh 25 MB)', async () => {
    const clip = video()
    const writes = vi.spyOn(Blob.prototype, 'arrayBuffer')
    await saveWorkingDraft('u1', draft({ video: clip, texto: 'a' }))
    await saveWorkingDraft('u1', draft({ video: clip, texto: 'ab' }))
    await saveWorkingDraft('u1', draft({ video: clip, texto: 'abc' }))

    expect((await loadWorkingDraft('u1')).texto).toBe('abc')
    // the clip's bytes were read once, however many times the draft was saved
    expect(writes.mock.contexts.filter((blob) => blob === clip.blob)).toHaveLength(1)
    writes.mockRestore()
  })

  it('goes with a story kept for the signal, and the list says it has one without carrying it', async () => {
    await queueStory(queued({ video: video() }))

    const [summary] = await listQueued('u1')
    const whole = await getQueued('draft-0001')

    expect(summary).toMatchObject({ tieneVideo: true })
    expect(summary.video).toBeUndefined()
    expect(await textOf(whole.video.blob)).toBe('clip-bytes')
  })

  it('a story kept before there were videos still opens (no video)', async () => {
    await queueStory(queued())

    expect((await getQueued('draft-0001')).video).toBeNull()
  })
})

describe('stories waiting for the signal', () => {
  it('lists the ones of one narrator, oldest first, without their files', async () => {
    await queueStory(queued({ clientId: 'second-02', titulo: 'Segunda', guardadoEn: '2026-11-04T11:00:00.000Z' }))
    await queueStory(queued({ clientId: 'first-001', titulo: 'Primera' }))
    await queueStory(queued({ clientId: 'other-001', narratorId: 'u2', titulo: 'De otra persona' }))

    const mine = await listQueued('u1')

    expect(mine.map((item) => item.titulo)).toEqual(['Primera', 'Segunda'])
    expect(mine[0]).toMatchObject({ tieneAudio: true, cantidadFotos: 1, formatos: ['Audio', 'Foto'] })
    expect(mine[0].audio).toBeUndefined()
    expect(mine[0].fotos).toBeUndefined()
  })

  it('gives one story back whole, ready to send', async () => {
    await queueStory(queued())

    const item = await getQueued('draft-0001')

    expect(item.titulo).toBe('El primer cafetal')
    expect(await textOf(item.audio.blob)).toBe('voz')
    expect(await textOf(item.fotos[0].blob)).toBe('foto-uno')
  })

  it('keeps notes about it without touching its files', async () => {
    await queueStory(queued())

    await updateQueued('draft-0001', { fallo: 'El audio pesa demasiado.', subidos: { audio: { url: 'https://x' } } })

    const item = await getQueued('draft-0001')
    expect(item).toMatchObject({ fallo: 'El audio pesa demasiado.', subidos: { audio: { url: 'https://x' } } })
    expect(await textOf(item.audio.blob)).toBe('voz')
  })

  it('ignores a note for a story that is already gone', async () => {
    await updateQueued('nothing-00', { fallo: 'x' })

    expect(await getQueued('nothing-00')).toBeNull()
  })

  it('forgets a story once it is sent', async () => {
    await queueStory(queued())

    await removeQueued('draft-0001')

    expect(await listQueued('u1')).toEqual([])
    expect(await getQueued('draft-0001')).toBeNull()
  })
})

describe('the last answers of the server', () => {
  it('keeps what it is given and forgets it on request', async () => {
    await cacheSet('portal', { config: { portal: { nombre: 'X' } } })

    expect(await cacheGet('portal')).toEqual({ config: { portal: { nombre: 'X' } } })

    await cacheDelete('portal')

    expect(await cacheGet('portal')).toBeNull()
  })

  it('answers null for what it never saw', async () => {
    expect(await cacheGet('nunca')).toBeNull()
  })
})

describe('a phone where IndexedDB does not work', () => {
  it('says it is not durable but still holds everything while the page is open', async () => {
    breakStoreForTests()

    expect(await deviceStorage()).toBe(false)
    await saveWorkingDraft('u1', draft())
    await queueStory(queued())
    await cacheSet('portal', { a: 1 })

    expect((await loadWorkingDraft('u1')).titulo).toBe('El primer cafetal')
    expect(await listQueued('u1')).toHaveLength(1)
    expect(await textOf((await getQueued('draft-0001')).audio.blob)).toBe('voz')
    expect(await cacheGet('portal')).toEqual({ a: 1 })
  })

  it('says it is durable when the database opens', async () => {
    expect(await deviceStorage()).toBe(true)
  })
})
