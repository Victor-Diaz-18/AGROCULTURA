import { Outlet } from 'react-router-dom'
import useFocusOnNavigation from '../../hooks/useFocusOnNavigation.js'
import Header from './Header.jsx'
import SideMenu from './SideMenu.jsx'

/** Frame of the public portal and the narrator area: header, side menu and page. */
export default function PortalShell() {
  useFocusOnNavigation()
  return (
    <div className="ag-app">
      <a href="#contenido" className="ag-skip">
        Saltar al contenido
      </a>
      <Header />
      <div className="ag-body">
        <SideMenu />
        <main id="contenido" tabIndex={-1} className="ag-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
