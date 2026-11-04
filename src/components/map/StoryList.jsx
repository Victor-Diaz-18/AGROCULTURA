import { useEffect, useRef } from 'react'
import Icon from '../ui/Icon.jsx'
import OriginBadge from '../ui/OriginBadge.jsx'

/**
 * The stories in the visible zone of the map, as in the design: a thumbnail, code, origin, title,
 * who tells it, where, when, and its formats. Tapping one opens its card.
 */
export default function StoryList({ stories, selectedCode, sectorName, onOpen }) {
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
                {story.foto_url ? <img src={story.foto_url} alt="" loading="lazy" /> : <Icon name="foto" size={22} />}
              </span>
              <span className="ag-storyitem__text">
                <span className="ag-storyitem__top">
                  <span className="ag-storyitem__code">{story.codigo}</span>
                  <OriginBadge origen={story.origen} size="sm" />
                </span>
                <span className="ag-storyitem__title">{story.titulo}</span>
                <span className="ag-storyitem__meta">
                  {[story.narrador_nombre, sectorName(story.sector_id), story.epoca].filter(Boolean).join(' · ')}
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
