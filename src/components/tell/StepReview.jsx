import SendNotice from './SendNotice.jsx'

/**
 * Step 3, "Revisar y enviar": what will be sent, as the reader will see it; whether to publish it without the narrator's name;
 * and the authorization to publish it, which the story cannot be sent without.
 *
 * The authorization says what the person chose (with or without their name, with an approximate place or none): when the choice
 * changes, so does the text, and the box has to be ticked again (see utils/consent.js).
 */
export default function StepReview({ summary, online, sendError, anonima, onAnonima, consent, accepted, onAccept }) {
  return (
    <>
      <div className="ag-review">
        <span className="ag-review__kicker">REVISA ANTES DE ENVIAR</span>
        <span className="ag-review__title">{summary.titulo}</span>
        <span className="ag-review__meta">
          {summary.lugar} · {summary.epoca} · Narra {summary.narrador}
          {summary.finca ? ` · Finca o marca: ${summary.finca}` : ''}
        </span>
      </div>
      <p className="ag-review__text">{summary.texto}</p>
      <div className="ag-review__tags">
        {summary.formatos.map((format) => (
          <span key={format} className="ag-format">
            {format}
          </span>
        ))}
        {summary.etiquetas.map((tag) => (
          <span key={tag} className="ag-tagpill">
            {tag}
          </span>
        ))}
      </div>

      <div className="ag-tell__block">
        <label className="ag-option ag-option--check">
          <input
            type="checkbox"
            checked={anonima}
            onChange={(event) => onAnonima(event.target.checked)}
            aria-labelledby="ag-anonima-titulo"
            aria-describedby="ag-anonima-ayuda"
          />
          <span className="ag-option__body">
            <b id="ag-anonima-titulo">Publicar sin mi nombre</b>
            <span id="ag-anonima-ayuda" className="ag-option__text">
              En el mapa, la lista y la ficha se verá «Narrador anónimo». El equipo sí ve tu nombre.
            </span>
          </span>
        </label>
        {anonima && (
          <p className="ag-hint ag-tell__privacy">Si no quieres que se sepa quién eres, tampoco escribas tu nombre en el título ni en la historia.</p>
        )}
      </div>

      <div className="ag-consent">
        <label className="ag-consent__box">
          <input type="checkbox" checked={accepted} onChange={(event) => onAccept(event.target.checked)} aria-required="true" aria-describedby="ag-consent-aviso" />
          <span className="ag-consent__text">{consent.texto}</span>
        </label>
        {consent.aviso && (
          <p id="ag-consent-aviso" className="ag-hint">
            {consent.aviso}
          </p>
        )}
      </div>

      <SendNotice online={online} />
      {sendError && (
        <p role="alert" className="ag-error">
          {sendError}
        </p>
      )}
    </>
  )
}
