import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetConnectivityForTests, setSimulatedOffline } from '../../offline/connectivity.js'
import { NARRATOR } from '../../test/auth.js'
import { CONFIG, STATS, mapStory } from '../../test/fixtures.js'
import { mockMapSize } from '../../test/layout.js'
import { renderApp } from '../../test/renderApp.jsx'

const stats = { ...STATS, publicadas: 9, sectores_con_historias: 4, en_revision: 4, formatos: { audio: 7, foto: 5, video: 0 } }
const visit = (extra = {}) => renderApp({ api: { '/estadisticas': stats, '/historias': [mapStory()], ...extra } })
const facts = () => screen.findByRole('list', { name: 'Lo que hay en el mapa' })

let restore
beforeEach(() => {
  restore = mockMapSize()
})
afterEach(() => restore())

describe('La vista de un visitante sin cuenta', () => {
  it('says what this is, with the map below', async () => {
    visit()

    expect(screen.getByRole('heading', { level: 1, name: /La memoria del café de Minca/ })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Mapa de historias' })).toBeInTheDocument()
    expect(document.title).toContain('Mapa de historias')
    expect(screen.getByRole('link', { name: 'Explorar el mapa' })).toHaveAttribute('href', '#mapa')
    expect(document.getElementById('mapa')).toContainElement(screen.getByRole('heading', { level: 2, name: 'Mapa de historias' }))
    expect(screen.getByRole('heading', { name: /Cómo llega una historia al mapa/ })).toBeInTheDocument()
  })

  it('shows nothing of the team: no menu of closed sections, no review counters, no demo switch', async () => {
    visit()
    await within(await facts()).findByText(/historias publicadas/)

    expect(screen.queryByRole('img', { name: 'Solo administradores' })).not.toBeInTheDocument()
    expect(screen.queryByText('ADMINISTRACIÓN')).not.toBeInTheDocument()
    expect(screen.queryByText(/revisión/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Simular conexión/ })).not.toBeInTheDocument()
  })

  it('counts only what there is', async () => {
    visit()

    const list = await facts()
    await within(list).findByText(/historias publicadas/)
    expect(list).toHaveTextContent('9 historias publicadas')
    expect(list).toHaveTextContent('7 con audio')
    expect(list).not.toHaveTextContent('con video') // none yet: it is not announced as "0"
  })

  it('reads aloud what is on the page, and not what is waiting for the team', async () => {
    const user = userEvent.setup()
    visit()
    await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })

    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    const spoken = window.speechSynthesis.speak.mock.calls.map(([utterance]) => utterance.text).join(' ')
    expect(spoken).toContain('Mapa de historias')
    expect(spoken).not.toContain('esperando revisión')
  })

  it.each([
    ['the link of the header', () => screen.getByRole('link', { name: 'Contar una historia' })],
    ['the button of the opening', () => screen.getByRole('button', { name: 'Contar una historia' })],
    ['the invitation below the map', () => screen.getByRole('button', { name: 'Contar mi historia' })],
  ])('asks to sign in from %s, staying on the map', async (_, target) => {
    const user = userEvent.setup()
    visit()

    await user.click(target())

    expect(await screen.findByRole('dialog', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: /La memoria del café/ })).toBeInTheDocument()
  })

  it('says it has no signal when it really has none', async () => {
    act(() => resetConnectivityForTests({ real: false }))
    visit()

    expect(await within(screen.getByRole('banner')).findByText('Sin señal')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Simular conexión/ })).not.toBeInTheDocument()
  })

  it('can turn off the demo switch if it was left on, and then it goes away', async () => {
    const user = userEvent.setup()
    act(() => setSimulatedOffline(true))
    visit()

    await user.click(screen.getByRole('button', { name: /Simular conexión/ }))

    expect(screen.queryByRole('button', { name: /Simular conexión/ })).not.toBeInTheDocument()
  })

  it('shows the sample-data notice and who makes this', async () => {
    visit({ '/config': { ...CONFIG, portal: { ...CONFIG.portal, datos_de_ejemplo: true } } })

    expect(await screen.findByText('Datos de ejemplo')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Universidad del Magdalena')
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'CC BY-SA 3.0' })).toBeInTheDocument() // the license of the photo asks for its credit
    expect(within(screen.getByRole('contentinfo')).getByText(/diego_cue/)).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Próximamente' })).getByRole('link', { name: 'Recorridos 360°' })).toBeInTheDocument()
  })

  it('tells the first farms below the map, with the dates of the academic source and its sources', async () => {
    visit()

    const farms = await screen.findByRole('region', { name: 'Las primeras fincas' })
    expect(within(farms).getByRole('heading', { name: 'Hacienda Minca' })).toBeInTheDocument()
    const victoria = within(farms).getByRole('heading', { name: 'La Victoria' }).closest('li')
    expect(victoria).toHaveTextContent('1896')
    expect(victoria).not.toHaveTextContent('1892')
    expect(within(farms).getByRole('heading', { name: 'Datos de la zona' })).toBeInTheDocument()
    expect(within(farms).getByRole('link', { name: /Aroma de café/ })).toHaveAttribute('href', expect.stringContaining('redalyc.org'))
    expect(screen.getByRole('heading', { name: 'Mapa de historias' }).compareDocumentPosition(farms)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('names no people in the history of the farms', async () => {
    visit()

    const farms = await screen.findByRole('region', { name: 'Las primeras fincas' })
    for (const name of ['Oligós', 'Díaz Granados', 'de Mier', 'Leiva', 'Balaguera', 'Crane', 'Flye', 'Weber', 'Carriker', 'Bowden', 'Viloria', 'Reátiga', 'Becerra', 'Pineda', 'Cucunubá']) {
      expect(farms).not.toHaveTextContent(name)
    }
  })

  it('can be listened to', async () => {
    const user = userEvent.setup()
    visit()

    await user.click(await screen.findByRole('button', { name: 'Escuchar esta sección' }))

    const spoken = window.speechSynthesis.speak.mock.calls.map(([utterance]) => utterance.text).join(' ')
    expect(spoken).toContain('La Victoria, 1896.')
    expect(spoken).toContain('Datos de la zona.')
  })

  it('signing in brings the working frame back, on the same page', async () => {
    renderApp({ user: NARRATOR, api: { '/estadisticas': stats, '/historias': [mapStory()] } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Mapa de historias' })).toBeInTheDocument()
    expect(screen.getByText('NARRADOR')).toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Simular conexión/ })).toBeInTheDocument()
  })
})
