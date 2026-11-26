import { splitCaption } from '../../utils/caption.js'
import { youtubeEmbed, youtubeId } from '../../utils/youtube.js'
import AudioPlayer from './AudioPlayer.jsx'

/**
 * The files of a story: its audio, its photos and its video (uploaded, or one that stays on YouTube). Entries without a `url`
 * are examples with no file. `leyenda`: what a file is and its credit (a song of a bird, a photo from Wikimedia Commons).
 */
export default function StoryMedia({ medios }) {
  const audio = medios.filter((medio) => medio.tipo === 'audio')
  const photos = medios.filter((medio) => medio.tipo === 'foto')
  const videos = medios.filter((medio) => medio.tipo === 'video')
  const youtube = medios.filter((medio) => medio.tipo === 'youtube' && youtubeId(medio.url))
  const captions = photos.filter((medio) => medio.leyenda)
  if (medios.length === 0) return null

  return (
    <div className="ag-media">
      {audio.map((medio, index) => (
        <AudioPlayer
          key={medio.url ?? `audio-${index}`}
          url={medio.url}
          seconds={medio.duracion_s ?? 0}
          {...(medio.leyenda ? { title: splitCaption(medio.leyenda)[0], credit: splitCaption(medio.leyenda)[1] } : {})}
        />
      ))}
      {photos.length > 0 && (
        <ul className="ag-media__photos" aria-label="Fotos de la historia">
          {photos.map((medio, index) => (
            <li key={medio.url ?? `foto-${index}`}>
              {medio.url ? (
                <a href={medio.url} target="_blank" rel="noreferrer" aria-label={`Abrir la foto ${index + 1} en otra pestaña`}>
                  <img src={medio.url} alt={`Foto ${index + 1} de la historia`} loading="lazy" />
                </a>
              ) : (
                <span className="ag-media__placeholder">Foto de ejemplo</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {captions.length > 0 && (
        <ul className="ag-media__credits" aria-label="Sobre las fotos">
          {captions.map((medio) => (
            <li key={medio.url}>
              Foto {photos.indexOf(medio) + 1}: {medio.leyenda}
            </li>
          ))}
        </ul>
      )}
      {youtube.map((medio) => (
        <figure key={medio.url} className="ag-media__figure">
          <iframe
            className="ag-media__youtube"
            src={youtubeEmbed(youtubeId(medio.url))}
            title={medio.leyenda ? `Video: ${medio.leyenda}` : 'Video de la historia en YouTube'}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          {medio.leyenda && <figcaption className="ag-media__caption">{medio.leyenda}</figcaption>}
        </figure>
      ))}
      {videos.map((medio, index) =>
        medio.url ? (
          <figure key={medio.url} className="ag-media__figure">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video className="ag-media__video" src={medio.url} controls preload="metadata" aria-label="Video de la historia" />
            {medio.leyenda && <figcaption className="ag-media__caption">{medio.leyenda}</figcaption>}
          </figure>
        ) : (
          <span key={`video-${index}`} className="ag-media__placeholder">
            Video de ejemplo
          </span>
        ),
      )}
    </div>
  )
}
