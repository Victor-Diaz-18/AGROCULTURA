import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Button from '../../components/ui/Button.jsx'
import { StoryCardLoader } from '../../components/story/StoryCard.jsx'
import DiscardDraftDialog from '../../components/tell/DiscardDraftDialog.jsx'
import DataTable, { Cell, TableRow } from '../../components/ui/DataTable.jsx'
import FCode from '../../components/ui/FCode.jsx'
import Icon from '../../components/ui/Icon.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import SegmentedTabs from '../../components/ui/SegmentedTabs.jsx'
import StatusChip from '../../components/ui/StatusChip.jsx'
import { ESTADOS } from '../../config/constants.js'
import { useMyStories } from '../../context/MyStoriesContext.jsx'
import { useOutbox } from '../../context/OutboxContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'
import { formatDate } from '../../utils/format.js'
import { placeLine } from '../../utils/geo.js'

const READ_ALOUD = 'Mis historias. Lo que has contado y en qué va cada historia.'

const COLUMNS = ['CÓDIGO', 'HISTORIA', 'SECTOR', 'FORMATOS', 'FECHA', 'ESTADO', 'QUÉ SIGUE']

const TABS = [
  { id: 'todas', label: 'Todas', dot: 'var(--st-borrador-dot)' },
  { id: 'borrador', label: ESTADOS.borrador.label, dot: 'var(--st-borrador-dot)' },
  { id: 'revision', label: ESTADOS.revision.label, dot: 'var(--st-revision-dot)' },
  { id: 'publicada', label: ESTADOS.publicada.label, dot: 'var(--st-publicada-dot)' },
  { id: 'rechazada', label: ESTADOS.rechazada.label, dot: 'var(--st-rechazada-dot)' },
]

/** What happens next with a story: the rejection reason, why a draft or a video is stuck, or the next step of its state (and its video, if one is still on the phone). */
export function nextStep(story) {
  if (story.estado === 'rechazada') return story.motivo_rechazo ?? ''
  if (story.estado === 'borrador' && story.fallo) return story.fallo
  const video = story.video_pendiente
  if (video?.fallo) return video.fallo
  const base = story.estado === 'publicada' ? '' : (ESTADOS[story.estado]?.sigue ?? '')
  if (!video) return base
  const about = video.progreso != null ? `Subiendo el video… ${video.progreso} %` : 'Falta subir el video: se sube cuando haya señal.'
  return base ? `${base}. ${about}` : about
}

/** What is stuck on the phone for this story, if anything: its draft or its video, refused by the server and waiting for the person. */
function stuck(story) {
  if (story.estado === 'borrador' && story.fallo) return { clientId: story.clientId, titulo: story.titulo, video: false }
  if (story.video_pendiente?.fallo) return { clientId: story.video_pendiente.clientId, titulo: story.titulo, video: true }
  return null
}

/** The narrator's own stories with their state (F10, F6). */
export default function MyStoriesPage() {
  const navigate = useNavigate()
  const { config } = usePortalData()
  const { online } = useConnectivity()
  const { stories, drafts, status, reload } = useMyStories()
  const { retry, discard } = useOutbox()
  const [tab, setTab] = useState('todas')
  const [openCode, setOpenCode] = useState(null)
  const [discarding, setDiscarding] = useState(null) // what the person is about to throw away: { clientId, titulo, video }

  useEffect(() => {
    if (online) reload() // always show what the server has now, not what was loaded when the session started
  }, [online, reload])

  const all = stories ?? []
  const items = TABS.map((item) => ({
    ...item,
    count: item.id === 'todas' ? all.length : all.filter((story) => story.estado === item.id).length,
  }))
  const rows = all.filter((story) => tab === 'todas' || story.estado === tab)
  const emptyTexts = {
    loading: 'Cargando tus historias…',
    offline: 'Sin señal: tus historias se cargarán cuando vuelva la conexión.',
    error: (
      <span role="alert">
        No pudimos cargar tus historias.{' '}
        <button type="button" className="ag-linkbutton" onClick={reload}>
          Intentar de nuevo
        </button>
      </span>
    ),
    ready:
      all.length === 0
        ? 'Todavía no has contado ninguna historia. Cuando cuentes una, aparecerá aquí con su estado.'
        : 'No hay historias en este estado.',
  }
  const emptyText = rows.length > 0 ? null : emptyTexts[status]

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
            {drafts > 0
              ? 'Tus borradores están guardados en este dispositivo y se enviarán solos cuando vuelva la conexión.'
              : stories
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
        <DataTable
          label="Mis historias"
          columns={COLUMNS.map((label) => ({ label }))}
          template="130px minmax(220px, 2fr) 120px 150px 110px 130px minmax(150px, 1fr)"
          minWidth={860}
          empty={emptyText}
        >
          {rows.map((story) => (
            <TableRow key={story.codigo ?? story.clientId}>
              <Cell className="ag-table__code">{story.codigo ?? 'Por asignar'}</Cell>
              <Cell className="ag-table__title">{story.titulo}</Cell>
              <Cell>{story.lugar_texto ?? placeLine(story, config.sectores)}</Cell>
              <Cell className="ag-table__muted">{story.formatos.join(' · ')}</Cell>
              <Cell className="ag-table__muted">{formatDate(story.enviada_en)}</Cell>
              <Cell>
                <StatusChip estado={story.estado} />
              </Cell>
              <Cell className="ag-table__next ag-table__next--row">
                {story.estado === 'publicada' && (
                  <button type="button" className="ag-rowbtn ag-rowbtn--outline ag-rowbtn--sm" onClick={() => setOpenCode(story.codigo)}>
                    Ver ficha
                  </button>
                )}
                {stuck(story) && (
                  <>
                    <button type="button" className="ag-rowbtn ag-rowbtn--outline ag-rowbtn--sm" onClick={() => retry(stuck(story).clientId)}>
                      Reintentar
                    </button>
                    <button type="button" className="ag-rowbtn ag-rowbtn--ghost ag-rowbtn--sm" onClick={() => setDiscarding(stuck(story))}>
                      Quitar
                    </button>
                  </>
                )}
                <span>{nextStep(story)}</span>
              </Cell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {openCode && <StoryCardLoader key={openCode} code={openCode} onClose={() => setOpenCode(null)} />}
      {discarding && (
        <DiscardDraftDialog
          title={discarding.titulo}
          video={discarding.video}
          onClose={() => setDiscarding(null)}
          onConfirm={() => {
            discard(discarding.clientId)
            setDiscarding(null)
          }}
        />
      )}
    </>
  )
}
