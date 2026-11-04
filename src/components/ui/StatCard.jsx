import Icon from './Icon.jsx'

/** Summary card of the map page and the admin dashboard. `tone="aviso"` is the yellow one. */
export default function StatCard({ icon, title, tone = 'normal', children }) {
  return (
    <div className={`ag-stat ag-stat--${tone}`}>
      <div className="ag-stat__title">
        <span className="ag-stat__icon">
          <Icon name={icon} size={18} />
        </span>
        {title}
      </div>
      {children}
    </div>
  )
}
