import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR, fakeToken } from '../../test/auth.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'

async function openDialog(user) {
  await user.click(screen.getByRole('button', { name: /Ingresar/ }))
  return screen.getByRole('dialog', { name: 'Ingresar' })
}

/** From the sign-in form to the sign-up one: «¿No tienes cuenta? Crea una». */
async function openSignUp(user) {
  const dialog = await openDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Crea una' }))
  return screen.getByRole('dialog', { name: 'Crear cuenta' })
}

const narratorSession = () => reply({ token: fakeToken(), usuario: NARRATOR }, 201)

describe('Sign-in dialog', () => {
  it('opens from the header with one form for everybody: user and password', async () => {
    const user = userEvent.setup()
    renderApp()

    const dialog = await openDialog(user)

    expect(within(dialog).getByLabelText('Usuario')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(within(dialog).getByRole('button', { name: 'Ingresar' })).toBeDisabled()
    expect(within(dialog).getByText(/¿No tienes cuenta\?/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Crea una' })).toBeInTheDocument()
  })

  it('does not ask who the person is: no tabs and no choice between narrator and administrator', async () => {
    const user = userEvent.setup()
    renderApp()

    const dialog = await openDialog(user)

    // Besides the close button and the submit button, the only other control is the link to create an account.
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent || button.getAttribute('aria-label'))).toEqual([
      'Cerrar',
      'Ingresar',
      'Crea una',
    ])
    expect(within(dialog).queryByRole('button', { name: /Narrador|Administrador|Primera vez|Ya tengo cuenta/ })).not.toBeInTheDocument()
  })

  it('tells narrators that their user is the mobile number and their password the PIN', async () => {
    const user = userEvent.setup()
    renderApp()

    const dialog = await openDialog(user)

    expect(within(dialog).getByText(/tu usuario es tu número de celular y tu contraseña es tu clave de 4 a 6 números/)).toBeInTheDocument()
  })

  it('only enables the button when there are a user and a password', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openDialog(user)
    const submit = within(dialog).getByRole('button', { name: 'Ingresar' })

    await user.type(within(dialog).getByLabelText('Usuario'), '3005550192')
    expect(submit).toBeDisabled()

    await user.type(within(dialog).getByLabelText('Contraseña'), '4821')
    expect(submit).toBeEnabled()
  })

  it('lets a narrator in with the mobile number and the PIN', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({ api: { '/auth/ingreso': () => reply({ token: fakeToken(), usuario: NARRATOR }), '/auth/yo': NARRATOR } })
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Usuario'), '300 555 0192')
    await user.type(within(dialog).getByLabelText('Contraseña'), '4821')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Hola, Ana. Ya puedes contar tus historias.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ana Beltrán')).toBeInTheDocument() // the header now shows the narrator
    expect(localStorage.getItem('agrocultura.token')).toBeTruthy()
    // The same two fields as for anybody else: the server knows what kind of account it is.
    expect(JSON.parse(callsTo(fetchMock, '/auth/ingreso')[0][1].body)).toEqual({ usuario: '300 555 0192', clave: '4821' })
  })

  it('lets an administrator in with the very same form', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({
      api: { '/auth/ingreso': () => reply({ token: fakeToken({ rol: 'administrador' }), usuario: ADMIN }), '/auth/yo': ADMIN },
    })
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Usuario'), 'admin')
    await user.type(within(dialog).getByLabelText('Contraseña'), 'una-clave-larga-1234')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Ingresaste como administrador.')).toBeInTheDocument()
    expect(screen.getByText('Administración')).toBeInTheDocument()
    expect(JSON.parse(callsTo(fetchMock, '/auth/ingreso')[0][1].body)).toEqual({
      usuario: 'admin',
      clave: 'una-clave-larga-1234',
    })
  })

  it('signs in when the person presses Enter in the password', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/auth/ingreso': () => reply({ token: fakeToken(), usuario: NARRATOR }), '/auth/yo': NARRATOR } })
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText('Usuario'), '3005550192')
    await user.type(within(dialog).getByLabelText('Contraseña'), '4821{Enter}')

    expect(await screen.findByText('Hola, Ana. Ya puedes contar tus historias.')).toBeInTheDocument()
  })

  it('shows the server message and stays open when the user or the password is wrong', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/auth/ingreso': () => reply({ detail: 'Usuario o contraseña incorrectos.', code: 'no_autenticado' }, 401) } })
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Usuario'), '3005550192')
    await user.type(within(dialog).getByLabelText('Contraseña'), '0000')

    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.')
    expect(screen.getByRole('dialog', { name: 'Ingresar' })).toBeInTheDocument()
    expect(localStorage.getItem('agrocultura.token')).toBeNull()
  })

  it('clears the message as soon as the person types again', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/auth/ingreso': () => reply({ detail: 'Usuario o contraseña incorrectos.' }, 401) } })
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Usuario'), '3005550192')
    await user.type(within(dialog).getByLabelText('Contraseña'), '0000')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))
    await within(dialog).findByRole('alert')

    await user.type(within(dialog).getByLabelText('Contraseña'), '1')

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('tells the person when too many attempts locked the account', async () => {
    const user = userEvent.setup()
    renderApp({
      api: { '/auth/ingreso': () => reply({ detail: 'Demasiados intentos. Espera 12 minutos e inténtalo de nuevo.' }, 429) },
    })
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Usuario'), '3005550192')
    await user.type(within(dialog).getByLabelText('Contraseña'), '4821')

    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Demasiados intentos. Espera 12 minutos')
  })

  it('says so when there is no signal, without calling the server', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp()
    await user.click(screen.getByRole('button', { name: /Simular conexión/ }))
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Usuario'), '3005550192')
    await user.type(within(dialog).getByLabelText('Contraseña'), '4821')

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

describe('«¿No tienes cuenta? Crea una»', () => {
  it('switches to the sign-up form, with a way back, and puts the focus on its first field', async () => {
    const user = userEvent.setup()
    renderApp()

    const dialog = await openSignUp(user)

    expect(within(dialog).getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Tu nombre')).toHaveFocus()
    expect(within(dialog).getByLabelText('Número de celular')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Elige una clave de 4 a 6 números')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
    expect(within(dialog).getByText(/¿Ya tienes cuenta\?/)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Usuario')).not.toBeInTheDocument()
  })

  it('goes back to the sign-in form with «¿Ya tienes cuenta? Ingresa»', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSignUp(user)

    await user.click(within(dialog).getByRole('button', { name: 'Ingresa' }))

    const back = screen.getByRole('dialog', { name: 'Ingresar' })
    expect(within(back).getByLabelText('Usuario')).toHaveFocus()
    expect(within(back).getByRole('button', { name: 'Crea una' })).toBeInTheDocument()
  })

  it('only enables the button when name, mobile and PIN are valid', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSignUp(user)
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
    const dialog = await openSignUp(user)

    await user.type(within(dialog).getByLabelText('Tu nombre'), 'Ana Beltrán')
    await user.type(within(dialog).getByLabelText('Número de celular'), '300 555 0192')
    await user.type(within(dialog).getByLabelText('Elige una clave de 4 a 6 números'), '4821')
    await user.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Hola, Ana. Ya puedes contar tus historias.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ana Beltrán')).toBeInTheDocument()
    expect(localStorage.getItem('agrocultura.token')).toBeTruthy()
    expect(JSON.parse(callsTo(fetchMock, '/auth/registro')[0][1].body)).toEqual({
      nombre: 'Ana Beltrán',
      celular: '300 555 0192',
      pin: '4821',
    })
  })

  it('shows a new PIN in plain sight so it is not mistyped', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSignUp(user)

    expect(within(dialog).getByLabelText('Elige una clave de 4 a 6 números')).toHaveAttribute('type', 'text')
  })

  it('shows the server message when that mobile number already has an account', async () => {
    const user = userEvent.setup()
    renderApp({
      api: { '/auth/registro': () => reply({ detail: 'Ese celular ya tiene una cuenta. Toca «Ingresa» más abajo para entrar con ella.' }, 409) },
    })
    const dialog = await openSignUp(user)
    await user.type(within(dialog).getByLabelText('Tu nombre'), 'Ana Beltrán')
    await user.type(within(dialog).getByLabelText('Número de celular'), '3005550192')
    await user.type(within(dialog).getByLabelText('Elige una clave de 4 a 6 números'), '4821')

    await user.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ese celular ya tiene una cuenta')
    // ...and the way to the other form is right there, below.
    expect(within(dialog).getByRole('button', { name: 'Ingresa' })).toBeInTheDocument()
  })

  it('drops the message of one form when the person changes to the other', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/auth/ingreso': () => reply({ detail: 'Usuario o contraseña incorrectos.' }, 401) } })
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Usuario'), '3005550192')
    await user.type(within(dialog).getByLabelText('Contraseña'), '0000')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))
    await within(dialog).findByRole('alert')

    await user.click(within(dialog).getByRole('button', { name: 'Crea una' }))

    expect(within(screen.getByRole('dialog', { name: 'Crear cuenta' })).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('starts again at the sign-in form every time it is opened', async () => {
    const user = userEvent.setup()
    renderApp()
    await openSignUp(user)
    await user.keyboard('{Escape}')

    const dialog = await openDialog(user)

    expect(within(dialog).getByLabelText('Usuario')).toBeInTheDocument()
  })
})
