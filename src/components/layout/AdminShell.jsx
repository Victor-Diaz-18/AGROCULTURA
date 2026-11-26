import { useEffect, useState } from 'react'
import logo from '../../assets/logo-temporal.png'
import { Link, Outlet, useLocation } from 'react-router-dom'
import AdminLogin from '../auth/AdminLogin.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import useFocusOnNavigation from '../../hooks/useFocusOnNavigation.js'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import Icon from '../ui/Icon.jsx'
import NavMenu from './NavMenu.jsx'
import initials from '../../utils/initials.js'

/** Frame of the administration panel (F6, F7, F12). Meant mostly for desktop. */
/**
 * «Más», only on a phone: the bar at the bottom has the three places used most; the rest of the menu opens from here.
 * The list exists only while it is open, so the menu never has the same link twice.
 */
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  return (
    <div className="ag-nav__more">
      <button type="button" className="ag-nav__item ag-nav__item--bar" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Icon name="lista" size={18} />
        <span className="ag-nav__label">Más opciones</span>
        <span className="ag-nav__short" aria-hidden="true">
          Más
        </span>
      </button>
      {open && (
        <div className="ag-nav__sheet">
          {items.map((item) => (
            <Link key={item.to} to={item.to} className="ag-nav__sheetlink">
              <Icon name={item.icon} size={18} />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminShell() {
  useFocusOnNavigation()
  const { config, stats } = usePortalData()
  const { user, role, logout } = useAuth()
  const isAdmin = role === 'administrador'

  const groups = [
    {
      title: 'GESTIÓN',
      items: [
        { to: '/admin', end: true, label: 'Resumen', icon: 'resumen', code: 'F1', bar: true, short: 'Resumen' },
        { to: '/admin/revision', label: 'Revisión', icon: 'bandeja', code: 'F6', count: stats.en_revision, alert: true, bar: true, short: 'Revisión' },
        { to: '/admin/historias', label: 'Historias del proyecto', icon: 'bandera', code: 'F12', bar: true, short: 'Historias' },
        { to: '/admin/configuracion', label: 'Configuración', icon: 'engranaje', code: 'F7' },
        { to: '/admin/narradores', label: 'Narradores', icon: 'personas' },
        { to: '/admin/papelera', label: 'Papelera', icon: 'papelera' },
        // Only the main administrator manages the others: nobody else sees this entry.
        ...(user?.principal ? [{ to: '/admin/administradores', label: 'Administradores', icon: 'usuario' }] : []),
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
            <span className="ag-admin-tag">PANEL DEL EQUIPO</span>
          </div>
        </div>
        <div className="ag-header__actions">
          <Link to="/" className="ag-public-link" aria-label="Ver portal público">
            <Icon name="mapa" size={16} />
            <span>Ver portal público</span>
          </Link>
          {isAdmin && (
            <div className="ag-user">
              <div className="ag-user__avatar">{initials(user.nombre)}</div>
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
          >
            <MoreMenu items={groups.flatMap((group) => group.items).filter((item) => !item.bar)} />
          </NavMenu>
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
