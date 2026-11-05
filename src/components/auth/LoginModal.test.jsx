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

  it('asks for nothing else: no hint about phones or PINs, just the two fields', async () => {
    const user = userEvent.setup()
    renderApp()

    const dialog = await openDialog(user)

    expect(within(dialog).queryByText(/celular|clave de 4 a 6/i)).not.toBeInTheDocument()
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(1) // the user; the password is not a textbox
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
    expect(within(dialog).getByLabelText('Nombre de usuario')).toHaveFocus()
    expect(within(dialog).getByLabelText('Contraseña')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
    expect(within(dialog).getByText(/¿Ya tienes cuenta\?/)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Usuario')).not.toBeInTheDocument()
  })

  it('asks only for a user name and a password: no name, no mobile number, no PIN', async () => {
    const user = userEvent.setup()
    renderApp()

    const dialog = await openSignUp(user)

    expect(within(dialog).queryByLabelText('Tu nombre')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Número de celular')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/clave de 4 a 6/)).not.toBeInTheDocument()
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(2) // user name and password (shown while it is chosen)
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

  it('only enables the button with a user name (3 or more) and a password of 6 or more characters', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSignUp(user)
    const create = within(dialog).getByRole('button', { name: 'Crear cuenta' })

    await user.type(within(dialog).getByLabelText('Nombre de usuario'), 'Al')
    await user.type(within(dialog).getByLabelText('Contraseña'), '123456')
    expect(create).toBeDisabled() // the name is too short

    await user.type(within(dialog).getByLabelText('Nombre de usuario'), 'e')
    expect(create).toBeEnabled()

    await user.clear(within(dialog).getByLabelText('Contraseña'))
    await user.type(within(dialog).getByLabelText('Contraseña'), '12345')
    expect(create).toBeDisabled() // the password needs 6

    await user.type(within(dialog).getByLabelText('Contraseña'), '6')
    expect(create).toBeEnabled()
  })

  it('accepts any password of 6 characters or more: letters, spaces, symbols', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSignUp(user)
    await user.type(within(dialog).getByLabelText('Nombre de usuario'), 'Familia Pérez')

    await user.type(within(dialog).getByLabelText('Contraseña'), 'mi café 😀')

    expect(within(dialog).getByRole('button', { name: 'Crear cuenta' })).toBeEnabled()
  })

  it('creates the account, signs in and greets the person', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({ api: { '/auth/registro': narratorSession, '/auth/yo': NARRATOR } })
    const dialog = await openSignUp(user)

    await user.type(within(dialog).getByLabelText('Nombre de usuario'), 'Ana Beltrán')
    await user.type(within(dialog).getByLabelText('Contraseña'), 'mi cafetal')
    await user.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Hola, Ana. Ya puedes contar tus historias.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ana Beltrán')).toBeInTheDocument()
    expect(localStorage.getItem('agrocultura.token')).toBeTruthy()
    expect(JSON.parse(callsTo(fetchMock, '/auth/registro')[0][1].body)).toEqual({
      usuario: 'Ana Beltrán',
      clave: 'mi cafetal',
    })
  })

  it('sends the password exactly as typed, spaces included, and the user name without the spaces around it', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({ api: { '/auth/registro': narratorSession, '/auth/yo': NARRATOR } })
    const dialog = await openSignUp(user)

    await user.type(within(dialog).getByLabelText('Nombre de usuario'), '  Rosa Elena ')
    await user.type(within(dialog).getByLabelText('Contraseña'), '  clave con espacios ')
    await user.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    await screen.findByText(/Hola, /)
    expect(JSON.parse(callsTo(fetchMock, '/auth/registro')[0][1].body)).toEqual({
      usuario: 'Rosa Elena',
      clave: '  clave con espacios ',
    })
  })

  it('shows the password while it is chosen so it is not mistyped, and can hide it', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSignUp(user)
    const password = within(dialog).getByLabelText('Contraseña')
    const toggle = within(dialog).getByRole('checkbox', { name: 'Mostrar la contraseña' })

    expect(toggle).toBeChecked()
    expect(password).toHaveAttribute('type', 'text')

    await user.click(toggle)

    expect(password).toHaveAttribute('type', 'password')
  })

  it('says what the user name is for and how long the password must be', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSignUp(user)

    expect(within(dialog).getByLabelText('Nombre de usuario')).toHaveAccessibleDescription(/se verá en tus historias/)
    expect(within(dialog).getByLabelText('Contraseña')).toHaveAccessibleDescription(/Mínimo 6 caracteres/)
  })

  it('shows the server message when that user name is already taken', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/auth/registro': () => reply({ detail: 'Ese nombre de usuario ya está en uso. Elige otro.' }, 409) } })
    const dialog = await openSignUp(user)
    await user.type(within(dialog).getByLabelText('Nombre de usuario'), 'Ana Beltrán')
    await user.type(within(dialog).getByLabelText('Contraseña'), 'mi cafetal')

    await user.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ese nombre de usuario ya está en uso. Elige otro.')
    expect(within(dialog).getByLabelText('Nombre de usuario')).toHaveValue('Ana Beltrán') // nothing typed is lost
    expect(localStorage.getItem('agrocultura.token')).toBeNull()
  })

  it('drops the message of one form when the person changes to the other', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/auth/ingreso': () => reply({ detail: 'Usuario o contraseña incorrectos.' }, 401) } })
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Usuario'), 'ana')
    await user.type(within(dialog).getByLabelText('Contraseña'), '000000')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))
    await within(dialog).findByRole('alert')

    await user.click(within(dialog).getByRole('button', { name: 'Crea una' }))

    expect(within(screen.getByRole('dialog', { name: 'Crear cuenta' })).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not carry the password typed to sign in into the sign-up form (where it would show in plain sight)', async () => {
    const user = userEvent.setup()
    renderApp()
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Contraseña'), 'secreta-de-ingreso')

    await user.click(within(dialog).getByRole('button', { name: 'Crea una' }))

    expect(within(screen.getByRole('dialog', { name: 'Crear cuenta' })).getByLabelText('Contraseña')).toHaveValue('')
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
