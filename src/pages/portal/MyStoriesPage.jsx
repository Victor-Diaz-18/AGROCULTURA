import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Button from '../../components/ui/Button.jsx'
import FCode from '../../components/ui/FCode.jsx'
import Icon from '../../components/ui/Icon.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import SegmentedTabs from '../../components/ui/SegmentedTabs.jsx'
import StatusChip from '../../components/ui/StatusChip.jsx'
import { ESTADOS } from '../../config/constants.js'
import { useMyStories } from '../../context/MyStoriesContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'
import { formatDate } from '../../utils/format.js'

const READ_ALOUD = 'Mis historias. Lo que has contado y en qué va cada historia.'

const TABS = [
  { id: 'todas', label: 'Todas', dot: 'var(--st-borrador-dot)' },
  { id: 'borrador', label: ESTADOS.borrador.label, dot: 'var(--st-borrador-dot)' },
  { id: 'revision', label: ESTADOS.revision.label, dot: 'var(--st-revision-dot)' },
  { id: 'publicada', label: ESTADOS.publicada.label, dot: 'var(--st-publicada-dot)' },
  { id: 'rechazada', label: ESTADOS.rechazada.label, dot: 'var(--st-rechazada-dot)' },
]

/** What happens next with a story: the rejection reason, or the next step of its state. */
export function nextStep(story) {
  if (story.estado === 'rechazada') return story.motivo_rechazo ?? ''
  if (story.estado === 'publicada') return ''
  return ESTADOS[story.estado]?.sigue ?? ''
}

/** The narrator's own stories with their state (F10, F6). */
export default function MyStoriesPage() {
  const navigate = useNavigate()
  const { config } = usePortalData()
  const { online } = useConnectivity()
  const { stories, status, reload } = useMyStories()
  const [tab, setTab] = useState('todas')

  useEffect(() => {
    if (online) reload() // always show what the server has now, not what was loaded when the session started
  }, [online, reload])

  const all = stories ?? []
  const items = TABS.map((item) => ({
    ...item,
    count: item.id === 'todas' ? all.length : all.filter((story) => story.estado === item.id).length,
  }))
  const rows = all.filter((story) => tab === 'todas' || story.estado === tab)
  const sectorName = (id) => config.sectores.find((sector) => sector.id === id)?.nombre ?? id

  return (
    <>
      <PageHeader
        title="Mis historias"
        subtitle="Lo que has contado y en qué va cada historia."
        actions={
          <>
            <ListenButton title="Mis historias" text={READ_ALOUD} />
            <Button variant="primary" icon="mas" onClick={() => navigate('/contar')}>
              Contar otra historia
            </Button>
          </>
        }
      />

      {!online && (
        <div className="ag-banner" role="status">
          <Icon name="wifi-off" size={22} />
          <span className="ag-banner__text">
            <b>Sin señal.</b>{' '}
            {stories
              ? 'Ves lo último que se cargó. Se actualizará cuando vuelva la conexión.'
              : 'No pudimos cargar tus historias. Se cargarán cuando vuelva la conexión.'}
          </span>
          <FCode>F10</FCode>
        </div>
      )}

      <div className="ag-table-card">
        <div className="ag-table-card__bar">
          <SegmentedTabs items={items} value={tab} onChange={setTab} label="Filtrar por estado" />
        </div>
        <div className="ag-table-card__scroll">
          <div className="ag-mytable" role="table" aria-label="Mis historias">
            <div className="ag-mytable__head" role="row">
              {['CÓDIGO', 'HISTORIA', 'SECTOR', 'FORMATOS', 'FECHA', 'ESTADO', 'QUÉ SIGUE'].map((name) => (
                <span key={name} role="columnheader">
                  {name}
                </span>
              ))}
            </div>
            {status === 'loading' && <div className="ag-mytable__empty" role="status">Cargando tus historias…</div>}
            {status === 'error' && (
              <div className="ag-mytable__empty" role="alert">
                No pudimos cargar tus historias.{' '}
                <button type="button" className="ag-linkbutton" onClick={reload}>
                  Intentar de nuevo
                </button>
              </div>
            )}
            {status === 'ready' && all.length === 0 && (
              <div className="ag-mytable__empty">Todavía no has contado ninguna historia. Cuando cuentes una, aparecerá aquí con su estado.</div>
            )}
            {status === 'ready' && all.length > 0 && rows.length === 0 && (
              <div className="ag-mytable__empty">No hay historias en este estado.</div>
            )}
            {rows.map((story) => (
              <div key={story.codigo} className="ag-mytable__row" role="row">
                <span role="cell" className="ag-mytable__code">
                  {story.codigo}
                </span>
                <span role="cell" className="ag-mytable__title">
                  {story.titulo}
                </span>
                <span role="cell">{sectorName(story.sector_id)}</span>
                <span role="cell" className="ag-mytable__muted">
                  {story.formatos.join(' · ')}
                </span>
                <span role="cell" className="ag-mytable__muted">
                  {formatDate(story.enviada_en)}
                </span>
                <span role="cell">
                  <StatusChip estado={story.estado} />
                </span>
                <span role="cell" className="ag-mytable__next">
                  {nextStep(story)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
