import logo from '../../assets/logo-temporal.png'
import { Link, Outlet } from 'react-router-dom'
import AdminLogin from '../auth/AdminLogin.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import useFocusOnNavigation from '../../hooks/useFocusOnNavigation.js'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import Icon from '../ui/Icon.jsx'
import NavMenu from './NavMenu.jsx'

/** Frame of the administration panel (F6, F7, F12). Meant mostly for desktop. */
export default function AdminShell() {
  useFocusOnNavigation()
  const { config, stats } = usePortalData()
  const { user, role, logout } = useAuth()
  const isAdmin = role === 'administrador'

  const groups = [
    {
      title: 'GESTIÓN',
      items: [
        { to: '/admin', end: true, label: 'Resumen', icon: 'resumen', code: 'F1' },
        { to: '/admin/revision', label: 'Revisión', icon: 'bandeja', code: 'F6', count: stats.en_revision, alert: true },
        { to: '/admin/historias', label: 'Historias del proyecto', icon: 'bandera', code: 'F12' },
        { to: '/admin/configuracion', label: 'Configuración', icon: 'engranaje', code: 'F7' },
        { to: '/admin/administradores', label: 'Administradores', icon: 'usuario' },
      ],
    },
    {
      title: 'PRÓXIMAMENTE',
      items: [
        { to: '/admin/proximamente/360', label: 'Recorridos 360°', icon: 'globo', code: 'F14', future: true },
        { to: '/admin/proximamente/ra', label: 'Avatares en RA', icon: 'avatar', code: 'F15', future: true },
      ],
    },
  ]

  return (
    <div className="ag-app ag-app--admin">
      {isAdmin && (
        <a href="#contenido" className="ag-skip">
          Saltar al contenido
        </a>
      )}
      <header className="ag-header ag-header--admin">
        <div className="ag-brand">
          <div className="ag-brand__logo">
            <img src={logo} alt="" />
          </div>
          <div className="ag-brand__line">
            <span className="ag-brand__name">{config.portal.nombre}</span>
            <span className="ag-admin-tag">ADMINISTRACIÓN</span>
          </div>
        </div>
        <div className="ag-header__actions">
          <Link to="/" className="ag-public-link">
            <Icon name="enlace-externo" size={15} />
            Ver portal público
          </Link>
          {isAdmin && (
            <div className="ag-user">
              <div className="ag-user__avatar">AD</div>
              <div className="ag-user__text">
                <span className="ag-user__name">{user.nombre}</span>
                <span className="ag-user__role">Administrador</span>
              </div>
              <button type="button" className="ag-user__out" onClick={logout}>
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      {isAdmin ? (
        <div className="ag-body">
          <NavMenu
            groups={groups}
            variant="admin"
            ariaLabel="Secciones de administración"
            top={
              <Link to="/admin/historias?nueva=1" className="ag-nav__create">
                <Icon name="mas" size={18} strokeWidth={2.4} />
                <span>Crear historia</span>
              </Link>
            }
          />
          <main id="contenido" tabIndex={-1} className="ag-main">
            <Outlet />
          </main>
        </div>
      ) : (
        <AdminLogin />
      )}
    </div>
  )
}
