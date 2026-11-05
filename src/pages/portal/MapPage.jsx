import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MapFilters from '../../components/map/MapFilters.jsx'
import StoryList from '../../components/map/StoryList.jsx'
import StoryMap from '../../components/map/StoryMap.jsx'
import VisitorIntro, { VisitorHowItWorks } from '../../components/map/VisitorIntro.jsx'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { StoryCardLoader } from '../../components/story/StoryCard.jsx'
import Button from '../../components/ui/Button.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import StatCard from '../../components/ui/StatCard.jsx'
import { SHOW_CODES, codeNote } from '../../config/flags.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import usePublishedStories from '../../hooks/usePublishedStories.js'
import { plural } from '../../utils/plural.js'
import { NO_FILTERS, applyFilters, isFiltering } from '../../utils/filters.js'
import { hasLocation, inBounds, placeLine } from '../../utils/geo.js'

/** Map of published stories (F1) with the list of the ones in the visible zone, and their cards (F8). */
export default function MapPage() {
  const { config, stats } = usePortalData()
  const { user } = useAuth()
  const isVisitor = !user
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { stories, status, reload } = usePublishedStories()
  const [view, setView] = useState(null) // visible zone of the map; null until it has a size
  const [selected, setSelected] = useState(null) // the story marked on the map
  const [openCode, setOpenCode] = useState(null) // the card that is open
  const [focus, setFocus] = useState(null)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [fitKey, setFitKey] = useState(0) // changes with the filters: the map goes to what they show
  const proyecto = stats.por_origen.proyecto
  const percent = Math.round((stats.sectores_con_historias / Math.max(stats.total_sectores, 1)) * 100)
  const target = params.get('historia')

  // "Ver en el mapa" (from a card) and shared links: mark that story and bring it into view. A story published without a
  // place is not on the map: its link opens its card (once), which is the only place it can be shown.
  const openedFor = useRef(null)
  useEffect(() => {
    const found = target ? stories.find((story) => story.codigo === target) : null
    if (!found) return
    setSelected(target)
    if (hasLocation(found)) setFocus({ code: target, nonce: Date.now() })
    else if (openedFor.current !== target) {
      openedFor.current = target
      setOpenCode(target)
    }
  }, [target, stories])

  const filtered = useMemo(() => applyFilters(stories, filters, config.sectores), [stories, filters, config.sectores])
  // The list: what is in the zone the map shows, and ALWAYS the stories that are not on the map (they are never "in a zone").
  const visible = useMemo(
    () => filtered.filter((story) => !hasLocation(story) || inBounds(view, story)).sort((a, b) => (a.codigo < b.codigo ? 1 : -1)),
    [filtered, view],
  )
  const withoutPlace = useMemo(() => stories.filter((story) => !hasLocation(story)).length, [stories])
  const filtering = isFiltering(filters)

  const changeFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }))
    setFitKey((key) => key + 1)
  }, [])
  const clearFilters = () => changeFilters(NO_FILTERS)

  // A marked story that the filters now hide is no longer marked.
  useEffect(() => {
    setSelected((current) => (current && !filtered.some((story) => story.codigo === current) ? null : current))
  }, [filtered])
  const placeOf = (story) => placeLine(story, config.sectores)

  const open = (story) => {
    setSelected(story.codigo)
    setOpenCode(story.codigo)
  }

  const readAloud = () =>
    [
      'Mapa de historias. Historias aprobadas de la cultura cafetera, con un lugar aproximado en el mapa cuando su narrador lo permite.',
      `Hay ${plural(stats.publicadas, 'historia publicada', 'historias publicadas')}:`,
      `${stats.aprobadas_comunidad} de la comunidad y ${proyecto} del proyecto.`,
      stats.sin_ubicacion > 0
        ? `${plural(stats.sin_ubicacion, 'historia se publicó', 'historias se publicaron')} sin ubicación en el mapa; se ve en la lista.`
        : '',
      `${stats.sectores_con_historias} de ${stats.total_sectores} sectores tienen historias.`,
      `En la zona que ves hay ${plural(visible.length, 'historia', 'historias')}.`,
      isVisitor ? '' : `Hay ${plural(stats.en_revision, 'historia esperando revisión', 'historias esperando revisión')}.`,
      'Para contar tu historia, toca el botón rojo «Contar una historia».',
    ]
      .filter(Boolean)
      .join(' ')

  // Stories kept from an earlier visit are shown while the signal is away or the server fails.
  const state = status !== 'ready' && stories.length > 0 ? 'ready' : status
  const listMessage = {
    loading: ['Cargando las historias…', ''],
    offline: ['Sin señal', 'Las historias se cargan cuando vuelva la conexión.'],
    error: ['No pudimos cargar las historias', 'Intenta de nuevo en un momento.'],
    ready:
      stories.length === 0
        ? ['Todavía no hay historias publicadas', 'Cuando un administrador apruebe la primera, aparece aquí.']
        : filtered.length === 0
          ? ['No hay historias con estos filtros', 'Prueba con otro sector, otra época o borra la búsqueda.']
          : visible.length === 0
            ? ['No hay historias en esta zona del mapa', 'Mueve o aleja el mapa para ver más.']
            : null,
  }[state]

  return (
    <>
      {isVisitor ? (
        <VisitorIntro sectors={config.sectores} stats={stats} readAloud={readAloud} />
      ) : (
        <>
      <PageHeader
        title="Mapa de historias"
        subtitle="Historias aprobadas de la cultura cafetera, con un lugar aproximado en el mapa cuando su narrador lo permite."
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
          {stats.sin_ubicacion > 0 && <div className="ag-stat__note">{stats.sin_ubicacion} sin ubicación en el mapa</div>}
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
          <div className="ag-stat__note">No salen en el mapa hasta que un administrador las aprueba{codeNote('F6')}.</div>
        </StatCard>
      </div>
        </>
      )}

      {isVisitor && (
        <div className="ag-vmaphead" id="mapa">
          <h2>Mapa de historias</h2>
          <p>Toca un punto del mapa o una historia de la lista para abrir su ficha.</p>
        </div>
      )}

      <div className="ag-mapcard">
        <MapFilters filters={filters} onChange={changeFilters} stories={stories} sectors={config.sectores} epocas={config.epocas} />
        <div className="ag-mapcard__body">
          <StoryMap
            stories={filtered}
            fitKey={fitKey}
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
                {state === 'ready' && filtering && filtered.length === 0 && (
                  <button type="button" className="ag-linkbutton" onClick={clearFilters}>
                    Quitar los filtros
                  </button>
                )}
              </div>
            ) : (
              <StoryList stories={visible} selectedCode={selected} placeOf={placeOf} onOpen={open} showCodes={!isVisitor} />
            )}
          </div>
        </div>
        <div className="ag-mapcard__foot">
          <span>
            Mostrando {visible.length} de {stats.publicadas} historias publicadas
          </span>
          <span>
            {isVisitor ? '' : `Toca un punto del mapa o una historia de la lista para abrir su ficha${SHOW_CODES ? ' (F8)' : ''}.`}
            {withoutPlace > 0 ? ' Las historias sin ubicación en el mapa salen siempre en la lista.' : ''}
          </span>
        </div>
      </div>

      {isVisitor && <VisitorHowItWorks />}

      {openCode && <StoryCardLoader key={openCode} code={openCode} onClose={() => setOpenCode(null)} />}
    </>
  )
}
