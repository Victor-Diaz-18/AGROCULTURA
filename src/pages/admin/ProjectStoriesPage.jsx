import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProjectStoryModal from '../../components/admin/ProjectStoryModal.jsx'
import PageHeader from '../../components/layout/PageHeader.jsx'
import StoryCard from '../../components/story/StoryCard.jsx'
import Button from '../../components/ui/Button.jsx'
import DataTable, { Cell, TableRow } from '../../components/ui/DataTable.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import useAdminStories from '../../hooks/useAdminStories.js'

const TEXT = {
  portal: 'Las sube el equipo. En el mapa se ven en otro color para distinguirlas de las de la comunidad.',
  admin: 'Las sube el equipo y se publican de una vez. En el mapa salen en otro color.',
}

const FILTERS = { origen: 'proyecto', limite: 100 }

/** Stories uploaded by the team (F12). Shared by the portal and the admin panel. The "Crear historia" link opens `?nueva=1`. */
export default function ProjectStoriesPage({ variant = 'portal' }) {
  const { config } = usePortalData()
  const [params, setParams] = useSearchParams()
  const { stories, status, reload } = useAdminStories(FILTERS)
  const creating = params.get('nueva') === '1'
  const [cardCode, setCardCode] = useState(null)
  const card = stories.find((story) => story.codigo === cardCode)
  const sectorName = (id) => config.sectores.find((sector) => sector.id === id)?.nombre ?? id

  const setCreating = (open) => setParams(open ? { nueva: '1' } : {}, { replace: true })
  const emptyText = {
    loading: 'Cargando…',
    offline: 'Sin señal: la lista se carga cuando vuelva la conexión.',
    error: 'No pudimos cargar las historias. Intenta de nuevo.',
    ready: stories.length === 0 ? 'Todavía no hay historias del proyecto. Crea la primera con «Nueva historia del proyecto».' : null,
  }[status]

  return (
    <>
      <PageHeader
        title="Historias del proyecto"
        subtitle={TEXT[variant]}
        actions={
          <>
            {variant === 'portal' && <ListenButton title="Historias del proyecto" text={`Historias del proyecto. ${TEXT.portal}`} />}
            <Button variant="project" icon="mas" onClick={() => setCreating(true)}>
              Nueva historia del proyecto
            </Button>
          </>
        }
      />

      <div className="ag-table-card">
        <DataTable
          label="Historias del proyecto"
          columns={[{ label: 'CÓDIGO' }, { label: 'HISTORIA' }, { label: 'SECTOR' }, { label: 'ÉPOCA' }, { label: 'FORMATOS' }, { label: 'FICHA', align: 'right' }]}
          template="130px minmax(240px, 2fr) 120px 150px 160px 120px"
          minWidth={760}
          empty={emptyText}
        >
          {stories.map((story) => (
            <TableRow key={story.codigo}>
              <Cell className="ag-table__code">{story.codigo}</Cell>
              <Cell className="ag-table__title">{story.titulo}</Cell>
              <Cell>{sectorName(story.sector_id)}</Cell>
              <Cell className="ag-table__muted">{story.epoca}</Cell>
              <Cell className="ag-table__muted">{story.formatos.join(' · ')}</Cell>
              <Cell className="ag-table__action">
                <button type="button" className="ag-rowbtn ag-rowbtn--teal" onClick={() => setCardCode(story.codigo)}>
                  Ver ficha
                </button>
              </Cell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {card && <StoryCard key={card.codigo} story={card} onClose={() => setCardCode(null)} />}

      {creating && (
        <ProjectStoryModal
          onClose={() => setCreating(false)}
          onPublished={() => {
            setCreating(false)
            reload()
          }}
        />
      )}
    </>
  )
}
