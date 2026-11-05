import { describe, expect, it } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import { setRetryDelayForTests } from './OutboxContext.jsx'
import { setSimulatedOffline, toggleSimulatedOffline } from '../offline/connectivity.js'
import { listQueued, queueStory } from '../offline/store.js'
import { NARRATOR } from '../test/auth.js'
import { queuedDraft } from '../test/fixtures.js'
import { callsTo, renderApp, reply } from '../test/renderApp.jsx'

const created = (init) => {
  const body = JSON.parse(init.body)
  return { codigo: 'HIS-2026-030', titulo: body.titulo, estado: 'revision', enviada_en: '2026-11-04T10:00:00Z' }
}

/** The narrator is in "Mis historias" with stories waiting on the phone. */
async function openWith(drafts, api = {}) {
  for (const draft of drafts) await queueStory(draft)
  return renderApp({ route: '/mis-historias', user: NARRATOR, api: { '/historias': created, '/historias/mias': [], ...api } })
}

const opened = () => screen.findByRole('heading', { name: 'Mis historias' })

describe('stories waiting on the phone (F10)', () => {
  it('are sent when the app opens with signal, and the person is told', async () => {
    const { fetchMock } = await openWith([queuedDraft()])

    expect(await screen.findByText('Se envió 1 borrador a revisión.')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(1)
    expect(await listQueued(NARRATOR.id)).toEqual([])
  })

  it('wait for the signal, and go out together when it returns', async () => {
    setSimulatedOffline(true)
    const { fetchMock } = await openWith([queuedDraft(), queuedDraft({ clientId: 'queued-0002', titulo: 'La trilla', guardadoEn: '2026-11-04T11:00:00.000Z' })])
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalledWith('/api/historias', expect.anything()))
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0)

    act(() => toggleSimulatedOffline())

    expect(await screen.findByText('Volvió la señal: se enviaron 2 borradores a revisión.')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias').map(([, init]) => JSON.parse(init.body).titulo)).toEqual(['El camino de mulas', 'La trilla'])
  })

  it('never send what belongs to another narrator', async () => {
    const { fetchMock } = await openWith([queuedDraft({ narratorId: 'u2' })])

    await opened()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0)
    expect(await listQueued('u2')).toHaveLength(1)
  })

  it('are sent only by their narrator, so a visitor sends nothing', async () => {
    await queueStory(queuedDraft())
    const { fetchMock } = renderApp({ route: '/', api: { '/historias': [] } })

    await screen.findByRole('heading', { name: 'Mapa de historias' })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(callsTo(fetchMock, '/historias').filter(([, init]) => init.method === 'POST')).toHaveLength(0)
    expect(await listQueued(NARRATOR.id)).toHaveLength(1)
  })

  it('stay on the phone when the session expired, and the person is told to sign in again', async () => {
    await openWith([queuedDraft()], { '/historias': () => reply({ detail: 'Tu sesión venció.' }, 401) })

    expect(await screen.findByText('Tu sesión venció. Ingresa de nuevo y se enviarán tus borradores.')).toBeInTheDocument()
    expect(await listQueued(NARRATOR.id)).toHaveLength(1)
  })

  it('try again by themselves a little later when the server is having trouble', async () => {
    setRetryDelayForTests(40)
    let attempts = 0
    const { fetchMock } = await openWith([queuedDraft()], {
      '/historias': (init) => (++attempts === 1 ? reply({ detail: 'Error' }, 503) : created(init)),
    })

    expect(await screen.findByText('Se envió 1 borrador a revisión.')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(2)
    const [first, second] = callsTo(fetchMock, '/historias').map(([, init]) => JSON.parse(init.body).client_id)
    expect(second).toBe(first)
  })

  it('stop working when the app is closed in the middle of a send: nothing is asked of the server for a page that is gone', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const { fetchMock, unmount } = await openWith([queuedDraft()], {
      '/historias': async (init) => {
        await gate
        return created(init)
      },
    })
    await waitFor(() => expect(callsTo(fetchMock, '/historias')).toHaveLength(1)) // the story is on its way
    const before = fetchMock.mock.calls.length

    unmount()
    release()
    await new Promise((resolve) => setTimeout(resolve, 80))

    // It used to carry on: update the screen, tell the person and reload the public counters, after the page was gone
    // (and in a test run, after the environment was too: "window is not defined").
    expect(fetchMock.mock.calls.length).toBe(before)
  })

  it('a story the server refuses stays, with its reason, and the person is told', async () => {
    await openWith([queuedDraft()], { '/historias': () => reply({ detail: 'El audio pesa demasiado.' }, 413) })

    expect(await screen.findByText('Una historia no se pudo enviar. Revisa «Mis historias».')).toBeInTheDocument()
    const [left] = await listQueued(NARRATOR.id)
    expect(left.fallo).toBe('El audio pesa demasiado.')
  })
})

describe('the signal coming and going (F10)', () => {
  it('says so when it is lost and when it returns', async () => {
    renderApp({ route: '/', api: {} })
    await screen.findByRole('heading', { name: 'Mapa de historias' })

    act(() => toggleSimulatedOffline())
    expect(await screen.findByText('Sin señal: lo que cuentes se guarda en el dispositivo.')).toBeInTheDocument()

    act(() => toggleSimulatedOffline())
    expect(await screen.findByText('Volvió la señal.')).toBeInTheDocument()
  })

  it('does not say it twice when sending the waiting stories already did', async () => {
    setSimulatedOffline(true)
    await openWith([queuedDraft()])

    act(() => toggleSimulatedOffline())

    expect(await screen.findByText('Volvió la señal: se envió 1 borrador a revisión.')).toBeInTheDocument()
    expect(screen.queryByText('Volvió la señal.')).not.toBeInTheDocument()
  })
})
