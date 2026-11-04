import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { registerNarrator, signIn } from '../../services/auth.js'
import { ApiError, OfflineError } from '../../services/http.js'

const firstName = (name) => name.split(' ')[0]

/** Sign-up / sign-in actions shared by the dialog and the admin card. */
export default function useSignIn() {
  const { startSession, closeLogin, login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(call, welcome) {
    setBusy(true)
    setError('')
    try {
      const session = await call()
      startSession(session)
      closeLogin()
      toast(welcome(session.usuario))
      if (login.destino) navigate(login.destino)
    } catch (failure) {
      if (failure instanceof OfflineError) setError('Sin señal: necesitas conexión para ingresar.')
      else if (failure instanceof ApiError) setError(failure.message)
      else setError('No pudimos ingresar. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const greet = (usuario) => `Hola, ${firstName(usuario.nombre)}. Ya puedes contar tus historias.`

  return {
    busy,
    error,
    clearError: () => setError(''),
    registerNarrator: (fields) => run(() => registerNarrator(fields), greet),
    signInNarrator: ({ celular, pin }) => run(() => signIn({ rol: 'narrador', usuario: celular, clave: pin }), greet),
    signInAdmin: ({ usuario, clave }) =>
      run(() => signIn({ rol: 'administrador', usuario, clave }), () => 'Ingresaste como administrador.'),
  }
}
