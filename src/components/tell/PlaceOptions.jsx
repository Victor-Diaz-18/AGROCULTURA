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

/** «Lugar aproximado» or «Sin ubicación»: two radio buttons with what each one means. */
export default function PlaceOptions({ modo, onModo }) {
  return (
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
  )
}
