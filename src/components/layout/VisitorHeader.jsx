import logo from '../../assets/logo-temporal.png'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'
import Icon from '../ui/Icon.jsx'

/**
 * What someone without an account sees on top: who this is, where to go and how to sign in. The counters of the team and
 * the demo switch belong to the signed-in header. The switch only comes back here while it is on (someone turned it on and
 * signed out), or there would be no way to turn it off; a real loss of signal is just said.
 */
export default function VisitorHeader() {
  const { config } = usePortalData()
  const { online, simulatedOffline, toggleSimulated } = useConnectivity()
  const { openLogin } = useAuth()
  const { pathname } = useLocation()

  const askToTell = (event) => {
    event.preventDefault()
    openLogin({ rol: 'narrador', destino: '/contar' })
  }

  return (
    <header className={`ag-header ag-header--visitor${pathname === '/' ? ' ag-header--over-photo' : ''}`}>
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
        <nav aria-label="Secciones" className="ag-vnav">
          <NavLink to="/" end className="ag-vnav__item">
            Mapa de historias
          </NavLink>
          <NavLink to="/contar" className="ag-vnav__item" onClick={askToTell}>
            Contar una historia
          </NavLink>
        </nav>

        {simulatedOffline ? (
          <button type="button" className="ag-hchip ag-hchip--toggle" aria-pressed data-offline="true" onClick={toggleSimulated}>
            <span className="ag-hchip__dot" />
            <span className="ag-hchip__text">
              <span className="ag-hchip__label">Simular conexión</span>
              <span className="ag-hchip__value">Sin señal</span>
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

        <button type="button" className="ag-login-btn" onClick={() => openLogin()}>
          <Icon name="usuario" size={18} />
          <span>Ingresar</span>
        </button>
      </div>
    </header>
  )
}
