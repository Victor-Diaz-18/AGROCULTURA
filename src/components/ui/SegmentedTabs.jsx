/**
 * Row of mutually exclusive filter buttons (sector, origin, state...).
 * items: [{ id, label, count?, dot? }]
 */
export default function SegmentedTabs({ items, value, onChange, label, className = '' }) {
  return (
    <div role="group" aria-label={label} className={`ag-tabs ${className}`.trim()}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="ag-tab"
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.dot && <span className="ag-tab__dot" style={{ background: item.dot }} />}
          <span>{item.label}</span>
          {item.count !== undefined && <span className="ag-tab__count">{item.count}</span>}
        </button>
      ))}
    </div>
  )
}
