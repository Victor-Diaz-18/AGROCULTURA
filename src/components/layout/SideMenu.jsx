import { SHOW_CODES } from '../../config/flags.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import Icon from '../ui/Icon.jsx'
import NavMenu from './NavMenu.jsx'

/** Portal side menu. Administration entries show a lock until an administrator signs in. */
export default function SideMenu() {
  const { stats } = usePortalData()
  const { role } = useAuth()
  const locked = role !== 'administrador'

  const groups = [
    {
      title: 'EXPLORAR',
      items: [{ to: '/', end: true, label: 'Mapa de historias', icon: 'mapa', code: 'F1', count: stats.publicadas }],
    },
    {
      title: 'NARRADOR',
      items: [
        { to: '/contar', label: 'Contar una historia', icon: 'mic', code: 'F3' },
        { to: '/mis-historias', label: 'Mis historias', icon: 'lista', code: 'F10' },
      ],
    },
    {
      title: 'ADMINISTRACIÓN',
      items: [
        { to: '/revision', label: 'Revisión', icon: 'bandeja', code: 'F6', count: stats.en_revision, alert: true, locked },
        { to: '/historias-propias', label: 'Historias propias', icon: 'bandera', code: 'F12', locked },
        { to: '/configuracion', label: 'Configuración', icon: 'engranaje', code: 'F7', locked },
      ],
    },
    {
      title: 'PRÓXIMAMENTE',
      items: [
        { to: '/proximamente/360', label: 'Recorridos 360°', icon: 'globo', code: 'F14', future: true },
        { to: '/proximamente/ra', label: 'Avatares en RA', icon: 'avatar', code: 'F15', future: true },
      ],
    },
  ]

  return (
    <NavMenu groups={groups} ariaLabel="Secciones">
      <div className="ag-nav__voice">
        <div className="ag-nav__voice-title">
          <Icon name="altavoz" size={16} />
          <span>Voz e íconos</span>
          {SHOW_CODES && <span className="ag-fcode" style={{ flex: 'none' }}>F9</span>}
        </div>
        <div className="ag-nav__voice-text">Cada página tiene un botón «Escuchar» que la lee en voz alta.</div>
      </div>
    </NavMenu>
  )
}
