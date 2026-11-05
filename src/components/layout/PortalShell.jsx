import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import useFocusOnNavigation from '../../hooks/useFocusOnNavigation.js'
import Header from './Header.jsx'
import SideMenu from './SideMenu.jsx'
import VisitorFooter from './VisitorFooter.jsx'
import VisitorHeader from './VisitorHeader.jsx'

/**
 * Frame of the public portal and the narrator area. A signed-in person gets the working frame (header with counters and side
 * menu); a visitor gets a lighter one, with no menu of things they cannot use. The page stays in the same place of the tree
 * either way, so signing in does not reload the map or lose the filters.
 */
export default function PortalShell() {
  const { user } = useAuth()
  useFocusOnNavigation()
  return (
    <div className={`ag-app${user ? '' : ' ag-app--visitor'}`}>
      <a href="#contenido" className="ag-skip">
        Saltar al contenido
      </a>
      {user ? <Header /> : <VisitorHeader />}
      <div className="ag-body">
        {user && <SideMenu />}
        <main id="contenido" tabIndex={-1} className="ag-main">
          <Outlet />
        </main>
      </div>
      {!user && <VisitorFooter />}
    </div>
  )
}
