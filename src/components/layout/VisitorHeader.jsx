import logo from '../../assets/logo-temporal.png'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useMyStories } from '../../context/MyStoriesContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'
import Icon from '../ui/Icon.jsx'

/**
 * The header of the public pages (visitors, narrators and the team): who this is, where to go and how to sign in. A real
 * loss of signal is said to everybody. There is no switch to pretend the signal is gone: a family would take it for a
 * real setting (it was «Simular conexión», removed on 24 Nov 2026).
 */
function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export default function VisitorHeader() {
  const { config } = usePortalData()
  const { online } = useConnectivity()
  const { user, role, openLogin, logout } = useAuth()
  const narrator = role === 'narrador'
  const team = role === 'administrador'
  const signedIn = narrator || team
  const { stories } = useMyStories()
  const { pathname } = useLocation()

  const askToTell = (event) => {
    event.preventDefault()
    openLogin({ rol: 'narrador', destino: '/contar' })
  }

  return (
    <header className={`ag-header ag-header--visitor${narrator ? ' ag-header--narrator' : ''}${team ? ' ag-header--team' : ''}${pathname === '/' ? ' ag-header--over-photo' : ''}`}>
      <Link to="/" className="ag-brand ag-brand--link">
        <span className="ag-brand__logo">
          <img src={logo} alt="" />
        </span>
        <span className="ag-brand__text">
          <span className="ag-brand__name">{config.portal.nombre}</span>
          <span className="ag-brand__sub ag-brand__sub--wide">Memoria cafetera de Minca y sectores aledaños</span>
        </span>
      </Link>

      <div className="ag-header__right">
        {/* On a phone the narrator's menu becomes a bar fixed at the bottom of the screen, with big buttons. */}
        <nav aria-label="Secciones" className="ag-vnav">
          <NavLink to="/" end className="ag-vnav__item">
            {narrator && <Icon name="mapa" size={20} />}
            <span>Mapa de historias</span>
          </NavLink>
          {!team && (
            <NavLink to="/contar" className="ag-vnav__item" onClick={narrator ? undefined : askToTell}>
              {narrator && <Icon name="mic" size={20} />}
              <span>Contar una historia</span>
            </NavLink>
          )}
          {team && (
            <NavLink to="/admin" className="ag-vnav__item ag-vnav__item--panel" aria-label="Panel del equipo">
              <Icon name="inicio" size={18} />
              <span>
                Panel<span className="ag-vnav__wide"> del equipo</span>
              </span>
            </NavLink>
          )}
          {narrator && (
            <NavLink to="/mis-historias" className="ag-vnav__item">
              <Icon name="lista" size={20} />
              <span>Mis historias</span>
              {stories?.length > 0 && <span className="ag-vnav__count">{stories.length}</span>}
            </NavLink>
          )}
        </nav>

        {!online && (
          <span className="ag-hchip ag-hchip--offline">
            <span className="ag-hchip__dot" />
            <span className="ag-hchip__value">Sin señal</span>
          </span>
        )}

        {signedIn ? (
          <div className="ag-vuser">
            <span className="ag-vuser__avatar" aria-hidden="true">
              {initials(user.nombre)}
            </span>
            <span className="ag-vuser__name">{user.nombre}</span>
            <button type="button" className="ag-vuser__out" onClick={logout}>
              Salir
            </button>
          </div>
        ) : (
          <button type="button" className="ag-login-btn" onClick={() => openLogin()}>
            <Icon name="usuario" size={18} />
            <span>Ingresar</span>
          </button>
        )}
      </div>
    </header>
  )
}
