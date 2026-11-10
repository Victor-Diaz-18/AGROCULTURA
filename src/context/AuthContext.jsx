import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useConnectivity from '../hooks/useConnectivity.js'
import { fetchMe } from '../services/auth.js'
import { ApiError } from '../services/http.js'
import { clearSession, loadSession, saveSession } from '../services/session.js'
import { useToast } from './ToastContext.jsx'

/**
 * Who is using the app: a visitor, a narrator or an administrator.
 *
 * The session is restored from the browser at start-up without any network, so a
 * narrator keeps working with no signal. When there is signal it is checked with
 * the server; only an explicit 401 ends it (being offline never does).
 */

const AuthContext = createContext({
  user: null,
  role: 'visitante',
  token: null,
  login: { open: false, rol: null, destino: null, nonce: 0 },
  openLogin: () => {},
  closeLogin: () => {},
  startSession: () => {},
  logout: () => {},
})

/** Pages that need a session: signing out on one of them goes back to the map. */
const PROTECTED_PATHS = ['/contar', '/mis-historias', '/revision', '/historias-propias', '/configuracion', '/administradores']

export function AuthProvider({ children }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { online } = useConnectivity()
  const [session, setSession] = useState(() => loadSession())
  const [login, setLogin] = useState({ open: false, rol: null, destino: null, nonce: 0 })

  const user = session?.user ?? null
  const token = session?.token ?? null
  const role = user?.rol ?? 'visitante'

  const endSession = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  // With signal: confirm the saved session is still valid and refresh the profile.
  useEffect(() => {
    if (!token || !online) return undefined
    let cancelled = false
    fetchMe()
      .then((me) => {
        if (cancelled) return
        saveSession({ token, user: me })
        setSession({ token, user: me })
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiError && error.status === 401) endSession()
      })
    return () => {
      cancelled = true
    }
  }, [token, online, endSession])

  const startSession = useCallback(({ token: newToken, usuario }) => {
    saveSession({ token: newToken, user: usuario })
    setSession({ token: newToken, user: usuario })
  }, [])

  // `rol` is the kind of account the page being opened needs, if any; it only changes what the dialog says.
  const openLogin = useCallback(
    ({ rol = null, destino = null } = {}) => setLogin((current) => ({ open: true, rol, destino, nonce: current.nonce + 1 })),
    [],
  )
  const closeLogin = useCallback(() => setLogin((current) => ({ ...current, open: false })), [])

  const logout = useCallback(() => {
    endSession()
    toast('Sesión cerrada.', 'info')
    if (PROTECTED_PATHS.some((path) => pathname.startsWith(path))) navigate('/')
  }, [endSession, toast, navigate, pathname])

  const value = useMemo(
    () => ({ user, role, token, login, openLogin, closeLogin, startSession, logout }),
    [user, role, token, login, openLogin, closeLogin, startSession, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
