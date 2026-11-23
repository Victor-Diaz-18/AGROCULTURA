import logo from '../../assets/logo-temporal.png'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useMyStories } from '../../context/MyStoriesContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'
import Icon from '../ui/Icon.jsx'

/**
 * What someone without an account sees on top: who this is, where to go and how to sign in. The counters of the team and
 * the demo switch belong to the signed-in header. The switch only comes back here while it is on (someone turned it on and
 * signed out), or there would be no way to turn it off; a real loss of signal is just said.
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
  const { online, simulatedOffline, toggleSimulated } = useConnectivity()
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
    <header className={`ag-header ag-header--visitor${narrator ? ' ag-header--narrator' : ''}${pathname === '/' ? ' ag-header--over-photo' : ''}`}>
      <Link to="/" className="ag-brand ag-brand--link">
        <span className="ag-brand__logo">
          <img src={logo} alt="" />
        </span>
        <span className="ag-brand__text">
          <span className="ag-brand__name">{config.portal.nombre}</span>
          <span className="ag-brand__sub ag-brand__sub--wide">Memoria cafetera de Minca y sectores aledaños</span>
          {config.portal.datos_de_ejemplo && <span className="ag-brand__sub">Datos de ejemplo</span>}
        </span>
      </Link>

      <div className="ag-header__right">
        {/* On a phone the narrator's menu becomes a bar fixed at the bottom of the screen, with big buttons. */}
        <nav aria-label="Secciones" className="ag-vnav">
          {narrator && (
            <NavLink to="/inicio" className="ag-vnav__item">
              <Icon name="inicio" size={20} />
              <span>Inicio</span>
            </NavLink>
          )}
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
            <NavLink to="/admin/inicio" className="ag-vnav__item">
              <Icon name="inicio" size={18} />
              <span>Panel del equipo</span>
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

        {/* The narrator keeps the demo switch: the team shows with it how a story is kept with no signal. A visitor only sees it while it is on. */}
        {signedIn || simulatedOffline ? (
          <button type="button" className="ag-hchip ag-hchip--toggle ag-hchip--compact" aria-pressed={simulatedOffline} data-offline={!online} onClick={toggleSimulated}>
            <span className="ag-hchip__dot" />
            <span className="ag-hchip__text">
              <span className="ag-hchip__label">Simular conexión</span>
              <span className="ag-hchip__value">{online ? 'En línea' : 'Sin señal'}</span>
            </span>
          </button>
        ) : (
          !online && (
            <span className="ag-hchip ag-hchip--toggle" data-offline="true">
              <span className="ag-hchip__dot" />
              <span className="ag-hchip__value">Sin señal</span>
            </span>
          )
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
