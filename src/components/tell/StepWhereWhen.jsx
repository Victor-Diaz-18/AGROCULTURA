import { LIMITS, MAX_FARM_NAME, MAX_PLACE_NAME } from '../../config/constants.js'
import LocationPicker from '../map/LocationPicker.jsx'
import Chip from '../ui/Chip.jsx'
import FCode from '../ui/FCode.jsx'

/** The two ways a story can be placed. Nothing else: the narrator chooses how much of "where" is shown, and that is all. */
const OPTIONS = [
  {
    id: 'aproximada',
    title: 'Lugar aproximado',
    text: 'En el mapa se ve un punto a unos 500 metros de donde ocurrió, no el sitio exacto.',
  },
  {
    id: 'ninguna',
    title: 'Sin ubicación',
    text: 'No sale en el mapa. La historia sí aparece en la lista, en la búsqueda y en su ficha.',
  },
]

/**
 * Step 2, "Dónde y cuándo": title, where (F1), period and tags.
 *
 * "¿Dónde ocurrió?" has two options. With «Lugar aproximado» the person taps the map (or uses the phone's location) and the
 * public sees a point rounded to about 500 m. With «Sin ubicación» there is no map and no point: what they may write is a
 * name of reference that only the team reads. The name of the farm or brand is public in both.
 */
export default function StepWhereWhen({ config, titulo, onTitulo, modo, onModo, location, onLocation, lugar, onLugar, finca, onFinca, epoca, onEpoca, etiquetas, onToggleTag }) {
  const withoutPlace = modo === 'ninguna'
  return (
    <>
      <div className="ag-tell__block">
        <label htmlFor="ag-titulo" className="ag-tell__label">
          Ponle un título
        </label>
        <input
          id="ag-titulo"
          type="text"
          className="ag-tell__input"
          value={titulo}
          maxLength={LIMITS.tituloMax}
          onChange={(event) => onTitulo(event.target.value)}
          placeholder="Por ejemplo: la primera siembra de mi abuelo"
        />
      </div>

      <fieldset className="ag-tell__block ag-tell__where">
        <legend className="ag-tell__row">
          <span className="ag-tell__label">¿Dónde ocurrió?</span>
          <FCode>F1</FCode>
        </legend>
        <div className="ag-tell__options">
          {OPTIONS.map((option) => (
            <label key={option.id} className={`ag-option${modo === option.id ? ' ag-option--on' : ''}`}>
              <input
                type="radio"
                name="ag-ubicacion-modo"
                value={option.id}
                checked={modo === option.id}
                onChange={() => onModo(option.id)}
                aria-labelledby={`ag-option-${option.id}-title`}
                aria-describedby={`ag-option-${option.id}-text`}
              />
              <span className="ag-option__body">
                <b id={`ag-option-${option.id}-title`}>{option.title}</b>
                <span id={`ag-option-${option.id}-text`} className="ag-option__text">
                  {option.text}
                </span>
              </span>
            </label>
          ))}
        </div>

        {!withoutPlace && (
          <>
            <span className="ag-tell__label">Toca el lugar en el mapa</span>
            <LocationPicker sectors={config.sectores} value={location} onChange={onLocation} />
            <p className="ag-hint ag-tell__privacy">
              Para cuidar tu privacidad, en el mapa público se ve un punto aproximado (a unos 500 metros), no el sitio exacto.
            </p>
          </>
        )}
      </fieldset>

      <div className="ag-tell__block">
        <label htmlFor="ag-lugar" className="ag-tell__label">
          {withoutPlace ? 'Nombre de referencia' : 'Nombre del lugar'} <span className="ag-tell__optional">(si quieres)</span>
        </label>
        <input
          id="ag-lugar"
          type="text"
          className="ag-tell__input"
          value={lugar}
          maxLength={MAX_PLACE_NAME}
          onChange={(event) => onLugar(event.target.value)}
          aria-describedby="ag-lugar-ayuda"
          placeholder={withoutPlace ? 'Por ejemplo: cerca de San Lorenzo, el camino viejo' : 'Por ejemplo: Finca La Esperanza, el camino viejo'}
        />
        <span id="ag-lugar-ayuda" className="ag-hint">
          {withoutPlace ? 'Solo lo ve el equipo, para revisar la historia. El público no lo ve.' : 'Se verá en la ficha pública de la historia.'}
        </span>
      </div>

      <div className="ag-tell__block">
        <label htmlFor="ag-finca" className="ag-tell__label">
          Nombre de la finca o marca <span className="ag-tell__optional">(si quieres)</span>
        </label>
        <input
          id="ag-finca"
          type="text"
          className="ag-tell__input"
          value={finca}
          maxLength={MAX_FARM_NAME}
          onChange={(event) => onFinca(event.target.value)}
          aria-describedby="ag-finca-ayuda"
          placeholder="Por ejemplo: Café Don Aurelio"
        />
        <span id="ag-finca-ayuda" className="ag-hint">
          Se verá en la ficha pública de la historia.
          {withoutPlace ? ' Piensa si el nombre de la finca dice dónde queda.' : ''}
        </span>
      </div>

      <div className="ag-tell__fields">
        <label className="ag-tell__when">
          ¿Cuándo ocurrió?
          <select className="ag-tell__select" value={epoca} onChange={(event) => onEpoca(event.target.value)}>
            <option value="">Elige una época</option>
            {config.epocas.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="ag-tell__tags">
          <span className="ag-tell__label">Etiquetas</span>
          <div className="ag-tell__chips">
            {config.etiquetas.map((tag) => (
              <Chip key={tag} pressed={etiquetas.includes(tag)} onClick={() => onToggleTag(tag)}>
                {tag}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
