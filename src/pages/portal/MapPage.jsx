import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StoryList from '../../components/map/StoryList.jsx'
import StoryMap from '../../components/map/StoryMap.jsx'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { StoryCardLoader } from '../../components/story/StoryCard.jsx'
import Button from '../../components/ui/Button.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import StatCard from '../../components/ui/StatCard.jsx'
import { SHOW_CODES } from '../../config/flags.js'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import usePublishedStories from '../../hooks/usePublishedStories.js'
import { inBounds } from '../../utils/geo.js'
import { plural } from '../../utils/plural.js'

/** Map of published stories (F1) with the list of the ones in the visible zone, and their cards (F8). */
export default function MapPage() {
  const { config, stats } = usePortalData()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { stories, status, reload } = usePublishedStories()
  const [view, setView] = useState(null) // visible zone of the map; null until it has a size
  const [selected, setSelected] = useState(null) // the story marked on the map
  const [openCode, setOpenCode] = useState(null) // the card that is open
  const [focus, setFocus] = useState(null)
  const proyecto = stats.por_origen.proyecto
  const percent = Math.round((stats.sectores_con_historias / Math.max(stats.total_sectores, 1)) * 100)
  const target = params.get('historia')

  // "Ver en el mapa" (from a card) and shared links: mark that story and bring it into view.
  useEffect(() => {
    if (target && stories.some((story) => story.codigo === target)) {
      setSelected(target)
      setFocus({ code: target, nonce: Date.now() })
    }
  }, [target, stories])

  const visible = useMemo(
    () => stories.filter((story) => inBounds(view, story)).sort((a, b) => (a.codigo < b.codigo ? 1 : -1)),
    [stories, view],
  )
  const sectorName = (id) => config.sectores.find((sector) => sector.id === id)?.nombre ?? id

  const open = (story) => {
    setSelected(story.codigo)
    setOpenCode(story.codigo)
  }

  const readAloud = () =>
    [
      'Mapa de historias. Historias aprobadas de la cultura cafetera, ubicadas donde ocurrieron.',
      `Hay ${plural(stats.publicadas, 'historia publicada', 'historias publicadas')}:`,
      `${stats.aprobadas_comunidad} de la comunidad y ${proyecto} del proyecto.`,
      `${stats.sectores_con_historias} de ${stats.total_sectores} sectores tienen historias.`,
      `En la zona que ves hay ${plural(visible.length, 'historia', 'historias')}.`,
      `Hay ${plural(stats.en_revision, 'historia esperando revisión', 'historias esperando revisión')}.`,
      'Para contar tu historia, toca el botón rojo «Contar una historia».',
    ].join(' ')

  const listMessage = {
    loading: ['Cargando las historias…', ''],
    offline: ['Sin señal', 'Las historias se cargan cuando vuelva la conexión.'],
    error: ['No pudimos cargar las historias', 'Intenta de nuevo en un momento.'],
    ready:
      stories.length === 0
        ? ['Todavía no hay historias publicadas', 'Cuando un administrador apruebe la primera, aparece aquí.']
        : visible.length === 0
          ? ['No hay historias en esta zona del mapa', 'Mueve o aleja el mapa para ver más.']
          : null,
  }[status]

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

      <div className="ag-mapcard">
        <div className="ag-mapcard__body">
          <StoryMap
            stories={stories}
            sectors={config.sectores}
            selectedCode={selected}
            focus={focus}
            onSelect={open}
            onViewChange={setView}
          />
          <div className="ag-mapcard__list">
            {listMessage ? (
              <div className="ag-mapcard__empty" role={status === 'error' ? 'alert' : 'status'}>
                <b>{listMessage[0]}</b>
                {listMessage[1] && <span>{listMessage[1]}</span>}
                {status === 'error' && (
                  <button type="button" className="ag-linkbutton" onClick={reload}>
                    Intentar de nuevo
                  </button>
                )}
              </div>
            ) : (
              <StoryList stories={visible} selectedCode={selected} sectorName={sectorName} onOpen={open} />
            )}
          </div>
        </div>
        <div className="ag-mapcard__foot">
          <span>
            Mostrando {visible.length} de {stats.publicadas} historias publicadas
          </span>
          <span>Toca un punto del mapa o una historia de la lista para abrir su ficha{SHOW_CODES ? ' (F8)' : ''}.</span>
        </div>
      </div>

      {openCode && <StoryCardLoader key={openCode} code={openCode} onClose={() => setOpenCode(null)} />}
    </>
  )
}
