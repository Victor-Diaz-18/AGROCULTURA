import { Link, Navigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Icon from '../../components/ui/Icon.jsx'
import pages from '../../../lib/voice/paginas.json'
import ListenButton from '../../components/ui/ListenButton.jsx'
import { SHOW_CODES, codeNote } from '../../config/flags.js'

/** Features of future phases, in the team's side menu. They are announced here but not built (F14, F15); the public does not see them. */
const FUTURE = {
  360: {
    title: 'Recorridos 360°',
    coming: 'Pronto podrás recorrer estos lugares en 360°.',
    code: 'F14',
    what: 'Mostrar un lugar en imagen 360 desde la ficha de la historia.',
    origin: 'Asesoría',
    note: `Se vería dentro de la ficha${codeNote('F8')} y se subiría junto con la historia${codeNote('F3')}.`,
    deps: [
      ['F8', 'Ficha de historia'],
      ['F3', 'Subir historia'],
    ],
  },
  ra: {
    title: 'Avatares en realidad aumentada',
    coming: 'Pronto podrás conocer a los narradores como avatares en realidad aumentada.',
    code: 'F15',
    what: 'Presentar a un narrador como avatar en realidad aumentada.',
    note: `Necesita contenido grabado con audio${codeNote('F5')} o video${codeNote('F13')} y se abriría desde la ficha${codeNote('F8')}.`,
    deps: [
      ['F8', 'Ficha de historia'],
      ['F5', 'Audio'],
      ['F13', 'Video'],
    ],
  },
}

export default function FuturePage() {
  const { id } = useParams()
  const feature = FUTURE[id]
  if (!feature) return <Navigate to="/admin" replace />

  // What is coming, in plain words.
  return (
    <>
      <PageHeader
        title={feature.title}
        badge={<span className="ag-future-tag">PRÓXIMAMENTE</span>}
        actions={<ListenButton title={feature.title} text={pages[`proximamente-${id}`]} piece={`paginas/proximamente-${id}`} />}
      />
      <div className="ag-future__soon">
        <span className="ag-vtile">
          <Icon name="globo" size={26} />
        </span>
        <b>Estamos trabajando en esto.</b>
        <span>{feature.coming}</span>
        <Link to="/admin" className="ag-btn ag-btn--dark">
          Volver al panel
        </Link>
      </div>
    </>
  )
}
