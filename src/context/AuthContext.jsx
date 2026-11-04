import { createContext, useContext, useMemo } from 'react'
import { useToast } from './ToastContext.jsx'

/**
 * Who is using the app: a visitor, a narrator or an administrator.
 * Registration and sign-in arrive with F2 (next block); until then everyone is a visitor.
 */

const AuthContext = createContext({
  user: null,
  role: 'visitante',
  openLogin: () => {},
  logout: () => {},
})

export function AuthProvider({ children }) {
  const toast = useToast()
  const value = useMemo(
    () => ({
      user: null,
      role: 'visitante',
      openLogin: () => toast('El ingreso todavía no está disponible.', 'info'),
      logout: () => {},
    }),
    [toast],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
