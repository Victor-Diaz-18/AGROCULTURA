import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import useFocusOnNavigation from '../../hooks/useFocusOnNavigation.js'
import VisitorFooter from './VisitorFooter.jsx'
import VisitorHeader from './VisitorHeader.jsx'

/**
 * Frame of the public portal and the narrator area. The team gets the working frame (header with counters and side menu); a
 * visitor and a narrator get the lighter one, with no menu of things they cannot use. The page stays in the same place of the tree
 * either way, so signing in does not reload the map or lose the filters.
 */
export default function PortalShell() {
  const { user, role } = useAuth()
  useFocusOnNavigation()
  // The visitor and the narrator share the light frame and its look; only the team keeps the working frame with the side menu.
  const light = true // the portal looks the same for everybody; the team works in its own panel (/admin)
  return (
    <div className={`ag-app${light ? ' ag-app--visitor' : ''}${role === 'narrador' ? ' ag-app--narrator' : ''}`}>
      <a href="#contenido" className="ag-skip">
        Saltar al contenido
      </a>
      <VisitorHeader />
      <div className="ag-body">
        <main id="contenido" tabIndex={-1} className="ag-main">
          <Outlet />
        </main>
      </div>
      {light && <VisitorFooter />}
    </div>
  )
}
