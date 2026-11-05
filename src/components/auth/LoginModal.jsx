import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import Field from '../ui/Field.jsx'
import Icon from '../ui/Icon.jsx'
import Modal from '../ui/Modal.jsx'
import useSignIn from './useSignIn.js'

const digits = (text) => text.replace(/\D/g, '')
const isPin = (text) => /^\d{4,6}$/.test(text)

function noticeFor({ creating, rol, destino }) {
  if (creating) return 'Crea tu cuenta para contar tus historias.'
  if (destino === '/contar' || destino === '/mis-historias') return 'Para contar una historia necesitas ingresar.'
  if (rol === 'administrador') return 'Esta sección es solo para administradores.'
  return 'Escribe tu usuario y tu contraseña.'
}

/**
 * One sign-in for everybody: a user name and a password, with «¿No tienes cuenta? Crea una» below.
 * The account says whether it belongs to a narrator or to the team, so nobody has to choose.
 * (A narrator's user name is the mobile number and the password is the short PIN.)
 */
function LoginForm({ rol, destino, onClose }) {
  const [creating, setCreating] = useState(false)
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [nombre, setNombre] = useState('')
  const [celular, setCelular] = useState('')
  const [pin, setPin] = useState('')
  const { busy, error, clearError, registerNarrator, signIn } = useSignIn()
  const formRef = useRef(null)
  const switched = useRef(false)

  const canSubmit = creating
    ? nombre.trim().length >= 2 && digits(celular).length >= 10 && isPin(pin)
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
    if (creating) registerNarrator({ nombre: nombre.trim(), celular, pin })
    else signIn({ usuario: usuario.trim(), clave })
  }

  const change = (setter) => (event) => {
    clearError()
    setter(event.target.value)
  }

  return (
    <Modal open onClose={onClose} label={creating ? 'Crear cuenta' : 'Ingresar'} maxWidth={488} level={55} top={60} className="ag-login">
      <div className="ag-login__head">
        <div>
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
            <Field label="Tu nombre">
              <input className="ag-input" type="text" autoComplete="name" value={nombre} onChange={change(setNombre)} />
            </Field>
            <Field label="Número de celular">
              <input className="ag-input" type="tel" inputMode="tel" autoComplete="tel" value={celular} onChange={change(setCelular)} />
            </Field>
            <Field label="Elige una clave de 4 a 6 números">
              <input
                className="ag-input"
                // A new PIN is shown so it is not mistyped; a returning one is hidden.
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="new-password"
                value={pin}
                onChange={change(setPin)}
              />
            </Field>
            <span className="ag-hint">
              Sin correo: solo tu celular y una clave corta. Elige números que recuerdes; se ven para que no te equivoques.
            </span>
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
              <input className="ag-input" type="password" autoComplete="current-password" value={clave} onChange={change(setClave)} />
            </Field>
            <span className="ag-hint">Si cuentas historias, tu usuario es tu número de celular y tu contraseña es tu clave de 4 a 6 números.</span>
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
