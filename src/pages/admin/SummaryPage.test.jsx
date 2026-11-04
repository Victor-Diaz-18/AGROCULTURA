import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN } from '../../test/auth.js'
import { STATS, adminStory } from '../../test/fixtures.js'
import { renderApp } from '../../test/renderApp.jsx'

const stats = { ...STATS, publicadas: 7, en_revision: 6, aprobadas_comunidad: 5, por_origen: { comunidad: 5, proyecto: 2 }, sectores_con_historias: 3, formatos: { foto: 4, audio: 5, video: 2 } }
const queue = Array.from({ length: 6 }, (_, index) =>
  adminStory({ codigo: `HIS-2026-0${20 + index}`, titulo: `Historia ${index + 1}`, formatos: ['Audio', 'Foto'] }),
)

const open = (list = queue) =>
  renderApp({ route: '/admin', user: ADMIN, api: { '/estadisticas': stats, '/admin/historias': list } })

describe('Resumen del administrador', () => {
  it('shows how the archive is going', async () => {
    open()

    expect(await screen.findByText('Publicadas en el mapa')).toBeInTheDocument()
    const published = screen.getByText('Publicadas en el mapa').closest('.ag-stat')
    expect(within(published).getByText('7')).toBeInTheDocument()
    expect(within(published).getByText('5 de la comunidad · 2 del proyecto')).toBeInTheDocument()
    const formats = screen.getByText('Formatos publicados').closest('.ag-stat')
    expect(formats).toHaveTextContent('5 audio')
    expect(formats).toHaveTextContent('4 foto')
    expect(formats).toHaveTextContent('2 video')
  })

  it('lists the first five stories waiting for review with who sent them', async () => {
    open()

    const list = await screen.findByRole('list', { name: 'Historias esperando revisión' })
    const items = await within(list).findAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[0]).toHaveTextContent('Historia 1')
    expect(items[0]).toHaveTextContent('Jorge Iván Castro · La Tagua · Audio · Foto · enviada 18 oct 2026')
    expect(within(list).queryByText('Historia 6')).not.toBeInTheDocument()
  })

  it('"Revisar" opens the review of that story, in place', async () => {
    const user = userEvent.setup()
    open()

    await user.click((await screen.findAllByRole('button', { name: 'Revisar' }))[1])

    const dialog = await screen.findByRole('dialog', { name: 'Revisar historia' })
    expect(within(dialog).getByRole('heading', { name: 'Historia 2' })).toBeInTheDocument()
    expect(within(dialog).getByText('2 de 6')).toBeInTheDocument()
  })

  it('says so when nothing is waiting', async () => {
    open([])

    expect(await screen.findByText(/No hay historias pendientes/)).toBeInTheDocument()
  })

  it('"Ver todas" and the yellow card go to the queue', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByText('Esperando revisión')

    await user.click(screen.getByRole('button', { name: 'Ver todas' }))

    expect(await screen.findByRole('heading', { name: 'Revisión de historias' })).toBeInTheDocument()
  })
})
