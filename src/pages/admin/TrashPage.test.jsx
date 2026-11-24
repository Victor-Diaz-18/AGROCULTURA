import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, OTHER_ADMIN } from '../../test/auth.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'

const trashed = (overrides) => ({
  codigo: 'HIS-2026-004',
  titulo: 'El patio',
  texto: 'Texto.',
  narrador_nombre: 'Rosa Pérez',
  anonima: false,
  sector_id: 'minca',
  epoca: '1960 a 1979',
  etiquetas: [],
  formatos: ['texto'],
  medios: [],
  estado: 'papelera',
  origen: 'comunidad',
  ejemplo: false,
  enviada_en: '2026-10-01T15:00:00Z',
  borrada_en: '2026-11-20T15:00:00Z',
  se_borra_el: '2026-12-20T15:00:00Z',
  ...overrides,
})

/** A trash that changes like the server does. */
function trashApi({ list = [trashed(), trashed({ codigo: 'HIS-2026-007', titulo: 'La mula', narrador_nombre: 'José Peña' })], fails = null } = {}) {
  const drop = (code) => list.splice(list.findIndex((story) => story.codigo === code), 1)
  return {
    '/admin/papelera': () => structuredClone(list),
    '/admin/papelera/HIS-2026-004/recuperar': () => {
      if (fails) return reply({ detail: fails }, 404)
      const [story] = drop('HIS-2026-004')
      return { ...story, estado: 'publicada' }
    },
    '/admin/papelera/HIS-2026-007': () => {
      if (fails) return reply({ detail: fails }, 404)
      drop('HIS-2026-007')
      return new Response(null, { status: 204 })
    },
  }
}

const open = ({ user = ADMIN, ...options } = {}) => renderApp({ route: '/admin/papelera', user, api: trashApi(options) })

const rowOf = async (title) => (await screen.findByText(title, { selector: 'b' })).closest('li')

describe('Papelera', () => {
  it('lists the deleted stories, who tells them and until when they can come back', async () => {
    open()

    const patio = await rowOf('El patio')
    expect(within(patio).getByText('HIS-2026-004 · Narra Rosa Pérez')).toBeInTheDocument()
    expect(within(patio).getByText(/^Borrada el 20 .*nov.* 2026 · Se borra para siempre el 20 .*dic.* 2026$/)).toBeInTheDocument()
    expect(await rowOf('La mula')).toBeInTheDocument()
  })

  it('«Recuperar» publishes the story again and takes it off the trash', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()

    await user.click(within(await rowOf('El patio')).getByRole('button', { name: 'Recuperar «El patio»' }))

    expect(await screen.findByText('«El patio» volvió a publicarse: ya está otra vez en el mapa.')).toBeInTheDocument()
    expect(screen.queryByText('El patio', { selector: 'b' })).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/papelera/HIS-2026-004/recuperar')[0][1].method).toBe('POST')
  })

  it('«Borrar para siempre» asks first, says it cannot be undone, and can be cancelled', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const mula = await rowOf('La mula')

    await user.click(within(mula).getByRole('button', { name: 'Borrar para siempre «La mula»' }))
    expect(mula).toHaveTextContent('Se borran también sus fotos, audios y video. No se puede deshacer.')
    await user.click(within(mula).getByRole('button', { name: 'Cancelar' }))
    expect(within(mula).getByRole('button', { name: 'Recuperar «La mula»' })).toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/papelera/HIS-2026-007')).toHaveLength(0)

    await user.click(within(mula).getByRole('button', { name: 'Borrar para siempre «La mula»' }))
    await user.click(within(mula).getByRole('button', { name: 'Sí, borrar para siempre' }))

    expect(await screen.findByText('Se borró para siempre «La mula».')).toBeInTheDocument()
    expect(screen.queryByText('La mula', { selector: 'b' })).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/papelera/HIS-2026-007')[0][1].method).toBe('DELETE')
  })

  it('says what the server answered when it could not be done, and keeps the story', async () => {
    const user = userEvent.setup()
    open({ fails: 'Esa historia ya no está en la papelera.' })

    await user.click(within(await rowOf('El patio')).getByRole('button', { name: 'Recuperar «El patio»' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa historia ya no está en la papelera.')
    expect(screen.getByText('El patio', { selector: 'b' })).toBeInTheDocument()
  })

  it('an empty trash says so', async () => {
    open({ list: [] })

    expect(await screen.findByText('La papelera está vacía.')).toBeInTheDocument()
  })

  it('another administrator neither sees the entry nor gets the list', async () => {
    const { fetchMock } = open({ user: OTHER_ADMIN })

    expect(await screen.findByText('Solo el administrador principal puede ver la papelera y recuperar historias.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Papelera/ })).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/papelera')).toHaveLength(0)
  })

  it('the main administrator finds it in the menu of the panel', async () => {
    open()

    expect(await screen.findByRole('link', { name: /Papelera/ })).toHaveAttribute('href', '/admin/papelera')
  })
})
