import { Navigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Icon from '../../components/ui/Icon.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'

/** Features of future phases. They are announced here but not built (F14, F15). */
const FUTURE = {
  360: {
    title: 'Recorridos 360°',
    code: 'F14',
    what: 'Mostrar un lugar en imagen 360 desde la ficha de la historia.',
    origin: 'Asesoría',
    note: 'Se vería dentro de la ficha (F8) y se subiría junto con la historia (F3).',
    deps: [
      ['F8', 'Ficha de historia'],
      ['F3', 'Subir historia'],
    ],
  },
  ra: {
    title: 'Avatares en realidad aumentada',
    code: 'F15',
    what: 'Presentar a un narrador como avatar en realidad aumentada.',
    origin: 'Ejemplo del profesor',
    note: 'Necesita contenido grabado con audio (F5) o video (F13) y se abriría desde la ficha (F8).',
    deps: [
      ['F8', 'Ficha de historia'],
      ['F5', 'Audio'],
      ['F13', 'Video'],
    ],
  },
}

export default function FuturePage({ variant = 'portal' }) {
  const { id } = useParams()
  const feature = FUTURE[id]
  if (!feature) return <Navigate to={variant === 'admin' ? '/admin' : '/'} replace />

  const readAloud = `${feature.title}. Fase futura. ${feature.what} No se construye en esta entrega. ${feature.note}`

  return (
    <>
      <PageHeader
        title={feature.title}
        badge={<span className="ag-future-tag">FASE FUTURA · {feature.code}</span>}
        subtitle={feature.what}
        actions={variant === 'portal' ? <ListenButton title={feature.title} text={readAloud} /> : null}
      />
      <div className="ag-future">
        <div className="ag-future__box">
          <Icon name="globo" size={44} strokeWidth={1.6} />
          <b>No se construye en esta entrega</b>
          <span>{feature.note}</span>
        </div>
        <div className="ag-future__deps">
          <span className="ag-future__deps-title">DEPENDE DE</span>
          {feature.deps.map(([code, name]) => (
            <div key={code} className="ag-future__dep">
              <code>{code}</code>
              <span>{name}</span>
            </div>
          ))}
          <span className="ag-future__origin">Origen: {feature.origin}</span>
        </div>
      </div>
    </>
  )
}
