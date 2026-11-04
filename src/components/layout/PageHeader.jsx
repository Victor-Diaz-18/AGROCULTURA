/** Title, one-line description and actions at the top of every page (as in the design). */
export default function PageHeader({ title, subtitle, actions, badge }) {
  return (
    <div className="ag-page-head">
      <div className="ag-page-head__text">
        <div className="ag-page-head__title">
          <h1>{title}</h1>
          {badge}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ag-page-head__actions">{actions}</div>}
    </div>
  )
}
