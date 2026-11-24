import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useMyStories } from '../context/MyStoriesContext.jsx'
import { usePortalData } from '../context/PortalDataContext.jsx'
import usePageTitle from '../hooks/usePageTitle.js'
import Icon from '../components/ui/Icon.jsx'
import ListenButton from '../components/ui/ListenButton.jsx'

/**
 * «Inicio»: what a signed-in person can do, as big cards with an illustrated icon, so nobody has to look for it in a menu.
 * It is where a narrator or an administrator lands after signing in. Each card says what it does in plain words.
 */
function actionsFor(who, { myStories, waiting, principal }) {
  if (who === 'admin') {
    return [
      { to: '/admin/revision', icon: 'bandeja', tone: 'amarillo', title: 'Revisar historias', text: 'Lee, escucha y aprueba lo que mandaron las familias.', count: waiting },
      { to: '/admin/historias?nueva=1', icon: 'mas', tone: 'rojo', title: 'Crear una historia del proyecto', text: 'Publica una historia que recogió el equipo.' },
      { to: '/admin/historias', icon: 'bandera', tone: 'azul', title: 'Historias del proyecto', text: 'Mira las que ha publicado el equipo.' },
      { to: '/admin', icon: 'resumen', tone: 'verde', title: 'Ver el resumen', text: 'Cuántas historias hay y qué necesita atención.' },
      { to: '/', icon: 'mapa', tone: 'azul', title: 'Ver el mapa público', text: 'Así ven el portal las familias y los visitantes.' },
      { to: '/admin/configuracion', icon: 'engranaje', tone: 'cafe', title: 'Configuración', text: 'Nombre del portal, sectores y etiquetas.' },
      { to: '/admin/narradores', icon: 'personas', tone: 'verde', title: 'Narradores', text: 'Dale una contraseña nueva a una familia que olvidó la suya.' },
      ...(principal ? [{ to: '/admin/administradores', icon: 'usuario', tone: 'cafe', title: 'Administradores', text: 'Quién puede entrar al panel del equipo.' }] : []),
    ]
  }
  return [
    { to: '/contar', icon: 'mic', tone: 'rojo', title: 'Contar una nueva historia', text: 'Con tu voz, por escrito, con fotos o con video.' },
    { to: '/', icon: 'mapa', tone: 'azul', title: 'Ver el mapa de historias', text: 'Escucha y lee lo que han contado las familias.' },
    { to: '/mis-historias', icon: 'lista', tone: 'amarillo', title: 'Revisar mis historias', text: 'Mira en qué va cada historia que contaste.', count: myStories },
  ]
}

export default function LauncherPage({ who = 'narrador' }) {
  const { user } = useAuth()
  const { stories } = useMyStories()
  const { stats } = usePortalData()
  usePageTitle('Inicio')
  const actions = actionsFor(who, { myStories: stories?.length ?? 0, waiting: stats.en_revision, principal: user?.principal })
  const firstName = (user?.nombre ?? '').split(' ')[0]
  const readAloud = () => ['¿Qué quieres hacer?', ...actions.map((action) => `${action.title}. ${action.text}`)].join(' ')

  return (
    <section className="ag-launch" aria-labelledby="ag-launch-title">
      <div className="ag-launch__head">
        <div>
          <h1 id="ag-launch-title" tabIndex={-1}>
            Hola{firstName ? `, ${firstName}` : ''}
          </h1>
          <p>¿Qué quieres hacer?</p>
        </div>
        <ListenButton title="Inicio" text={readAloud} />
      </div>
      <ul className="ag-launch__grid">
        {actions.map((action) => (
          <li key={action.title}>
            <Link to={action.to} className={`ag-launch__card ag-launch__card--${action.tone}`}>
              <span className="ag-launch__art" aria-hidden="true">
                <Icon name={action.icon} size={34} strokeWidth={1.8} />
              </span>
              <span className="ag-launch__text">
                <b>{action.title}</b>
                <span>{action.text}</span>
              </span>
              {action.count > 0 && (
                <span className="ag-launch__count" aria-label={`${action.count} en total`}>
                  {action.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
