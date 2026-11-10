import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR, OTHER_ADMIN } from '../../test/auth.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'

const row = (overrides) => ({
  id: 'x',
  nombre: 'Nombre',
  usuario: 'usuario',
  activo: true,
  principal: false,
  creado_por: 'admin-prueba',
  creado_en: '2026-11-10T15:00:00',
  desactivado_por: null,
  desactivado_en: null,
  ...overrides,
})

const isPost = ([, init]) => init?.method === 'POST'

/** A list of administrators that changes like the server does. */
function adminsApi({ createFails = null, extra = [] } = {}) {
  const list = [row({ id: 'p1', nombre: 'Administración', usuario: 'admin-prueba', principal: true, creado_por: null }), ...extra]
  const api = {
    '/admin/administradores': (init) => {
      if (init?.method !== 'POST') return structuredClone(list)
      if (createFails) return reply({ detail: createFails }, 409)
      const body = JSON.parse(init.body)
      list.push(row({ id: 'm1', nombre: body.nombre, usuario: body.usuario.toLowerCase() }))
      return reply(list.at(-1), 201)
    },
    '/admin/administradores/m1/desactivar': () => {
      Object.assign(list[1], { activo: false, desactivado_por: 'admin-prueba', desactivado_en: '2026-11-11T10:00:00' })
      return list[1]
    },
    '/admin/administradores/m1/reactivar': () => {
      Object.assign(list[1], { activo: true, desactivado_por: null, desactivado_en: null })
      return list[1]
    },
  }
  return { list, api }
}

const open = (options) => {
  const server = adminsApi(options)
  const view = renderApp({ route: '/admin/administradores', user: ADMIN, api: server.api })
  return { ...view, ...server }
}

const fillForm = async (user, { nombre = 'Marta Ríos', usuario = 'marta', clave = 'clave-larga-123' } = {}) => {
  await user.type(screen.getByLabelText('Nombre'), nombre)
  await user.type(screen.getByLabelText('Usuario'), usuario)
  await user.type(screen.getByLabelText(/Contraseña/), clave)
}

