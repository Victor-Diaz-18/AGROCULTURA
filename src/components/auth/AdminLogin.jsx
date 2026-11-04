import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import FCode from '../ui/FCode.jsx'
import Field from '../ui/Field.jsx'
import useSignIn from './useSignIn.js'

/** "Acceso del equipo": what /admin shows until an administrator signs in. */
export default function AdminLogin() {
  const { user } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const { busy, error, clearError, signInAdmin } = useSignIn()
  const canSubmit = usuario.trim() !== '' && clave !== ''

  const submit = (event) => {
    event.preventDefault()
    if (canSubmit && !busy) signInAdmin({ usuario: usuario.trim(), clave })
  }
  const change = (setter) => (event) => {
    clearError()
    setter(event.target.value)
  }

  return (
    <div className="ag-adminlogin-wrap">
      <form className="ag-adminlogin" onSubmit={submit} noValidate>
        <div className="ag-adminlogin__head">
          <div className="ag-adminlogin__title">
            <h1>Acceso del equipo</h1>
            <FCode>F7</FCode>
          </div>
          <span className="ag-adminlogin__text">
            Solo para administradores: revisar historias, publicar las del proyecto y configurar el portal.
          </span>
          {user && (
            <span className="ag-adminlogin__text">
              <b>Ingresaste como narrador.</b> Esta sección es solo para administradores.
            </span>
          )}
        </div>
        <Field label="Usuario">
          <input className="ag-input" type="text" autoComplete="username" value={usuario} onChange={change(setUsuario)} />
        </Field>
        <Field label="Contraseña">
          <input className="ag-input" type="password" autoComplete="current-password" value={clave} onChange={change(setClave)} />
        </Field>
        {error && (
          <div role="alert" className="ag-error">
            {error}
          </div>
        )}
        <button type="submit" className="ag-submit" disabled={!canSubmit || busy}>
          Ingresar
        </button>
      </form>
    </div>
  )
}
