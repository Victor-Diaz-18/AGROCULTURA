import logo from '../../assets/logo-temporal.png'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import Field from '../ui/Field.jsx'
import Icon from '../ui/Icon.jsx'
import Modal from '../ui/Modal.jsx'
import useSignIn from './useSignIn.js'

// The same limits the server checks (lib/auth/username.py): it has the last word and says why when something is not valid.
const MIN_USERNAME = 3
const MIN_PASSWORD = 6

function noticeFor({ creating, rol, destino }) {
  if (creating) return 'Crea tu cuenta para contar tus historias. Solo te toma un minuto.'
  if (destino === '/contar' || destino === '/mis-historias') return 'Para contar una historia necesitas ingresar.'
  if (rol === 'administrador') return 'Esta sección es solo para administradores.'
  return 'Escribe tu usuario y tu contraseña.'
}

/**
 * One sign-in for everybody: a user name and a password, with «¿No tienes cuenta? Crea una» below.
 * The account says whether it belongs to a narrator or to the team, so nobody has to choose.
 * Creating an account asks for the same two things: a user name (the name the stories will show) and any password
 * of 6 or more characters.
 */
function LoginForm({ rol, destino, onClose }) {
  const [creating, setCreating] = useState(false)
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [nuevoUsuario, setNuevoUsuario] = useState('')
  const [nuevaClave, setNuevaClave] = useState('')
  const [verClave, setVerClave] = useState(true) // shown while it is chosen, so it is not mistyped (there is no "forgot it" yet)
  const [verClaveIngreso, setVerClaveIngreso] = useState(false) // signing in, it starts hidden: someone may be looking
  const { busy, error, clearError, registerNarrator, signIn } = useSignIn()
  const formRef = useRef(null)
  const switched = useRef(false)

  const canSubmit = creating
    ? nuevoUsuario.trim().length >= MIN_USERNAME && nuevaClave.length >= MIN_PASSWORD
    : usuario.trim() !== '' && clave !== ''

  // After changing between the two forms, the person continues at the first field of the new one.
  useEffect(() => {
    if (!switched.current) return
    formRef.current?.querySelector('input')?.focus()
  }, [creating])

  const switchTo = (nextCreating) => {
    clearError()
    switched.current = true
    setCreating(nextCreating)
  }

  const submit = (event) => {
    event.preventDefault()
    if (!canSubmit || busy) return
    if (creating) registerNarrator({ usuario: nuevoUsuario.trim(), clave: nuevaClave })
    else signIn({ usuario: usuario.trim(), clave })
  }

  const change = (setter) => (event) => {
    clearError()
    setter(event.target.value)
  }

  return (
    <Modal open onClose={onClose} label={creating ? 'Crear cuenta' : 'Ingresar'} maxWidth={488} level={55} top={60} className="ag-login">
      <div className="ag-login__head">
        <img className="ag-login__logo" src={logo} alt="" />
        <div className="ag-login__heading">
          <h2 className="ag-login__title">{creating ? 'Crear cuenta' : 'Ingresar'}</h2>
          <span className="ag-login__notice">{noticeFor({ creating, rol, destino })}</span>
        </div>
        <button type="button" className="ag-close" aria-label="Cerrar" onClick={onClose}>
          <Icon name="cerrar" size={16} strokeWidth={2.4} />
        </button>
      </div>

      <form ref={formRef} className="ag-login__form" onSubmit={submit} noValidate>
        {creating ? (
          <>
            <div className="ag-login__group">
              <Field label="Nombre de usuario">
                <input
                  className="ag-input"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-describedby="ag-hint-usuario"
                  value={nuevoUsuario}
                  onChange={change(setNuevoUsuario)}
                />
              </Field>
              <span id="ag-hint-usuario" className="ag-hint">
                Es el nombre que se verá en tus historias. Puede ser tu nombre.
              </span>
            </div>
            <div className="ag-login__group">
              <Field label="Contraseña">
                <input
                  className="ag-input"
                  type={verClave ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-describedby="ag-hint-clave"
                  value={nuevaClave}
                  onChange={change(setNuevaClave)}
                />
              </Field>
              <span id="ag-hint-clave" className="ag-hint">
                Mínimo {MIN_PASSWORD} caracteres: letras, números o lo que quieras, pero que la recuerdes. Sin correo ni celular.
              </span>
              <label className="ag-showpass">
                <input type="checkbox" checked={verClave} onChange={(event) => setVerClave(event.target.checked)} />
                Mostrar la contraseña
              </label>
            </div>
          </>
        ) : (
          <>
            <Field label="Usuario">
              <input
                className="ag-input"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={usuario}
                onChange={change(setUsuario)}
              />
            </Field>
            <Field label="Contraseña">
              <input className="ag-input" type={verClaveIngreso ? 'text' : 'password'} autoComplete="current-password" value={clave} onChange={change(setClave)} />
            </Field>
            <label className="ag-showpass">
              <input type="checkbox" checked={verClaveIngreso} onChange={(event) => setVerClaveIngreso(event.target.checked)} />
              Mostrar la contraseña
            </label>
          </>
        )}

        {error && (
          <div role="alert" className="ag-error">
            {error}
          </div>
        )}
        <button type="submit" className="ag-submit" disabled={!canSubmit || busy}>
          {creating ? 'Crear cuenta' : 'Ingresar'}
        </button>
      </form>

      <p className="ag-login__switch">
        {creating ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
        <button type="button" className="ag-linkbutton" onClick={() => switchTo(!creating)}>
          {creating ? 'Ingresa' : 'Crea una'}
        </button>
      </p>
    </Modal>
  )
}

/** The sign-in dialog. Mounted only while open so each opening starts with a clean form. */
export default function LoginModal() {
  const { login, closeLogin } = useAuth()
  if (!login.open) return null
  return <LoginForm key={login.nonce} rol={login.rol} destino={login.destino} onClose={closeLogin} />
}
