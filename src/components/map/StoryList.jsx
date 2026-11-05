import { useEffect, useRef } from 'react'
import { hasLocation } from '../../utils/geo.js'
import Icon from '../ui/Icon.jsx'
import OriginBadge from '../ui/OriginBadge.jsx'

/** A story with no photo shows how it is told (its voice, its video), instead of a picture that seems to be missing. */
function thumbIcon(story) {
  if (story.formatos.includes('Audio')) return 'mic'
  if (story.formatos.includes('Video')) return 'video'
  if (story.formatos.includes('Foto')) return 'foto'
  return 'lista'
}

/**
 * The stories in the visible zone of the map, as in the design: a thumbnail, code, origin, title,
 * who tells it, where, when, and its formats. Tapping one opens its card.
 * A story published without a place is never "in a zone": it is always listed, and says in so many words that it is not on the map.
 */
export default function StoryList({ stories, selectedCode, placeOf, onOpen, showCodes = true }) {
  const selected = useRef(null)

  // A story picked from outside (for example "Ver en el mapa") comes into view in the list.
  useEffect(() => {
    selected.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedCode])

  return (
    <ul className="ag-storylist" aria-label="Historias en esta zona del mapa">
      {stories.map((story) => {
        const isSelected = story.codigo === selectedCode
        return (
          <li key={story.codigo}>
            <button
              ref={isSelected ? selected : null}
              type="button"
              className={`ag-storyitem${isSelected ? ' ag-storyitem--selected' : ''}`}
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => onOpen(story)}
            >
              <span className="ag-storyitem__thumb" aria-hidden="true">
                {story.foto_url ? <img src={story.foto_url} alt="" loading="lazy" /> : <Icon name={thumbIcon(story)} size={22} />}
              </span>
              <span className="ag-storyitem__text">
                <span className="ag-storyitem__top">
                  {showCodes && <span className="ag-storyitem__code">{story.codigo}</span>}
                  <OriginBadge origen={story.origen} size="sm" />
                </span>
                <span className="ag-storyitem__title">{story.titulo}</span>
                {!hasLocation(story) && <span className="ag-storyitem__noplace">Sin ubicación en el mapa</span>}
                <span className="ag-storyitem__meta">
                  {[story.narrador_nombre, hasLocation(story) ? placeOf(story) : null, story.epoca].filter(Boolean).join(' · ')}
                </span>
                <span className="ag-storyitem__formats">
                  {story.formatos.map((format) => (
                    <span key={format}>{format}</span>
                  ))}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
