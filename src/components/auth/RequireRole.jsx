import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

/**
 * Lets a page through only for one role. Anyone else goes back to the map; when they
 * ARRIVE at the page (a link, a typed address) the sign-in dialog opens for that role.
 * Signing out while on the page just goes back without opening the dialog.
 */
export default function RequireRole({ role: needed, children }) {
  const { role, openLogin } = useAuth()
  const { pathname } = useLocation()
  const allowed = role === needed

  useEffect(() => {
    if (!allowed) openLogin({ rol: needed, destino: pathname })
    // Only on arrival: a later sign-out must not reopen the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return allowed ? children : <Navigate to="/" replace />
}
