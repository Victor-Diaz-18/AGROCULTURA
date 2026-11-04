import { NavLink } from 'react-router-dom'
import { SHOW_CODES } from '../../config/flags.js'
import Icon from '../ui/Icon.jsx'

/**
 * Side menu shared by the portal and the admin panel.
 * group: { title, items: [{ to, end?, label, icon, code, count?, alert?, locked?, future?, onNavigate? }] }
 * `onNavigate(event)` runs on click; calling `event.preventDefault()` there cancels the navigation.
 */
export default function NavMenu({ groups, variant = 'portal', ariaLabel, top, children }) {
  return (
    <nav aria-label={ariaLabel} className={`ag-nav${variant === 'admin' ? ' ag-nav--admin' : ''}`}>
      {top}
      {groups.map((group) => (
        <div key={group.title} className="ag-nav__group">
          <div className="ag-nav__title">{group.title}</div>
          {group.items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="ag-nav__item" onClick={item.onNavigate}>
              <Icon name={item.icon} size={18} />
              <span className="ag-nav__label">{item.label}</span>
              {item.count > 0 && !item.locked && (
                <span className={`ag-nav__count${item.alert ? ' ag-nav__count--alerta' : ''}`}>{item.count}</span>
              )}
              {item.locked && <Icon name="candado" size={14} className="ag-nav__lock" label="Solo administradores" />}
              {SHOW_CODES && (
                <span className={`ag-nav__code${item.future ? ' ag-nav__code--futura' : ''}`}>{item.code}</span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
      {children}
    </nav>
  )
}
