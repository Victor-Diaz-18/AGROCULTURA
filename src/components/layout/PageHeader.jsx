import usePageTitle from '../../hooks/usePageTitle.js'

/**
 * Title, one-line description and actions at the top of every page (as in the design).
 * The title also names the browser tab, and the heading can take the focus when the person moves to this page
 * (see the shells), so a screen reader says where they are.
 */
export default function PageHeader({ title, subtitle, actions, badge }) {
  usePageTitle(title)
  return (
    <div className="ag-page-head">
      <div className="ag-page-head__text">
        <div className="ag-page-head__title">
          <h1 tabIndex={-1}>{title}</h1>
          {badge}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ag-page-head__actions">{actions}</div>}
    </div>
  )
}
