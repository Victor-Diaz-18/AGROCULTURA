import Icon from './Icon.jsx'

/**
 * Buttons of the design. `variant`: primary (red), outline, dark, project
 * (teal), danger, ghost. `size`: sm, md (default), lg.
 */
export default function Button({
  variant = 'outline',
  size = 'md',
  icon,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const classes = ['ag-btn', `ag-btn--${variant}`, size !== 'md' && `ag-btn--${size}`, className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...props}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} strokeWidth={variant === 'primary' ? 2.4 : 2} />}
      {children}
    </button>
  )
}
