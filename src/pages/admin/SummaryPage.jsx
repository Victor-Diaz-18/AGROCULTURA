import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReviewModal from '../../components/admin/ReviewModal.jsx'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useAdminStories from '../../hooks/useAdminStories.js'
import { formatDate } from '../../utils/format.js'
import { placeName } from '../../utils/geo.js'

const PREVIEW = 5

/** Admin dashboard: how the archive is going and what needs attention. */
export default function SummaryPage() {
  const { config, stats, reload: reloadPortal } = usePortalData()
  const navigate = useNavigate()
  const { stories: queue, status, reload } = useAdminStories({ estado: 'revision', limite: 100 })
  const [openCode, setOpenCode] = useState(null)
  const percent = Math.round((stats.sectores_con_historias / Math.max(stats.total_sectores, 1)) * 100)
  const reviewing = queue.find((story) => story.codigo === openCode)

  useEffect(() => {
    reloadPortal() // fresh counters when the dashboard opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageHeader
        title="Resumen"
        subtitle="Cómo va el archivo de historias y qué necesita atención. Las historias del equipo se crean con «Crear historia»."
      />

      <div className="ag-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <button type="button" className="ag-stat ag-stat--tight ag-stat--aviso ag-stat--button" onClick={() => navigate('/admin/revision')}>
          <span className="ag-stat__title">Por revisar</span>
          <span className="ag-stat__value">{stats.en_revision}</span>
          <span className="ag-stat__note" style={{ fontWeight: 700 }}>
            Ir a la bandeja →
          </span>
        </button>

        <div className="ag-stat ag-stat--tight">
          <span className="ag-stat__title">Publicadas en el mapa</span>
          <span className="ag-stat__value">{stats.publicadas}</span>
          <span className="ag-stat__note">
            {stats.aprobadas_comunidad} de la comunidad · {stats.por_origen.proyecto} del proyecto
          </span>
        </div>

        <div className="ag-stat ag-stat--tight">
          <span className="ag-stat__title">Sectores con historias</span>
          <div className="ag-stat__row">
            <span className="ag-stat__value">{stats.sectores_con_historias}</span>
            <span className="ag-stat__note">de {stats.total_sectores}</span>
          </div>
          <div className="ag-stat__bar">
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="ag-stat ag-stat--tight">
          <span className="ag-stat__title">Formatos publicados</span>
          <div className="ag-stat__formats">
            <span>
              <b>{stats.formatos.audio}</b> <span>audio</span>
            </span>
            <span>
              <b>{stats.formatos.foto}</b> <span>foto</span>
            </span>
            <span>
              <b>{stats.formatos.video}</b> <span>video</span>
            </span>
          </div>
        </div>
      </div>

      <div className="ag-table-card">
        <div className="ag-table-card__bar ag-table-card__bar--split">
          <h2 className="ag-table-card__title">Esperando revisión</h2>
          <button type="button" className="ag-rowbtn ag-rowbtn--ghost" onClick={() => navigate('/admin/revision')}>
            Ver todas
          </button>
        </div>
        {status === 'ready' && queue.length === 0 && (
          <div className="ag-table__empty">No hay historias pendientes. Cuando un narrador envíe una, aparece aquí.</div>
        )}
        {status === 'loading' && <div className="ag-table__empty">Cargando…</div>}
        {status === 'offline' && <div className="ag-table__empty">Sin señal: las historias pendientes se cargan cuando vuelva la conexión.</div>}
        {status === 'error' && <div className="ag-table__empty" role="alert">No pudimos cargar las historias pendientes.</div>}
        <ul className="ag-pending-list" aria-label="Historias esperando revisión">
          {queue.slice(0, PREVIEW).map((story) => (
            <li key={story.codigo} className="ag-pending-list__row">
              <div className="ag-pending-list__text">
                <span className="ag-pending-list__title">{story.titulo}</span>
                <span className="ag-pending-list__meta">
                  {story.narrador_nombre} · {placeName(story.sector_id, config.sectores)} · {story.formatos.join(' · ')} · enviada {formatDate(story.enviada_en)}
                </span>
              </div>
              <button type="button" className="ag-rowbtn ag-rowbtn--dark ag-rowbtn--lg" onClick={() => setOpenCode(story.codigo)}>
                Revisar
              </button>
            </li>
          ))}
        </ul>
      </div>

      {reviewing && (
        <ReviewModal
          key={reviewing.codigo}
          story={reviewing}
          queue={queue}
          variant="admin"
          onClose={() => setOpenCode(null)}
          onDecided={(next) => {
            setOpenCode(next)
            reload()
          }}
          onStale={reload}
        />
      )}
    </>
  )
}
