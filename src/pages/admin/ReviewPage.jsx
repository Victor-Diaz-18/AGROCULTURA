import { useEffect, useState } from 'react'
import ReviewModal from '../../components/admin/ReviewModal.jsx'
import PageHeader from '../../components/layout/PageHeader.jsx'
import StoryCard from '../../components/story/StoryCard.jsx'
import DataTable, { Cell, TableRow } from '../../components/ui/DataTable.jsx'
import FCode from '../../components/ui/FCode.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import SegmentedTabs from '../../components/ui/SegmentedTabs.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useAdminStories from '../../hooks/useAdminStories.js'
import { formatDate } from '../../utils/format.js'
import { placeLine } from '../../utils/geo.js'

const TEXT = {
  portal: 'Ninguna historia se publica sin pasar por aquí. Revisa el contenido, márcalo y decide.',
  admin: 'Ninguna historia de la comunidad se publica sin pasar por aquí.',
}

const TABS = [
  { id: 'revision', label: 'Por revisar', dot: 'var(--st-revision-dot)', filters: { estado: 'revision', limite: 100 } },
  { id: 'publicada', label: 'Aprobadas', dot: 'var(--st-publicada-dot)', filters: { estado: 'publicada', origen: 'comunidad', limite: 100 } },
  { id: 'rechazada', label: 'Rechazadas', dot: 'var(--st-rechazada-dot)', filters: { estado: 'rechazada', limite: 100 } },
]

const EMPTY = {
  revision: 'No hay historias por revisar. Cuando un narrador envíe una, aparece aquí.',
  publicada: 'No hay historias en este estado.',
  rechazada: 'No hay historias en este estado.',
}

/** Review queue (F6). Shared by the portal ("portal") and the admin panel ("admin"). */
export default function ReviewPage({ variant = 'portal' }) {
  const { config, stats, reload: reloadPortal } = usePortalData()
  const [tab, setTab] = useState('revision')
  const [openCode, setOpenCode] = useState(null)
  const [cardCode, setCardCode] = useState(null)
  const current = TABS.find((item) => item.id === tab)
  const { stories, status, reload } = useAdminStories(current.filters)

  useEffect(() => {
    reloadPortal() // fresh counters when the page opens: other people may have sent stories
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = { revision: stats.en_revision, publicada: stats.aprobadas_comunidad, rechazada: stats.rechazadas }
  const items = TABS.map(({ id, label, dot }) => ({ id, label, dot, count: counts[id] }))
  const reviewing = tab === 'revision' ? stories.find((story) => story.codigo === openCode) : null
  const card = tab === 'revision' ? null : stories.find((story) => story.codigo === cardCode)

  const emptyText = { loading: 'Cargando…', offline: 'Sin señal: la bandeja se carga cuando vuelva la conexión.', error: 'No pudimos cargar las historias. Intenta de nuevo.', ready: stories.length === 0 ? EMPTY[tab] : null }[status]

  const decided = (nextCode) => {
    setOpenCode(nextCode)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Revisión de historias"
        subtitle={TEXT[variant]}
        actions={variant === 'portal' ? <ListenButton title="Revisión de historias" text={`Revisión de historias. ${TEXT.portal}`} /> : null}
      />

      {variant === 'portal' && (
        <div className="ag-counts">
          <div className="ag-count ag-count--aviso">
            <span className="ag-count__title">Por revisar</span>
            <span className="ag-count__value">{stats.en_revision}</span>
          </div>
          <div className="ag-count">
            <span className="ag-count__title">Aprobadas de la comunidad</span>
            <span className="ag-count__value">{stats.aprobadas_comunidad}</span>
          </div>
          <div className="ag-count">
            <span className="ag-count__title">Rechazadas</span>
            <span className="ag-count__value">{stats.rechazadas}</span>
          </div>
        </div>
      )}

      <div className="ag-table-card">
        <div className="ag-table-card__bar ag-table-card__bar--split">
          <SegmentedTabs items={items} value={tab} onChange={setTab} label="Filtrar por estado" />
          <FCode>{variant === 'portal' ? 'F6 · F7' : 'F6'}</FCode>
        </div>
        <DataTable
          label="Historias para revisar"
          columns={[
            { label: 'CÓDIGO' },
            { label: 'HISTORIA' },
            { label: 'NARRADOR' },
            { label: 'SECTOR' },
            { label: 'FORMATOS' },
            { label: variant === 'portal' ? 'ENVIADA' : 'FECHA' },
            { label: 'ACCIÓN', align: 'right' },
          ]}
          template="130px minmax(220px, 2fr) minmax(150px, 1fr) 110px 150px 110px 130px"
          minWidth={900}
          empty={emptyText}
        >
          {stories.map((story) => (
            <TableRow key={story.codigo}>
              <Cell className="ag-table__code">{story.codigo}</Cell>
              <Cell className="ag-table__title">
                <b>{story.titulo}</b>
                {story.estado === 'rechazada' && story.motivo_rechazo && <span className="ag-table__reason">{story.motivo_rechazo}</span>}
              </Cell>
              <Cell>{story.narrador_nombre}</Cell>
              <Cell>{placeLine(story, config.sectores)}</Cell>
              <Cell className="ag-table__muted">{story.formatos.join(' · ')}</Cell>
              <Cell className="ag-table__muted">{formatDate(story.enviada_en)}</Cell>
              <Cell className="ag-table__action">
                {story.estado === 'revision' ? (
                  <button type="button" className="ag-rowbtn ag-rowbtn--dark" onClick={() => setOpenCode(story.codigo)}>
                    Revisar
                  </button>
                ) : (
                  <button type="button" className="ag-rowbtn ag-rowbtn--outline" onClick={() => setCardCode(story.codigo)}>
                    Ver ficha
                  </button>
                )}
              </Cell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {card && <StoryCard key={card.codigo} story={card} onClose={() => setCardCode(null)} />}

      {reviewing && (
        <ReviewModal
          key={reviewing.codigo}
          story={reviewing}
          queue={stories}
          variant={variant}
          onClose={() => setOpenCode(null)}
          onDecided={decided}
          onStale={reload}
        />
      )}
    </>
  )
}
