import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import PendingBlock from '../../components/layout/PendingBlock.jsx'
import Button from '../../components/ui/Button.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import StatCard from '../../components/ui/StatCard.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { plural } from '../../utils/plural.js'

/** Map of stories (F1). The cards are live; the map and list arrive in block 5. */
export default function MapPage() {
  const { stats } = usePortalData()
  const navigate = useNavigate()
  const proyecto = stats.por_origen.proyecto
  const percent = Math.round((stats.sectores_con_historias / Math.max(stats.total_sectores, 1)) * 100)

  const readAloud = () =>
    [
      'Mapa de historias. Historias aprobadas de la cultura cafetera, ubicadas donde ocurrieron.',
      `Hay ${plural(stats.publicadas, 'historia publicada', 'historias publicadas')}:`,
      `${stats.aprobadas_comunidad} de la comunidad y ${proyecto} del proyecto.`,
      `${stats.sectores_con_historias} de ${stats.total_sectores} sectores tienen historias.`,
      `Hay ${plural(stats.en_revision, 'historia esperando revisión', 'historias esperando revisión')}.`,
      'Para contar tu historia, toca el botón rojo «Contar una historia».',
    ].join(' ')

  return (
    <>
      <PageHeader
        title="Mapa de historias"
        subtitle="Historias aprobadas de la cultura cafetera, ubicadas donde ocurrieron."
        actions={
          <>
            <ListenButton title="Mapa de historias" text={readAloud} />
            <Button variant="primary" icon="mas" onClick={() => navigate('/contar')}>
              Contar una historia
            </Button>
          </>
        }
      />

      <div className="ag-stats">
        <StatCard icon="pin" title="Historias publicadas">
          <div className="ag-stat__value">{stats.publicadas}</div>
          <div className="ag-stat__note">
            {stats.aprobadas_comunidad} de la comunidad · {proyecto} del proyecto
          </div>
        </StatCard>

        <StatCard icon="mapa" title="Sectores con historias">
          <div className="ag-stat__row">
            <span className="ag-stat__value">{stats.sectores_con_historias}</span>
            <span className="ag-stat__note">de {stats.total_sectores} sectores</span>
          </div>
          <div className="ag-stat__bar">
            <div style={{ width: `${percent}%` }} />
          </div>
        </StatCard>

        <StatCard icon="mic" title="Formatos">
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
          <div className="ag-stat__note">Una historia puede tener varios formatos.</div>
        </StatCard>

        <StatCard icon="reloj" title="En revisión" tone="aviso">
          <div className="ag-stat__value">{stats.en_revision}</div>
          <div className="ag-stat__note">No salen en el mapa hasta que un administrador las aprueba (F6).</div>
        </StatCard>
      </div>

      <PendingBlock block={5}>El mapa con filtros y la lista de historias se construyen en el bloque 5 (F1, F8, F11).</PendingBlock>
    </>
  )
}
