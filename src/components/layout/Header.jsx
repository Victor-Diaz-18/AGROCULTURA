import logo from '../../assets/logo-temporal.png'
import { SHOW_CODES } from '../../config/flags.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'
import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** Portal header: name, public counters, the "Simular conexión" demo switch and the user. */
export default function Header() {
  const { config, stats } = usePortalData()
  const { online, simulatedOffline, toggleSimulated } = useConnectivity()
  const { user, role, openLogin, logout } = useAuth()

  const subtitle =
    'Memoria cafetera de Minca y sectores aledaños' + (config.portal.datos_de_ejemplo ? ' · datos de ejemplo' : '')
  const isAdmin = role === 'administrador'

  return (
    <header className="ag-header">
      <div className="ag-brand">
        <div className="ag-brand__logo">
          <img src={logo} alt="" />
        </div>
        <div className="ag-brand__text">
          <span className="ag-brand__name">{config.portal.nombre}</span>
          <span className="ag-brand__sub">{subtitle}</span>
        </div>
      </div>

      <div className="ag-header__right">
        <div className="ag-hchip">
          <Icon name="pin" size={16} />
          <div className="ag-hchip__text">
            <span className="ag-hchip__label">Historias en el portal</span>
            <span className="ag-hchip__value">{stats.publicadas} publicadas</span>
          </div>
        </div>

        <div className="ag-hchip">
          <span className="ag-hchip__dot" style={{ background: 'var(--amarillo)' }} />
          <div className="ag-hchip__text">
            <span className="ag-hchip__label">Esperando revisión</span>
            <span className="ag-hchip__value">{stats.en_revision} historias</span>
          </div>
        </div>

        <button
          type="button"
          className="ag-hchip ag-hchip--toggle"
          aria-pressed={simulatedOffline}
          data-offline={!online}
          onClick={toggleSimulated}
        >
          <span className="ag-hchip__dot" />
          <span className="ag-hchip__text">
            <span className="ag-hchip__label">Simular conexión{SHOW_CODES && ' · F10'}</span>
            <span className="ag-hchip__value">{online ? 'En línea' : 'Sin señal'}</span>
          </span>
        </button>

        <span className="ag-header__divider" />

        {user ? (
          <div className="ag-user">
            <div className="ag-user__avatar">{isAdmin ? 'AD' : initials(user.nombre)}</div>
            <div className="ag-user__text">
              <span className="ag-user__name">{isAdmin ? 'Administración' : user.nombre}</span>
              <span className="ag-user__role">
                {isAdmin ? 'Administrador' : 'Narrador'}
                {SHOW_CODES && (isAdmin ? ' · F7' : ' · F2')}
              </span>
            </div>
            <button type="button" className="ag-user__out" onClick={logout}>
              Salir
            </button>
          </div>
        ) : (
          <button type="button" className="ag-login-btn" onClick={() => openLogin()}>
            <Icon name="usuario" size={18} />
            <span>Ingresar</span>
            <FCode>F2</FCode>
          </button>
        )}
      </div>
    </header>
  )
}
