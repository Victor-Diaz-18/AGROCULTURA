import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR, fakeToken } from '../../test/auth.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'

async function openDialog(user) {
  await user.click(screen.getByRole('button', { name: /Ingresar/ }))
  return screen.getByRole('dialog', { name: 'Ingresar' })
}

const narratorSession = () => reply({ token: fakeToken(), usuario: NARRATOR }, 201)

describe('Sign-in dialog (F2)', () => {
  it('opens from the header with the first-time narrator form', async () => {
    const user = userEvent.setup()
    renderApp()

    const dialog = await openDialog(user)

    expect(within(dialog).getByRole('button', { name: 'Narrador · F2' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: 'Administrador · F7' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByRole('button', { name: 'Primera vez' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Tu nombre')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Número de celular')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Elige una clave de 4 a 6 números')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  it('only enables the button when name, mobile and PIN are valid', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openDialog(user)
    const create = within(dialog).getByRole('button', { name: 'Crear cuenta' })

    await user.type(within(dialog).getByLabelText('Tu nombre'), 'Ana Beltrán')
    await user.type(within(dialog).getByLabelText('Número de celular'), '300 555 0192')
    await user.type(within(dialog).getByLabelText('Elige una clave de 4 a 6 números'), '12')
    expect(create).toBeDisabled() // a PIN needs 4 to 6 numbers

    await user.type(within(dialog).getByLabelText('Elige una clave de 4 a 6 números'), '34')
    expect(create).toBeEnabled()
  })

  it('creates the account, signs in and greets the person', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({ api: { '/auth/registro': narratorSession, '/auth/yo': NARRATOR } })
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Tu nombre'), 'Ana Beltrán')
    await user.type(within(dialog).getByLabelText('Número de celular'), '300 555 0192')
    await user.type(within(dialog).getByLabelText('Elige una clave de 4 a 6 números'), '4821')
    await user.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Hola, Ana. Ya puedes contar tus historias.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ana Beltrán')).toBeInTheDocument() // the header now shows the narrator
    expect(localStorage.getItem('agrocultura.token')).toBeTruthy()
    expect(JSON.parse(callsTo(fetchMock, '/auth/registro')[0][1].body)).toEqual({
      nombre: 'Ana Beltrán',
      celular: '300 555 0192',
      pin: '4821',
    })
  })

  it('"Ya tengo cuenta" asks only for mobile and PIN, and hides the PIN', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({ api: { '/auth/ingreso': () => reply({ token: fakeToken(), usuario: NARRATOR }), '/auth/yo': NARRATOR } })
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Ya tengo cuenta' }))

    expect(within(dialog).queryByLabelText('Tu nombre')).not.toBeInTheDocument()
    const pin = within(dialog).getByLabelText('Tu clave')
    expect(pin).toHaveAttribute('type', 'password')

    await user.type(within(dialog).getByLabelText('Número de celular'), '3005550192')
    await user.type(pin, '4821')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Hola, Ana. Ya puedes contar tus historias.')).toBeInTheDocument()
    expect(JSON.parse(callsTo(fetchMock, '/auth/ingreso')[0][1].body)).toEqual({
      rol: 'narrador',
      usuario: '3005550192',
      clave: '4821',
    })
  })

  it('shows a new PIN in plain sight so it is not mistyped', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openDialog(user)

    expect(within(dialog).getByLabelText('Elige una clave de 4 a 6 números')).toHaveAttribute('type', 'text')
  })

  it('shows the server message and stays open when the PIN is wrong', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/auth/ingreso': () => reply({ detail: 'Celular o clave incorrectos.', code: 'no_autenticado' }, 401) } })
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Ya tengo cuenta' }))
    await user.type(within(dialog).getByLabelText('Número de celular'), '3005550192')
    await user.type(within(dialog).getByLabelText('Tu clave'), '0000')

    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Celular o clave incorrectos.')
    expect(screen.getByRole('dialog', { name: 'Ingresar' })).toBeInTheDocument()
    expect(localStorage.getItem('agrocultura.token')).toBeNull()
  })

  it('tells the person when too many attempts locked the phone', async () => {
    const user = userEvent.setup()
    renderApp({
      api: { '/auth/ingreso': () => reply({ detail: 'Demasiados intentos. Espera 12 minutos e inténtalo de nuevo.' }, 429) },
    })
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Ya tengo cuenta' }))
    await user.type(within(dialog).getByLabelText('Número de celular'), '3005550192')
    await user.type(within(dialog).getByLabelText('Tu clave'), '4821')

    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Demasiados intentos. Espera 12 minutos')
  })

  it('lets an administrator in with user and password', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({
      api: { '/auth/ingreso': () => reply({ token: fakeToken({ rol: 'administrador' }), usuario: ADMIN }), '/auth/yo': ADMIN },
    })
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Administrador · F7' }))
    expect(within(dialog).queryByLabelText('Número de celular')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Esta sección es solo para administradores.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Usuario'), 'admin')
    await user.type(within(dialog).getByLabelText('Contraseña'), 'una-clave-larga-1234')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Ingresaste como administrador.')).toBeInTheDocument()
    expect(screen.getByText('Administración')).toBeInTheDocument()
    expect(JSON.parse(callsTo(fetchMock, '/auth/ingreso')[0][1].body)).toEqual({
      rol: 'administrador',
      usuario: 'admin',
      clave: 'una-clave-larga-1234',
    })
  })

  it('says so when there is no signal, without calling the server', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp()
    await user.click(screen.getByRole('button', { name: /Simular conexión/ }))
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Ya tengo cuenta' }))
    await user.type(within(dialog).getByLabelText('Número de celular'), '3005550192')
    await user.type(within(dialog).getByLabelText('Tu clave'), '4821')

    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Sin señal: necesitas conexión para ingresar.')
    expect(callsTo(fetchMock, '/auth/ingreso')).toHaveLength(0)
  })

  it('closes with the close button and with Escape', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await openDialog(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
