/** "Comunidad" (red) or "Proyecto" (teal) badge. */
export default function OriginBadge({ origen, size = 'md' }) {
  const label = origen === 'proyecto' ? 'Proyecto' : 'Comunidad'
  return <span className={`ag-origin ag-origin--${origen === 'proyecto' ? 'proyecto' : 'comunidad'} ag-origin--${size}`}>{label}</span>
}
