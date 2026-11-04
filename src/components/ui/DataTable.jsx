/**
 * The grid tables of the design (my stories, review, team stories).
 * `columns`: [{ label, align? }]; `template` is the CSS grid-template-columns; `minWidth` keeps it readable on a phone
 * (the card scrolls sideways). Rows are `<TableRow>` children; `empty` is shown instead of rows when there are none.
 */
export default function DataTable({ label, columns, template, minWidth, empty, children }) {
  const style = { '--table-columns': template, '--table-min': `${minWidth}px` }
  return (
    <div className="ag-table-card__scroll">
      <div className="ag-table" role="table" aria-label={label} style={style}>
        <div className="ag-table__head" role="row">
          {columns.map((column) => (
            <span key={column.label} role="columnheader" style={column.align === 'right' ? { textAlign: 'right' } : undefined}>
              {column.label}
            </span>
          ))}
        </div>
        {empty ? <div className="ag-table__empty">{empty}</div> : children}
      </div>
    </div>
  )
}

export function TableRow({ children }) {
  return (
    <div className="ag-table__row" role="row">
      {children}
    </div>
  )
}

export function Cell({ className = '', children, ...props }) {
  return (
    <span role="cell" className={className} {...props}>
      {children}
    </span>
  )
}
