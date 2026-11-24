import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR, OTHER_ADMIN } from '../../test/auth.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'

const row = (overrides) => ({
  id: 'n1',
  nombre: 'José Peña',
  usuario: 'josé peña',
  historias: 2,
  creado_en: '2026-10-01T15:00:00',
  ultimo_ingreso: '2026-11-02T15:00:00',
  clave_restablecida_por: null,
  clave_restablecida_en: null,
  ...overrides,
})

const isPost = ([, init]) => init?.method === 'POST'

/** Narrators that change like the server does. */
function narratorsApi({ list = [row(), row({ id: 'n2', nombre: 'Rosa Pérez', usuario: '3001234567', historias: 1 })], fails = null } = {}) {
  return {
    '/admin/narradores': () => structuredClone(list),
    '/admin/narradores/n1/clave': () => {
      if (fails) return reply({ detail: fails }, 422)
      Object.assign(list[0], { clave_restablecida_por: 'admin-prueba', clave_restablecida_en: '2026-11-24T10:00:00' })
      return list[0]
    },
  }
}

const open = ({ user = ADMIN, ...options } = {}) => renderApp({ route: '/admin/narradores', user, api: narratorsApi(options) })

const rowOf = async (name) => (await screen.findByText(name, { selector: 'b' })).closest('li')

describe('Narradores', () => {
  it('lists every account with what the family signs in with and how many stories it sent', async () => {
    open()

    const jose = await rowOf('José Peña')
    expect(within(jose).getByText('Entra como: josé peña')).toBeInTheDocument()
    expect(within(jose).getByText(/2 historias · Entró por última vez el/)).toBeInTheDocument()
    const rosa = await rowOf('Rosa Pérez')
    expect(within(rosa).getByText('Entra como: 3001234567')).toBeInTheDocument()
    expect(within(rosa).getByText(/^1 historia/)).toBeInTheDocument()
  })

  it('finds an account by part of the name, with or without accents, or by its user', async () => {
    const user = userEvent.setup()
    open()
    await rowOf('José Peña')
    const search = screen.getByLabelText('Buscar por nombre o usuario')

    await user.type(search, 'jose')
    expect(screen.getByText('José Peña', { selector: 'b' })).toBeInTheDocument()
    expect(screen.queryByText('Rosa Pérez', { selector: 'b' })).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, '300123')
    expect(screen.getByText('Rosa Pérez', { selector: 'b' })).toBeInTheDocument()
    expect(screen.queryByText('José Peña', { selector: 'b' })).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'nadie así')
    expect(screen.getByText(/Nadie con ese nombre/)).toBeInTheDocument()
  })

  it('gives a narrator the password the administrator writes, and says who changed it', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()

    await user.click(within(await rowOf('José Peña')).getByRole('button', { name: 'Cambiar la contraseña de José Peña' }))
    const input = screen.getByLabelText(/Contraseña nueva para José Peña/)
    expect(input).toHaveFocus()
    await user.type(input, 'cafe-4821')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('Listo. José Peña ya puede entrar con la contraseña nueva.')).toBeInTheDocument()
    const [call] = callsTo(fetchMock, '/admin/narradores/n1/clave')
    expect(JSON.parse(call[1].body)).toEqual({ clave: 'cafe-4821' })
    const jose = await rowOf('José Peña')
    expect(within(jose).getByText(/Contraseña cambiada por admin-prueba el/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Contraseña nueva para/)).not.toBeInTheDocument()
    expect(screen.queryByText('cafe-4821')).not.toBeInTheDocument() // it is not left on the screen
  })

  it('asks for 6 characters or more before sending anything', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()

    await user.click(within(await rowOf('José Peña')).getByRole('button', { name: 'Cambiar la contraseña de José Peña' }))
    await user.type(screen.getByLabelText(/Contraseña nueva para José Peña/), '12345')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(screen.getByRole('alert')).toHaveTextContent('La contraseña debe tener al menos 6 caracteres.')
    expect(fetchMock.mock.calls.filter(isPost)).toHaveLength(0)
  })

  it('shows what the server says when it refuses, and keeps the form open', async () => {
    const user = userEvent.setup()
    open({ fails: 'La contraseña es demasiado larga. Acórtala un poco.' })

    await user.click(within(await rowOf('José Peña')).getByRole('button', { name: 'Cambiar la contraseña de José Peña' }))
    await user.type(screen.getByLabelText(/Contraseña nueva para José Peña/), 'una-contraseña')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña es demasiado larga. Acórtala un poco.')
    expect(screen.getByLabelText(/Contraseña nueva para José Peña/)).toBeInTheDocument()
  })

  it('cancel closes the form without sending anything', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()

    await user.click(within(await rowOf('José Peña')).getByRole('button', { name: 'Cambiar la contraseña de José Peña' }))
    await user.type(screen.getByLabelText(/Contraseña nueva para José Peña/), 'cafe-4821')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText(/Contraseña nueva para/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(isPost)).toHaveLength(0)
  })

  it('says so when nobody has an account yet', async () => {
    open({ list: [] })

    expect(await screen.findByText('Todavía no hay narradores con cuenta.')).toBeInTheDocument()
  })

  it('any administrator gets here from the menu, not only the main one', async () => {
    open({ user: OTHER_ADMIN })

    const menu = screen.getByRole('navigation', { name: 'Secciones de administración' })
    expect(within(menu).getByRole('link', { name: /Narradores/ })).toHaveAttribute('href', '/admin/narradores')
    expect(await rowOf('José Peña')).toBeInTheDocument()
  })

  it('a narrator does not get in', async () => {
    const { fetchMock } = renderApp({ route: '/admin/narradores', user: NARRATOR, api: narratorsApi() })

    await screen.findByText('PANEL DEL EQUIPO') // the panel frame is there, asking to sign in as an administrator
    expect(screen.queryByRole('heading', { name: 'Narradores', level: 1 })).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/narradores')).toHaveLength(0)
  })
})
