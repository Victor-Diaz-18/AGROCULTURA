import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NARRADOR_ANONIMO, NO_LOCATION } from '../../config/constants.js'
import { referenceImageFor } from '../../config/referenceImages.js'
import { SHOW_CODES } from '../../config/flags.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { fetchStory } from '../../services/stories.js'
import { ApiError, OfflineError } from '../../services/http.js'
import { formatDate } from '../../utils/format.js'
import { appleMapsUrl, googleMapsUrl, hasLocation, placeLine, placeName } from '../../utils/geo.js'
import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'
import ListenButton from '../ui/ListenButton.jsx'
import Modal from '../ui/Modal.jsx'
import OriginBadge from '../ui/OriginBadge.jsx'
import AudioPlayer from './AudioPlayer.jsx'
import PhotoGallery from './PhotoGallery.jsx'

/**
 * The card (ficha) of a story (F8): its photos, video and audio, who tells it, where and when, and its text.
 *
 * `story` is what /api/historias/{codigo} answers (published stories) or what the administrators' list has;
 * both carry the same fields. "Ver en el mapa" only exists for published stories that have a place on the map: the rest are
 * not on it. A story published without a place says so, and shows no place at all; the administrators' list also carries the
 * reference its narrator wrote (the public never gets it) and the real name of a story published without it.
 */
