import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import SideMenu from './SideMenu.jsx'

/** Frame of the public portal and the narrator area: header, side menu and page. */
export default function PortalShell() {
  return (
    <div className="ag-app">
      <Header />
      <div className="ag-body">
        <SideMenu />
        <main className="ag-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
