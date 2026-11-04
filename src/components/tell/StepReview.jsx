import SendNotice from './SendNotice.jsx'

/** Step 3, "Revisar y enviar": what will be sent, as the reader will see it. */
export default function StepReview({ summary, online, sendError }) {
  return (
    <>
      <div className="ag-review">
        <span className="ag-review__kicker">REVISA ANTES DE ENVIAR</span>
        <span className="ag-review__title">{summary.titulo}</span>
        <span className="ag-review__meta">
          {summary.lugar} · {summary.epoca} · Narra {summary.narrador}
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
      <SendNotice online={online} />
      {sendError && (
        <p role="alert" className="ag-error">
          {sendError}
        </p>
      )}
    </>
  )
}
