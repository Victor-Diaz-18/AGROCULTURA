import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import PendingBlock from '../../components/layout/PendingBlock.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'

/** Admin dashboard: how the archive is going and what needs attention. */
export default function SummaryPage() {
  const { stats } = usePortalData()
  const navigate = useNavigate()
  const percent = Math.round((stats.sectores_con_historias / Math.max(stats.total_sectores, 1)) * 100)

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

      <PendingBlock block={4}>La lista «Esperando revisión» se construye en el bloque 4 (F6).</PendingBlock>
    </>
  )
}