export default function StoryCard({ story, onClose }) {
  const { config } = usePortalData()
  const { user } = useAuth()
  const isVisitor = !user
  const navigate = useNavigate()
  // As in the design: the sectors other than Minca are "zona de Minca".
  const sector = placeName(story.sector_id, config.sectores)
  const sectorName = story.sector_id && story.sector_id !== 'minca' ? `${sector}, zona de Minca` : sector
  // Without a place on the map (what the public gets, or what the administrators' list says of such a story) there is none to say.
  const noPlace = story.con_ubicacion === false || story.ubicacion_modo === 'ninguna'
  const reference = noPlace ? story.lugar_nombre : null // only the administrators' answers have it
  // With a name given by the narrator ("Finca La Esperanza, La Tagua") that is what is said; otherwise the sector.
  const whereText = noPlace ? NO_LOCATION : story.lugar_nombre ? placeLine(story, config.sectores) : sectorName
  // Published without the name: the public reads the label; the administrators' list has the real one, and says how it will read.
  const hidesName = story.anonima && story.narrador_nombre !== NARRADOR_ANONIMO
  const published = story.estado === undefined || story.estado === 'publicada'
  const photos = story.medios.filter((medio) => medio.tipo === 'foto')
  // In the public card a story with no photo of its own shows a reference one, and says so; the team sees what really is there.
  const realPhotos = photos.filter((medio) => medio.url)
  const referenceImage = story.estado === undefined && realPhotos.length === 0 ? referenceImageFor(story) : null
  const audios = story.medios.filter((medio) => medio.tipo === 'audio')
  const videos = story.medios.filter((medio) => medio.tipo === 'video')

  const readAloud = () =>
    [
      story.titulo,
      noPlace ? `Ocurrió ${story.epoca}.` : `Ocurrió ${story.epoca}, en ${whereText}.`,
      story.finca_nombre ? `Finca o marca: ${story.finca_nombre}.` : '',
      story.anonima && !hidesName ? 'Narra un narrador anónimo.' : story.narrador_nombre ? `Narra ${story.narrador_nombre}.` : '',
      story.texto || 'Esta historia está contada en audio.',
    ]
      .filter(Boolean)
      .join(' ')

  const showOnMap = () => {
    onClose()
    navigate(`/?historia=${encodeURIComponent(story.codigo)}`)
  }

  return (
    <Modal open onClose={onClose} label="Ficha de la historia" maxWidth={920} level={50} top={40}>
      <div className="ag-card-story__head">
        <div className="ag-card-story__id">
          {!isVisitor && <span className="ag-card-story__code">{story.codigo}</span>}
          <OriginBadge origen={story.origen} />
          <span className="ag-card-story__kicker">Ficha de historia{SHOW_CODES ? ' · F8' : ''}</span>
        </div>
        <ListenButton title={story.titulo} text={readAloud} size="sm" />
        <button type="button" className="ag-close" aria-label="Cerrar" onClick={onClose}>
          <Icon name="cerrar" size={16} strokeWidth={2.4} />
        </button>
      </div>

      <div className="ag-card-story__body">
        <div className="ag-card-story__media">
          {referenceImage ? (
            <figure className="ag-card-story__refimg">
              <img src={referenceImage.large} alt={referenceImage.alt} />
              <figcaption>Imagen de referencia: esta historia aún no tiene foto propia.</figcaption>
            </figure>
          ) : (
            <PhotoGallery photos={photos} />
          )}
          {videos.map((medio, index) =>
            medio.url ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video key={medio.url} className="ag-media__video" src={medio.url} controls preload="metadata" aria-label="Video de la historia" />
            ) : (
              <div key={`video-${index}`} className="ag-card-story__video">
                <span className="ag-card-story__play">
                  <Icon name="play" size={20} />
                </span>
                <span>Video de la historia{SHOW_CODES ? ' · F13' : ''}</span>
              </div>
            ),
          )}
          {audios.map((medio, index) => (
            <AudioPlayer key={medio.url ?? `audio-${index}`} url={medio.url} seconds={medio.duracion_s ?? 0} />
          ))}
          {!isVisitor && (
            <>
          <div className="ag-card-story__future">
            <button type="button" disabled>
              Ver en 360°{SHOW_CODES ? ' · F14' : ''}
            </button>
            <button type="button" disabled>
              Avatar en RA{SHOW_CODES ? ' · F15' : ''}
            </button>
          </div>
          <span className="ag-card-story__note">360° y realidad aumentada quedan para fases futuras.</span>
            </>
          )}
        </div>

        <div className="ag-card-story__info">
          <h2 className="ag-card-story__title">{story.titulo}</h2>
          <dl className="ag-card-story__facts">
            <div>
              <dt>Ocurrió</dt>
              <dd>{story.epoca}</dd>
            </div>
            <div>
              <dt>Lugar</dt>
              <dd>
                {whereText}
                {reference && <span className="ag-card-story__reference"> · Referencia para el equipo: {reference}</span>}
              </dd>
            </div>
            {story.finca_nombre && (
              <div>
                <dt>Finca o marca</dt>
                <dd>{story.finca_nombre}</dd>
              </div>
            )}
            <div>
              <dt>Narra</dt>
              <dd>
                {story.narrador_nombre || '—'}
                {hidesName && <span className="ag-card-story__reference"> · Se publica como «{NARRADOR_ANONIMO}»</span>}
              </dd>
            </div>
            <div>
              <dt>Publicada</dt>
              <dd>{story.publicada_en ? formatDate(story.publicada_en) : 'Sin publicar'}</dd>
            </div>
          </dl>
          {story.texto && <p className="ag-card-story__text">{story.texto}</p>}
          {story.etiquetas.length > 0 && (
            <div className="ag-review__tags">
              {story.etiquetas.map((tag) => (
                <span key={tag} className="ag-tagpill">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {published && noPlace && (
            <div className="ag-card-story__where">
              <p className="ag-hint ag-card-story__approx">Esta historia no tiene ubicación en el mapa.</p>
            </div>
          )}
          {published && !noPlace && (
            <div className="ag-card-story__where">
              <button type="button" className="ag-card-story__map" onClick={showOnMap}>
                <Icon name="pin" size={18} />
                Ver en el mapa
              </button>
              {hasLocation(story) && (
                <>
                  <a className="ag-card-story__map" href={googleMapsUrl(story)} target="_blank" rel="noopener noreferrer">
                    <Icon name="enlace-externo" size={16} />
                    Abrir en Google Maps
                  </a>
                  <a className="ag-card-story__map" href={appleMapsUrl(story, story.titulo)} target="_blank" rel="noopener noreferrer">
                    <Icon name="enlace-externo" size={16} />
                    Abrir en Apple Maps
                  </a>
                </>
              )}
              {story.aproximada && (
                <p className="ag-hint ag-card-story__approx">
                  El punto del mapa es aproximado (unos 500 metros) para cuidar la privacidad del lugar.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Opens the card of a published story by its code: asks the server for it first. */
export function StoryCardLoader({ code, onClose }) {
  const [state, setState] = useState({ story: null, problem: '' })

  useEffect(() => {
    let cancelled = false
    fetchStory(code)
      .then((story) => !cancelled && setState({ story, problem: '' }))
      .catch((error) => {
        if (cancelled) return
        let problem = 'No pudimos abrir la ficha. Intenta de nuevo.'
        if (error instanceof OfflineError) problem = 'Sin señal: la ficha se abre cuando vuelva la conexión.'
        else if (error instanceof ApiError && error.status === 404) problem = 'Esa historia ya no está publicada.'
        setState({ story: null, problem })
      })
    return () => {
      cancelled = true
    }
  }, [code])

  if (state.story) return <StoryCard story={state.story} onClose={onClose} />
  return (
    <Modal open onClose={onClose} label="Ficha de la historia" maxWidth={480} level={50} top={80}>
      <div className="ag-card-story__loading" role={state.problem ? 'alert' : 'status'}>
        {state.problem || 'Abriendo la ficha…'}
        <button type="button" className="ag-mbtn ag-mbtn--ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
