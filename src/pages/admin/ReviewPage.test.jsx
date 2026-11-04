import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR } from '../../test/auth.js'
import { STATS, adminStory } from '../../test/fixtures.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'

const FIRST = adminStory({ codigo: 'HIS-2026-008', titulo: 'El beneficiadero comunitario' })
const SECOND = adminStory({
  codigo: 'HIS-2026-009',
  titulo: 'Recetas con café de la abuela',
  narrador_nombre: 'Marta Lucía Rojas',
  sector_id: 'san-lorenzo',
  formatos: ['Audio'],
  medios: [{ tipo: 'audio', url: 'https://s.public.blob.vercel-storage.com/historias/u/a.webm', duracion_s: 198 }],
})
const WITH_PHOTO = adminStory({
  codigo: 'HIS-2026-010',
  titulo: 'De la finca a la escuela',
  formatos: ['Foto'],
  medios: [{ tipo: 'foto', url: 'https://s.public.blob.vercel-storage.com/historias/u/f.jpg' }],
})
const DONE = (estado, extra = {}) => adminStory({ codigo: 'HIS-2026-012', titulo: 'Un viaje a la ciudad', estado, ...extra })

/** The API of the review screens: a queue that shrinks as stories are decided. */
function reviewApi({ queue = [FIRST, SECOND], approved = [], rejected = [], decide = null } = {}) {
  const waiting = [...queue]
  const stats = () => ({ ...STATS, en_revision: waiting.length, aprobadas_comunidad: approved.length, rechazadas: rejected.length })
  const take = (url) => {
    const code = decodeURIComponent(url.match(/historias\/([^/]+)\//)[1])
    const index = waiting.findIndex((story) => story.codigo === code)
    return index >= 0 ? waiting.splice(index, 1)[0] : null
  }
  return {
    '/estadisticas': () => stats(),
    '/admin/historias': (_init, url) => {
      if (url.includes('estado=publicada')) return approved
      if (url.includes('estado=rechazada')) return rejected
      return waiting
    },
    '/admin/historias/HIS-2026-008/aprobar': (init, url) => decide?.('aprobar', init, url) ?? (take(url) ? { ...FIRST, estado: 'publicada' } : reply({ detail: 'Esa historia ya fue revisada: quedó publicada. Actualiza la lista.' }, 409)),
    '/admin/historias/HIS-2026-008/rechazar': (init, url) => decide?.('rechazar', init, url) ?? (take(url) ? { ...FIRST, estado: 'rechazada' } : reply({ detail: 'Esa historia ya fue revisada.' }, 409)),
    '/admin/historias/HIS-2026-009/aprobar': (_init, url) => (take(url) ? { ...SECOND, estado: 'publicada' } : reply({ detail: 'x' }, 409)),
  }
}

const open = (variant = 'admin', api = reviewApi()) =>
  renderApp({ route: variant === 'admin' ? '/admin/revision' : '/revision', user: ADMIN, api })

const tickAll = async (user) => {
  for (const name of [/cultura cafetera/, /Minca o en un sector/, /datos personales/]) {
    await user.click(screen.getByRole('checkbox', { name }))
  }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Revisión: la bandeja (F6)', () => {
  it('lists what waits for review, with the numbers in the tabs', async () => {
    open('admin', reviewApi({ approved: [DONE('publicada')], rejected: [DONE('rechazada'), DONE('rechazada', { codigo: 'HIS-2026-013' })] }))

    const row = (await screen.findByText('El beneficiadero comunitario')).closest('[role=row]')
    expect(within(row).getByText('HIS-2026-008')).toBeInTheDocument()
    expect(within(row).getByText('Jorge Iván Castro')).toBeInTheDocument()
    expect(within(row).getByText('La Tagua')).toBeInTheDocument()
    expect(within(row).getByText('18 oct 2026')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Revisar' })).toBeInTheDocument()
    const tabs = screen.getByRole('group', { name: 'Filtrar por estado' })
    expect(within(tabs).getByRole('button', { name: /Por revisar\s*2/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(tabs).getByRole('button', { name: /Aprobadas\s*1/ })).toBeInTheDocument()
    expect(within(tabs).getByRole('button', { name: /Rechazadas\s*2/ })).toBeInTheDocument()
  })

  it('says so when nothing waits for review', async () => {
    open('admin', reviewApi({ queue: [] }))

    expect(await screen.findByText(/No hay historias por revisar/)).toBeInTheDocument()
  })

  it('shows the portal counters above the table only in the portal', async () => {
    const { unmount } = open('portal')
    expect(await screen.findByText('Aprobadas de la comunidad')).toBeInTheDocument()
    unmount()

    open('admin')
    await screen.findByText('El beneficiadero comunitario')
    expect(screen.queryByText('Aprobadas de la comunidad')).not.toBeInTheDocument()
  })

  it('the approved and rejected tabs list them; a rejected one shows why, and neither can be reviewed again', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open(
      'admin',
      reviewApi({
        approved: [DONE('publicada', { titulo: 'Ya publicada' })],
        rejected: [DONE('rechazada', { titulo: 'No cumplió', motivo_rechazo: 'Fuera del tema: no trata de la cultura cafetera' })],
      }),
    )
    await screen.findByText('El beneficiadero comunitario')

    await user.click(screen.getByRole('button', { name: /Aprobadas/ }))
    expect(await screen.findByText('Ya publicada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/historias').some(([url]) => url.includes('estado=publicada') && url.includes('origen=comunidad'))).toBe(true)

    await user.click(screen.getByRole('button', { name: /Rechazadas/ }))
    expect(await screen.findByText('No cumplió')).toBeInTheDocument()
    expect(screen.getByText('Fuera del tema: no trata de la cultura cafetera')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument()
  })

  it('a slow answer for a tab that was left does not replace the list of the tab being looked at', async () => {
    const user = userEvent.setup()
    let release
    const slow = new Promise((resolve) => (release = resolve))
    const api = reviewApi({ rejected: [DONE('rechazada', { titulo: 'La de la pestaña actual' })] })
    const waiting = api['/admin/historias']
    let first = true
    api['/admin/historias'] = (init, url) => (first && url.includes('estado=revision') ? ((first = false), slow) : waiting(init, url))
    open('admin', api)

    await user.click(await screen.findByRole('button', { name: /Rechazadas/ }))
    expect(await screen.findByText('La de la pestaña actual')).toBeInTheDocument()
    release([FIRST]) // the answer of the first tab arrives late

    await waitFor(() => expect(screen.getByText('La de la pestaña actual')).toBeInTheDocument())
    expect(screen.queryByText('El beneficiadero comunitario')).not.toBeInTheDocument()
  })

  it('an approved story has its card, which opens from the list without asking again', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open('admin', reviewApi({ approved: [DONE('publicada', { titulo: 'Ya publicada', publicada_en: '2026-10-20T12:00:00Z' })] }))
    await screen.findByText('El beneficiadero comunitario')
    await user.click(screen.getByRole('button', { name: /Aprobadas/ }))

    await user.click(await screen.findByRole('button', { name: 'Ver ficha' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ficha de la historia' })
    expect(within(dialog).getByRole('heading', { name: 'Ya publicada' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Ver en el mapa' })).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias/HIS-2026-012')).toHaveLength(0)
  })

  it('a narrator cannot get into the review', () => {
    renderApp({ route: '/revision', user: NARRATOR })

    expect(screen.queryByRole('heading', { name: 'Revisión de historias' })).not.toBeInTheDocument()
  })
})

describe('Revisión: leer la historia', () => {
  it('opens the story with its text, tags, who tells it and the three checks', async () => {
    const user = userEvent.setup()
    open()

    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])

    const dialog = await screen.findByRole('dialog', { name: 'Revisar historia' })
    expect(within(dialog).getByRole('heading', { name: 'El beneficiadero comunitario' })).toBeInTheDocument()
    expect(within(dialog).getByText(/Entre varias familias armamos/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Narra Jorge Iván Castro · La Tagua · 2000 en adelante · enviada 18 oct 2026/)).toBeInTheDocument()
    expect(within(dialog).getByText('#oficios')).toBeInTheDocument()
    expect(within(dialog).getByText('1 de 2')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(3)
  })

  it('lets the reviewer hear the audio and see the photos before deciding', async () => {
    const user = userEvent.setup()
    open('admin', reviewApi({ queue: [SECOND, WITH_PHOTO] }))

    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    let dialog = await screen.findByRole('dialog', { name: 'Revisar historia' })
    expect(within(dialog).getByRole('button', { name: 'Escuchar el audio' })).toBeEnabled()
    expect(within(dialog).getByText('3:18')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))

    await user.click(screen.getAllByRole('button', { name: 'Revisar' })[1])
    dialog = await screen.findByRole('dialog', { name: 'Revisar historia' })
    expect(within(dialog).getByRole('img', { name: 'Foto 1 de la historia' })).toHaveAttribute('src', expect.stringContaining('f.jpg'))
  })

  it('closes with Escape or the close button without deciding anything', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/historias/HIS-2026-008/aprobar')).toHaveLength(0)
  })
})

describe('Revisión: aprobar', () => {
  it('cannot approve until the three checks are marked', async () => {
    const user = userEvent.setup()
    open()
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    const approve = screen.getByRole('button', { name: 'Aprobar y publicar' })

    expect(approve).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /cultura cafetera/ }))
    await user.click(screen.getByRole('checkbox', { name: /Minca o en un sector/ }))
    expect(approve).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /datos personales/ }))
    expect(approve).toBeEnabled()

    await user.click(screen.getByRole('checkbox', { name: /datos personales/ }))
    expect(approve).toBeDisabled() // un-marking a check turns it off again
  })

  it('publishes it, says so, refreshes the counters and goes on to the next story in the queue', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    await tickAll(user)
    const statsCallsBefore = callsTo(fetchMock, '/estadisticas').length

    await user.click(screen.getByRole('button', { name: 'Aprobar y publicar' }))

    expect(await screen.findByText('Publicada: ya aparece en el mapa. Siguiente en la fila.')).toBeInTheDocument()
    const [[, init]] = callsTo(fetchMock, '/admin/historias/HIS-2026-008/aprobar')
    expect(JSON.parse(init.body)).toEqual({ confirmaciones: ['tema', 'territorio', 'datos'] })
    const dialog = await screen.findByRole('dialog', { name: 'Revisar historia' })
    expect(within(dialog).getByRole('heading', { name: 'Recetas con café de la abuela' })).toBeInTheDocument()
    expect(within(dialog).getByText('1 de 1')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Aprobar y publicar' })).toBeDisabled() // the checks start again
    expect(callsTo(fetchMock, '/estadisticas').length).toBeGreaterThan(statsCallsBefore)
    expect(screen.queryByText('El beneficiadero comunitario', { selector: 'b' })).not.toBeInTheDocument()
  })

  it('closes when it was the last one', async () => {
    const user = userEvent.setup()
    open('admin', reviewApi({ queue: [FIRST] }))
    await user.click(await screen.findByRole('button', { name: 'Revisar' }))
    await tickAll(user)

    await user.click(screen.getByRole('button', { name: 'Aprobar y publicar' }))

    expect(await screen.findByText('Publicada: ya aparece en el mapa.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(/No hay historias por revisar/)).toBeInTheDocument()
  })

  it('in the portal it closes after deciding instead of opening the next one', async () => {
    const user = userEvent.setup()
    open('portal')
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    await tickAll(user)

    await user.click(screen.getByRole('button', { name: 'Aprobar y publicar' }))

    expect(await screen.findByText('Publicada: ya aparece en el mapa.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('tells the reviewer when somebody else already decided that story, and refreshes the list', async () => {
    const user = userEvent.setup()
    const api = reviewApi()
    api['/admin/historias/HIS-2026-008/aprobar'] = () =>
      reply({ detail: 'Esa historia ya fue revisada: quedó rechazada. Actualiza la lista.' }, 409)
    const { fetchMock } = open('admin', api)
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    await tickAll(user)
    const listCalls = callsTo(fetchMock, '/admin/historias').length

    await user.click(screen.getByRole('button', { name: 'Aprobar y publicar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ya fue revisada')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(callsTo(fetchMock, '/admin/historias').length).toBeGreaterThan(listCalls))
  })

  it('keeps the story and says so when the connection fails', async () => {
    const user = userEvent.setup()
    const api = reviewApi()
    api['/admin/historias/HIS-2026-008/aprobar'] = () => reply({ detail: 'Error' }, 500)
    open('admin', api)
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    await tickAll(user)

    await user.click(screen.getByRole('button', { name: 'Aprobar y publicar' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar y publicar' })).toBeEnabled() // can try again
  })
})

describe('Revisión: rechazar (caso 3)', () => {
  it('asks for a reason and will not confirm without one', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])

    await user.click(screen.getByRole('button', { name: 'Rechazar' }))

    expect(screen.getByText('El narrador verá este motivo en «Mis historias».')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Aprobar y publicar' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: /Motivo del rechazo/ }), 'Contenido incompleto')
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeEnabled()
    expect(callsTo(fetchMock, '/admin/historias/HIS-2026-008/rechazar')).toHaveLength(0)
  })

  it('rejecting does not need the three checks', async () => {
    const user = userEvent.setup()
    open()
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Motivo del rechazo/ }), 'fuera-del-tema')

    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeEnabled()
  })

  it('sends the chosen reason and moves on', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Motivo del rechazo/ }), 'Fuera del tema')

    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))

    expect(await screen.findByText('Rechazada: no se publica. Siguiente en la fila.')).toBeInTheDocument()
    const [[, init]] = callsTo(fetchMock, '/admin/historias/HIS-2026-008/rechazar')
    expect(JSON.parse(init.body)).toEqual({ motivo: 'fuera-del-tema' })
  })

  it('"Volver" goes back to approving and forgets the reason', async () => {
    const user = userEvent.setup()
    open()
    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Motivo del rechazo/ }), 'fuera-del-tema')

    await user.click(screen.getByRole('button', { name: 'Volver' }))
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))

    expect(screen.getByRole('combobox', { name: /Motivo del rechazo/ })).toHaveValue('')
  })
})
