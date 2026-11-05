import { useAuth } from '../../context/AuthContext.jsx'
import usePageTitle from '../../hooks/usePageTitle.js'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import ListenButton from '../ui/ListenButton.jsx'

/** Only what there is: a kind of story nobody has told yet is not announced as "0 con video". */
function factsFrom(stats) {
  return [
    [stats.publicadas, stats.publicadas === 1 ? 'historia publicada' : 'historias publicadas'],
    [stats.sectores_con_historias, stats.sectores_con_historias === 1 ? 'sector' : 'sectores'],
    [stats.formatos.audio, 'con audio'],
    [stats.formatos.foto, 'con foto'],
    [stats.formatos.video, 'con video'],
  ].filter(([value]) => value > 0)
}

/**
 * The first thing someone without an account reads: what this is, what they can do without signing in, and how much there is.
 * It takes the place of the page header and the counters of the signed-in view.
 */
export default function VisitorIntro({ sectors, stats, readAloud }) {
  const { openLogin } = useAuth()
  usePageTitle('Mapa de historias')
  const facts = factsFrom(stats)

  return (
    <section className="ag-vhero">
      <div className="ag-vhero__inner">
        {sectors.length > 0 && <p className="ag-vhero__places">{sectors.map((sector) => sector.nombre).join(' · ')}</p>}
        <h1 tabIndex={-1}>La memoria del café de Minca, contada por sus familias</h1>
        <p className="ag-vhero__lead">
          Escucha sus voces, mira sus fotos y lee sus relatos, guardados en un mapa. Para explorar no necesitas una cuenta.
        </p>
        <div className="ag-vhero__actions">
          <a href="#mapa" className="ag-btn ag-vhero__explore">
            <Icon name="mapa" size={18} />
            Explorar el mapa
          </a>
          <Button variant="primary" icon="mas" onClick={() => openLogin({ rol: 'narrador', destino: '/contar' })}>
            Contar una historia
          </Button>
          <ListenButton title="Mapa de historias" text={readAloud} />
        </div>
        {facts.length > 0 && (
          <ul className="ag-vhero__facts" aria-label="Lo que hay en el mapa">
            {facts.map(([value, label]) => (
              <li key={label}>
                <b>{value}</b> {label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

const STEPS = [
  ['mic', 'Una familia cuenta su historia', 'Con su voz, por escrito, con fotos o con video, desde el celular y aunque no haya señal en la finca.'],
  ['check', 'Una persona del equipo la revisa', 'Nada se publica sin la autorización de quien la cuenta y sin que alguien del equipo la haya leído o escuchado.'],
  ['pin', 'Queda guardada para todos', 'Cualquiera puede explorarla. Quien la cuenta decide si publica su nombre y si muestra un lugar aproximado o ninguno.'],
]

/** How a story gets here, which is also what someone needs to know before telling theirs. */
export function VisitorHowItWorks() {
  const { openLogin } = useAuth()
  return (
    <section className="ag-vhow" aria-labelledby="como-funciona">
      <h2 id="como-funciona">¿Cómo llega una historia al mapa?</h2>
      <ol className="ag-vhow__steps">
        {STEPS.map(([icon, title, text]) => (
          <li key={title}>
            <span className="ag-vhow__icon">
              <Icon name={icon} size={20} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <div className="ag-vhow__invite">
        <div>
          <h3>¿Tienes una historia del café?</h3>
          <p>Solo necesitas un nombre de usuario y una contraseña. Sin correo ni celular.</p>
        </div>
        <Button variant="primary" icon="mas" onClick={() => openLogin({ rol: 'narrador', destino: '/contar' })}>
          Contar mi historia
        </Button>
      </div>
    </section>
  )
}
