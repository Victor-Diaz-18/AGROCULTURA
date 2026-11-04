import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetConnectivityForTests } from '../offline/connectivity.js'
import { approveStory, fetchAdminStories, publishProjectStory, rejectStory, removeTag, resetDemoData } from './admin.js'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock
beforeEach(() => {
  resetConnectivityForTests()
  fetchMock = vi.fn(async () => jsonResponse({}))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const lastCall = () => fetchMock.mock.calls.at(-1)

describe('admin services', () => {
  it('asks for a state and an origin, and leaves out what was not given', async () => {
    await fetchAdminStories({ estado: 'publicada', origen: 'comunidad', limite: 100 })
    expect(lastCall()[0]).toBe('/api/admin/historias?estado=publicada&origen=comunidad&limite=100')

    await fetchAdminStories({ estado: 'revision' })
    expect(lastCall()[0]).toBe('/api/admin/historias?estado=revision')

    await fetchAdminStories()
    expect(lastCall()[0]).toBe('/api/admin/historias')
  })

  it('approves with the checks that were marked', async () => {
    await approveStory('HIS-2026-008', ['tema', 'territorio', 'datos'])

    const [url, init] = lastCall()
    expect(url).toBe('/api/admin/historias/HIS-2026-008/aprobar')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ confirmaciones: ['tema', 'territorio', 'datos'] })
  })

  it('rejects with the id of the reason', async () => {
    await rejectStory('HIS-2026-008', 'fuera-del-tema')

    const [url, init] = lastCall()
    expect(url).toBe('/api/admin/historias/HIS-2026-008/rechazar')
    expect(JSON.parse(init.body)).toEqual({ motivo: 'fuera-del-tema' })
  })

  it('writes the "#" of a tag so the address stays valid', async () => {
    await removeTag('#café')

    expect(lastCall()[0]).toBe('/api/admin/etiquetas?nombre=%23caf%C3%A9')
    expect(lastCall()[1].method).toBe('DELETE')
  })

  it('confirms the reset in the body: asking is not enough', async () => {
    await resetDemoData()

    expect(JSON.parse(lastCall()[1].body)).toEqual({ confirmar: true })
  })
})

describe('publishProjectStory', () => {
  const draft = (overrides = {}) => ({
    clientId: 'proyecto-0000001',
    titulo: 'El patio',
    texto: 'Texto',
    epoca: '1960 a 1979',
    sectorId: 'tijereras',
    etiquetas: ['#finca'],
    narrador: '',
    audio: { blob: new Blob(['a']), name: 'voz.mp3', seconds: null },
    fotos: [{ id: 'p1', name: 'foto_01.jpg', blob: new Blob(['p']) }],
    ...overrides,
  })
  const answer = (init, url) => {
    if (url === '/api/medios') {
      return init.body.get('tipo') === 'audio'
        ? jsonResponse({ tipo: 'audio', url: 'https://s/a.mp3', mime: 'audio/mpeg', bytes: 1 })
        : jsonResponse({ tipo: 'foto', url: 'https://s/p.jpg', mime: 'image/jpeg', bytes: 1 })
    }
    return jsonResponse({ codigo: 'HIS-2026-013' }, 201)
  }

  it('uploads each file and then creates the story with their addresses', async () => {
    fetchMock.mockImplementation(async (url, init) => answer(init, url))

    await publishProjectStory(draft())

    const urls = fetchMock.mock.calls.map(([url]) => url)
    expect(urls).toEqual(['/api/medios', '/api/medios', '/api/admin/historias-proyecto'])
    const body = JSON.parse(lastCall()[1].body)
    expect(body).toMatchObject({ client_id: 'proyecto-0000001', sector_id: 'tijereras', titulo: 'El patio' })
    expect(body.medios.map((medio) => medio.url)).toEqual(['https://s/a.mp3', 'https://s/p.jpg'])
    expect(body.medios[0]).not.toHaveProperty('duracion_s') // unknown length: not sent
  })

  it('does not name who tells it when the field is empty (the server writes the team)', async () => {
    fetchMock.mockImplementation(async (url, init) => answer(init, url))

    await publishProjectStory(draft({ narrador: '' }))

    expect(JSON.parse(lastCall()[1].body)).not.toHaveProperty('narrador_nombre')
  })

  it('a retry after a failure uploads nothing twice', async () => {
    let creates = 0
    fetchMock.mockImplementation(async (url, init) => (url === '/api/admin/historias-proyecto' && ++creates === 1 ? jsonResponse({ detail: 'x' }, 500) : answer(init, url)))
    const uploaded = new WeakMap()
    const same = draft()

    await expect(publishProjectStory(same, { uploaded })).rejects.toThrow()
    await publishProjectStory(same, { uploaded })

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/medios')).toHaveLength(2) // once each, not four
  })
})
