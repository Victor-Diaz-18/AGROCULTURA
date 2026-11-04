import AudioPlayer from './AudioPlayer.jsx'

/** The files of a story: its audio, its photos and its video. Entries without a `url` are examples with no file. */
export default function StoryMedia({ medios }) {
  const audio = medios.filter((medio) => medio.tipo === 'audio')
  const photos = medios.filter((medio) => medio.tipo === 'foto')
  const videos = medios.filter((medio) => medio.tipo === 'video')
  if (medios.length === 0) return null

  return (
    <div className="ag-media">
      {audio.map((medio, index) => (
        <AudioPlayer key={medio.url ?? `audio-${index}`} url={medio.url} seconds={medio.duracion_s ?? 0} />
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
      {videos.map((medio, index) =>
        medio.url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video key={medio.url} className="ag-media__video" src={medio.url} controls preload="metadata" aria-label="Video de la historia" />
        ) : (
          <span key={`video-${index}`} className="ag-media__placeholder">
            Video de ejemplo
          </span>
        ),
      )}
    </div>
  )
}