describe('Administradores', () => {
  it('lists the main administrator without a way to deactivate it, and says who created each one', async () => {
    open({ extra: [row({ id: 'm1', nombre: 'Marta Ríos', usuario: 'marta' })] })

    const main = (await screen.findByText('Administración', { selector: 'b' })).closest('li')
    expect(within(main).getByText('Principal')).toBeInTheDocument()
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()

    const marta = screen.getByText('Marta Ríos', { selector: 'b' }).closest('li')
    expect(within(marta).getByText(/Creado por admin-prueba el/)).toBeInTheDocument()
    expect(within(marta).getByRole('button', { name: 'Desactivar a Marta Ríos' })).toBeInTheDocument()
    expect(screen.queryByText('Tú')).not.toBeInTheDocument() // whoever is signed in here is not in this list
  })

  it('marks the account of whoever is signed in, and does not offer to deactivate it', async () => {
    const server = adminsApi({ extra: [row({ id: 'm1', nombre: 'Marta Ríos', usuario: 'marta' })] })
    renderApp({ route: '/admin/administradores', user: { ...ADMIN, id: 'p1' }, api: server.api })

    const main = (await screen.findByText('Administración', { selector: 'b' })).closest('li')
    expect(within(main).getByText('Tú')).toBeInTheDocument()
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()
    expect(within(screen.getByText('Marta Ríos', { selector: 'b' }).closest('li')).queryByText('Tú')).not.toBeInTheDocument()
  })

  describe('an administrator created from the panel (not the main one)', () => {
    it('is told only the main administrator manages administrators, and the list is not even asked for', async () => {
      const { fetchMock } = renderApp({ route: '/admin/administradores', user: OTHER_ADMIN, api: adminsApi().api })

      expect(await screen.findByText(/Solo el administrador principal puede crear/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Crear administrador' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Usuario')).not.toBeInTheDocument()
      expect(callsTo(fetchMock, '/admin/administradores')).toHaveLength(0)
    })

    it('does not see the entry in either menu, and still sees the rest of the administration', async () => {
      const panel = renderApp({ route: '/admin/configuracion', user: OTHER_ADMIN })
      const adminMenu = await screen.findByRole('navigation', { name: 'Secciones de administración' })
      expect(within(adminMenu).queryByRole('link', { name: /Administradores/ })).not.toBeInTheDocument()
      expect(within(adminMenu).getByRole('link', { name: /Configuración/ })).toBeInTheDocument()
      panel.unmount()

      renderApp({ route: '/configuracion', user: OTHER_ADMIN })
      const portalMenu = await screen.findByRole('navigation', { name: 'Secciones' })
      expect(within(portalMenu).queryByRole('link', { name: /Administradores/ })).not.toBeInTheDocument()
      expect(within(portalMenu).getByRole('link', { name: /Revisión/ })).toBeInTheDocument()
    })
  })

  it('creates an administrator and shows it in the list', async () => {
    const { fetchMock } = open()
    const user = userEvent.setup()
    await screen.findByText('Administración', { selector: 'b' })

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Crear administrador' }))

    expect(await screen.findByText('Marta Ríos', { selector: 'b' })).toBeInTheDocument()
    expect(JSON.parse(callsTo(fetchMock, '/admin/administradores').find(isPost)[1].body)).toEqual({
      nombre: 'Marta Ríos',
      usuario: 'marta',
      clave: 'clave-larga-123',
    })
    expect(screen.getByLabelText('Nombre')).toHaveValue('')
  })

  it('refuses a password of fewer than 10 characters without asking the server', async () => {
    const { fetchMock } = open()
    const user = userEvent.setup()
    await screen.findByText('Administración', { selector: 'b' })

    await fillForm(user, { clave: '123456789' })
    await user.click(screen.getByRole('button', { name: 'Crear administrador' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 10 caracteres')
    expect(callsTo(fetchMock, '/admin/administradores').filter(isPost)).toHaveLength(0)
  })

  it('shows what the server says when the user name is taken', async () => {
    open({ createFails: 'Ese nombre de usuario ya está en uso. Elige otro.' })
    const user = userEvent.setup()
    await screen.findByText('Administración', { selector: 'b' })

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Crear administrador' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese nombre de usuario ya está en uso')
  })

  it('asks to confirm before deactivating, and can reactivate afterwards', async () => {
    const { fetchMock } = open({ extra: [row({ id: 'm1', nombre: 'Marta Ríos', usuario: 'marta' })] })
    const user = userEvent.setup()
    const martaRow = () => screen.getByText('Marta Ríos', { selector: 'b' }).closest('li')

    await user.click(await screen.findByRole('button', { name: 'Desactivar a Marta Ríos' }))
    expect(callsTo(fetchMock, '/admin/administradores/m1/desactivar')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Sí, desactivar a Marta Ríos' }))
    expect(await within(martaRow()).findByText('Desactivado')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/administradores/m1/desactivar')).toHaveLength(1)

    await user.click(within(martaRow()).getByRole('button', { name: 'Reactivar a Marta Ríos' }))
    await waitFor(() => expect(within(martaRow()).queryByText('Desactivado')).not.toBeInTheDocument())
    expect(callsTo(fetchMock, '/admin/administradores/m1/reactivar')).toHaveLength(1)
  })

  it('does not load the list for a narrator', async () => {
    const { fetchMock } = renderApp({ route: '/admin/administradores', user: NARRATOR, api: adminsApi().api })

    await screen.findByText('ADMINISTRACIÓN') // the panel frame is there, asking to sign in as an administrator
    expect(screen.queryByRole('heading', { name: 'Administradores' })).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/administradores')).toHaveLength(0)
  })

  it('has its link in the administration menu', async () => {
    open()

    const menu = await screen.findByRole('navigation', { name: 'Secciones de administración' })
    expect(within(menu).getByRole('link', { name: /Administradores/ })).toHaveAttribute('href', '/admin/administradores')
  })

  it('is reached from the portal menu too, where an administrator also works', async () => {
    const server = adminsApi({ extra: [row({ id: 'm1', nombre: 'Marta Ríos', usuario: 'marta' })] })
    renderApp({ route: '/configuracion', user: ADMIN, api: server.api })
    const user = userEvent.setup()

    const menu = await screen.findByRole('navigation', { name: 'Secciones' })
    await user.click(within(menu).getByRole('link', { name: /Administradores/ }))

    expect(await screen.findByRole('heading', { name: 'Administradores', level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Desactivar a Marta Ríos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear administrador' })).toBeInTheDocument()
  })

  it('is not opened from the portal by a narrator', async () => {
    const { fetchMock } = renderApp({ route: '/administradores', user: NARRATOR, api: adminsApi().api })

    await screen.findByRole('navigation', { name: 'Secciones' })
    expect(screen.queryByRole('heading', { name: 'Administradores', level: 1 })).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/administradores')).toHaveLength(0)
  })
})
