import { useEffect, useRef, useState } from 'react'
import { NO_FILTERS, isFiltering, sectorTabs } from '../../utils/filters.js'
import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'
import SegmentedTabs from '../ui/SegmentedTabs.jsx'

/** How long the search waits after the last key before the map follows it. */
export const SEARCH_DELAY_MS = 250

const ORIGINS = [
  { id: 'todos', label: 'Todas', dot: '#7A867E' },
  { id: 'comunidad', label: 'Comunidad', dot: '#B8323F' },
  { id: 'proyecto', label: 'Proyecto', dot: '#2F6F73' },
]
const FORMATS = ['Audio', 'Foto', 'Video', 'Texto']

/**
 * The filter bar of the map (F11), as in the design: sector tabs with how many stories each shows, origin tabs, a search
 * box and period and format menus. `onChange(patch)` is told only what changed.
 * The search is applied a moment after typing stops, so the map does not move at every key.
 */
export default function MapFilters({ filters, onChange, stories, sectors }) {
  const [text, setText] = useState(filters.q)
  const applied = useRef(filters.q)
  const [moreOpen, setMoreOpen] = useState(false) // on a phone only; on a wide screen everything is always there
  const moreActive = ['origen', 'desde', 'hasta', 'formato'].filter((key) => filters[key] !== NO_FILTERS[key]).length
  const anything = isFiltering(filters) || text.trim() !== '' // also a search still being typed

  /** «Borrar filtros»: every filter back to the start, the search box included (also what is still being typed). */
  const clearAll = () => {
    applied.current = ''
    setText('')
    onChange(NO_FILTERS)
  }

  // Cleared from outside ("Quitar los filtros"): the box follows. Typing is never overwritten by an older value.
  useEffect(() => {
    if (filters.q !== applied.current) {
      applied.current = filters.q
      setText(filters.q)
    }
  }, [filters.q])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (text !== applied.current) {
        applied.current = text
        onChange({ q: text })
      }
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text, onChange])

  return (
    <div className={`ag-mapfilters${moreOpen ? ' ag-mapfilters--open' : ''}`}>
      <div className="ag-mapfilters__row">
        <SegmentedTabs
          items={sectorTabs(stories, filters, sectors)}
          value={filters.sector}
          onChange={(sector) => onChange({ sector })}
          label="Filtrar por sector"
        />
        <div className="ag-mapfilters__more">
          <SegmentedTabs items={ORIGINS} value={filters.origen} onChange={(origen) => onChange({ origen })} label="Filtrar por origen" />
        </div>
      </div>
      <div className="ag-mapfilters__row">
        <div className="ag-mapfilters__search">
          <Icon name="buscar" size={16} />
          <input
            type="search"
            aria-label="Buscar historias"
            value={text}
            placeholder="Buscar por título, narrador o etiqueta…"
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <button type="button" className="ag-mapfilters__toggle" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          Más filtros{moreActive > 0 ? ` (${moreActive})` : ''}
        </button>
        <button type="button" className="ag-mapfilters__clear" onClick={clearAll} disabled={!anything}>
          <Icon name="cerrar" size={14} strokeWidth={2.4} />
          Borrar filtros
        </button>
        <div className="ag-mapfilters__more">
        <fieldset className="ag-mapfilters__years">
          <legend>
            <Icon name="reloj" size={16} />
            Años
          </legend>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            aria-label="Desde el año"
            placeholder="Desde"
            value={filters.desde}
            onChange={(event) => onChange({ desde: event.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
          <span aria-hidden="true">–</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            aria-label="Hasta el año"
            placeholder="Hasta"
            value={filters.hasta}
            onChange={(event) => onChange({ hasta: event.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
        </fieldset>
        <label className="ag-mapfilters__select">
          <Icon name="camara" size={16} />
          Formato
          <select value={filters.formato} onChange={(event) => onChange({ formato: event.target.value })}>
            <option value={NO_FILTERS.formato}>Todos</option>
            {FORMATS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </label>
        </div>
        <FCode>F11</FCode>
      </div>
    </div>
  )
}
