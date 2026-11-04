import { useState } from 'react'
import { SHOW_CODES } from '../../config/flags.js'
import { useAuth } from '../../context/AuthContext.jsx'
import Field from '../ui/Field.jsx'
import Icon from '../ui/Icon.jsx'
import Modal from '../ui/Modal.jsx'
import SegmentedTabs from '../ui/SegmentedTabs.jsx'
import useSignIn from './useSignIn.js'

const digits = (text) => text.replace(/\D/g, '')
const isPin = (text) => /^\d{4,6}$/.test(text)

function noticeFor(tab, destino) {
  if (destino === '/contar' || destino === '/mis-historias') return 'Para contar una historia necesitas ingresar.'
  if (tab === 'administrador') return 'Esta sección es solo para administradores.'
  return 'Elige cómo vas a usar la plataforma.'
}

function LoginForm({ initialTab, destino, onClose }) {
  const [tab, setTab] = useState(initialTab)
  const [mode, setMode] = useState('nueva') // narrators: "nueva" (first time) or "existente"
  const [nombre, setNombre] = useState('')
  const [celular, setCelular] = useState('')
  const [pin, setPin] = useState('')
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const { busy, error, clearError, registerNarrator, signInNarrator, signInAdmin } = useSignIn()

  const narrator = tab === 'narrador'
  const creating = narrator && mode === 'nueva'
  const canSubmit = narrator
    ? digits(celular).length >= 10 && isPin(pin) && (!creating || nombre.trim().length >= 2)
    : usuario.trim() !== '' && clave !== ''

  const submit = (event) => {
    event.preventDefault()
    if (!canSubmit || busy) return
    if (creating) registerNarrator({ nombre: nombre.trim(), celular, pin })
    else if (narrator) signInNarrator({ celular, pin })
    else signInAdmin({ usuario: usuario.trim(), clave })
  }

  const withCode = (label, code) => (SHOW_CODES ? `${label} · ${code}` : label)
  const change = (setter) => (event) => {
    clearError()
    setter(event.target.value)
  }

  return (
    <Modal open onClose={onClose} label="Ingresar" maxWidth={488} level={55} top={60} className="ag-login">
      <div className="ag-login__head">
        <div>
          <h2 className="ag-login__title">Ingresar</h2>
          <span className="ag-login__notice">{noticeFor(tab, destino)}</span>
        </div>
        <button type="button" className="ag-close" aria-label="Cerrar" onClick={onClose}>
          <Icon name="cerrar" size={16} strokeWidth={2.4} />
        </button>
      </div>

      <SegmentedTabs
        className="ag-tabs--wide"
        label="Tipo de usuario"
        value={tab}
        onChange={(next) => {
          clearError()
          setTab(next)
        }}
        items={[
          { id: 'narrador', label: withCode('Narrador', 'F2') },
          { id: 'administrador', label: withCode('Administrador', 'F7') },
        ]}
      />

      {narrator && (
        <SegmentedTabs
          className="ag-tabs--wide"
          label="¿Ya tienes cuenta?"
          value={mode}
          onChange={(next) => {
            clearError()
            setMode(next)
          }}
          items={[
            { id: 'nueva', label: 'Primera vez' },
            { id: 'existente', label: 'Ya tengo cuenta' },
          ]}
        />
      )}

      <form className="ag-login__form" onSubmit={submit} noValidate>
        {narrator ? (
          <>
            {creating && (
              <Field label="Tu nombre">
                <input className="ag-input" type="text" autoComplete="name" value={nombre} onChange={change(setNombre)} />
              </Field>
            )}
            <Field label="Número de celular">
              <input className="ag-input" type="tel" inputMode="tel" autoComplete="tel" value={celular} onChange={change(setCelular)} />
            </Field>
            <Field label={creating ? 'Elige una clave de 4 a 6 números' : 'Tu clave'}>
              <input
                className="ag-input"
                // A new PIN is shown so it is not mistyped; a returning one is hidden.
                type={creating ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete={creating ? 'new-password' : 'current-password'}
                value={pin}
                onChange={change(setPin)}
              />
            </Field>
            <span className="ag-hint">
              {creating
                ? 'Sin correo: solo tu celular y una clave corta. Elige números que recuerdes; se ven para que no te equivoques.'
                : 'Sin correo: tu celular y tu clave de 4 a 6 números.'}
            </span>
          </>
        ) : (
          <>
            <Field label="Usuario">
              <input className="ag-input" type="text" autoComplete="username" value={usuario} onChange={change(setUsuario)} />
            </Field>
            <Field label="Contraseña">
              <input className="ag-input" type="password" autoComplete="current-password" value={clave} onChange={change(setClave)} />
            </Field>
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
    </Modal>
  )
}

/** The sign-in dialog. Mounted only while open so each opening starts with a clean form. */
export default function LoginModal() {
  const { login, closeLogin } = useAuth()
  if (!login.open) return null
  return <LoginForm key={login.nonce} initialTab={login.tab} destino={login.destino} onClose={closeLogin} />
}
