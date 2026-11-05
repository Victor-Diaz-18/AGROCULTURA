import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { registerNarrator, signIn } from '../../services/auth.js'
import { ApiError, OfflineError } from '../../services/http.js'

const firstName = (name) => name.split(' ')[0]

const welcome = (usuario) =>
  usuario.rol === 'administrador' ? 'Ingresaste como administrador.' : `Hola, ${firstName(usuario.nombre)}. Ya puedes contar tus historias.`

/** Sign-up / sign-in actions shared by the dialog and the admin card. */
export default function useSignIn() {
  const { startSession, closeLogin, login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(call) {
    setBusy(true)
    setError('')
    try {
      const session = await call()
      startSession(session)
      closeLogin()
      toast(welcome(session.usuario))
      // Go where the person was heading, unless that page is for the other kind of account (it would send them back).
      if (login.destino && (!login.rol || login.rol === session.usuario.rol)) navigate(login.destino)
    } catch (failure) {
      if (failure instanceof OfflineError) setError('Sin señal: necesitas conexión para ingresar.')
      else if (failure instanceof ApiError) setError(failure.message)
      else setError('No pudimos ingresar. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    error,
    clearError: () => setError(''),
    registerNarrator: (fields) => run(() => registerNarrator(fields)),
    signIn: ({ usuario, clave }) => run(() => signIn({ usuario, clave })),
  }
}
