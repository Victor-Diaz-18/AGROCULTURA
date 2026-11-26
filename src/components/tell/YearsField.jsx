import { checkYears, YEAR_MIN } from '../../utils/years.js'

/**
 * «¿En qué año ocurrió?»: the first year and, if it lasted, the last one. It says what is wrong as soon as both are written.
 * Used when a narrator tells a story and when the team publishes one.
 */
export default function YearsField({ id, desde, hasta, onDesde, onHasta, className = '' }) {
  const thisYear = new Date().getFullYear()
  const problem = desde.trim() ? checkYears(desde, hasta) : ''
  const input = (value, onChange, label, idSuffix) => (
    <div className="ag-years__field">
      <label htmlFor={`${id}-${idSuffix}`}>{label}</label>
      <input
        id={`${id}-${idSuffix}`}
        className="ag-input ag-years__input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder={idSuffix === 'desde' ? 'Ej.: 1965' : 'Ej.: 1970'}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
        aria-invalid={problem ? true : undefined}
        aria-describedby={`${id}-ayuda`}
      />
    </div>
  )
  return (
    <fieldset className={`ag-years ${className}`.trim()}>
      <legend className="ag-years__legend">¿En qué año ocurrió?</legend>
      <div className="ag-years__row">
        {input(desde, onDesde, 'Desde', 'desde')}
        {input(hasta, onHasta, 'Hasta (opcional)', 'hasta')}
      </div>
      <span id={`${id}-ayuda`} className="ag-hint">
        Si fue en un solo año, deja «Hasta» vacío. Entre {YEAR_MIN} y {thisYear}.
      </span>
      {problem && (
        <span role="alert" className="ag-error">
          {problem}
        </span>
      )}
    </fieldset>
  )
}
