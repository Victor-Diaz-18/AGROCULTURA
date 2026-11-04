import { LIMITS } from '../../config/constants.js'
import LocationPicker from '../map/LocationPicker.jsx'
import Chip from '../ui/Chip.jsx'
import FCode from '../ui/FCode.jsx'

/** Step 2, "Dónde y cuándo": title, place (F1), period and tags. */
export default function StepWhereWhen({ config, titulo, onTitulo, location, onLocation, epoca, onEpoca, etiquetas, onToggleTag }) {
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

      <div className="ag-tell__block">
        <div className="ag-tell__row">
          <span className="ag-tell__label">¿Dónde ocurrió? Toca el lugar en el mapa</span>
          <FCode>F1</FCode>
        </div>
        <LocationPicker sectors={config.sectores} value={location} onChange={onLocation} />
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
