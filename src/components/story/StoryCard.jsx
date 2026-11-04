import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SHOW_CODES } from '../../config/flags.js'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { fetchStory } from '../../services/stories.js'
import { ApiError, OfflineError } from '../../services/http.js'
import { formatDate } from '../../utils/format.js'
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
 * both carry the same fields. "Ver en el mapa" only exists for published stories: the rest are not on the map.
 */
export default function StoryCard({ story, onClose }) {
  const { config } = usePortalData()
  const navigate = useNavigate()
  const sector = config.sectores.find((item) => item.id === story.sector_id)?.nombre ?? story.sector_id
  // As in the design: the other sectors are "zona de Minca".
  const sectorName = story.sector_id === 'minca' ? sector : `${sector}, zona de Minca`
  const published = story.estado === undefined || story.estado === 'publicada'
  const photos = story.medios.filter((medio) => medio.tipo === 'foto')
  const audios = story.medios.filter((medio) => medio.tipo === 'audio')
  const videos = story.medios.filter((medio) => medio.tipo === 'video')

  const readAloud = () =>
    [
      story.titulo,
      `Ocurrió ${story.epoca}, en ${sectorName}.`,
      story.narrador_nombre ? `Narra ${story.narrador_nombre}.` : '',
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
          <span className="ag-card-story__code">{story.codigo}</span>
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
          <PhotoGallery photos={photos} />
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
          <div className="ag-card-story__future">
            <button type="button" disabled>
              Ver en 360°{SHOW_CODES ? ' · F14' : ''}
            </button>
            <button type="button" disabled>
              Avatar en RA{SHOW_CODES ? ' · F15' : ''}
            </button>
          </div>
          <span className="ag-card-story__note">360° y realidad aumentada quedan para fases futuras.</span>
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
              <dd>{sectorName}</dd>
            </div>
            <div>
              <dt>Narra</dt>
              <dd>{story.narrador_nombre || '—'}</dd>
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
          {published && (
            <button type="button" className="ag-card-story__map" onClick={showOnMap}>
              <Icon name="pin" size={18} />
              Ver en el mapa
            </button>
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
