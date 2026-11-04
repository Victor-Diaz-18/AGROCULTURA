import { useState } from 'react'
import Icon from '../ui/Icon.jsx'

/**
 * The photos of a story: one big (tap to open it full size) and, when there are several, small ones to switch.
 * A photo without `url` is an example: the design's striped placeholder takes its place.
 */
export default function PhotoGallery({ photos }) {
  const [current, setCurrent] = useState(0)
  if (photos.length === 0) return null
  const photo = photos[Math.min(current, photos.length - 1)]

  return (
    <div className="ag-gallery">
      {photo.url ? (
        <a href={photo.url} target="_blank" rel="noreferrer" className="ag-gallery__main" aria-label="Abrir la foto en otra pestaña">
          <img src={photo.url} alt={`Foto ${current + 1} de ${photos.length} de la historia`} />
        </a>
      ) : (
        <div className="ag-gallery__main ag-gallery__placeholder">
          <Icon name="foto" size={36} strokeWidth={1.8} />
          <span>Foto de la historia</span>
        </div>
      )}
      {photos.length > 1 && (
        <ul className="ag-gallery__thumbs" aria-label="Fotos de la historia">
          {photos.map((item, index) => (
            <li key={item.url ?? `foto-${index}`}>
              <button
                type="button"
                aria-label={`Ver la foto ${index + 1}`}
                aria-pressed={index === current}
                onClick={() => setCurrent(index)}
                disabled={!item.url}
              >
                {item.url && <img src={item.url} alt="" loading="lazy" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
