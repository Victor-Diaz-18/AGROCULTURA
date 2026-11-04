/** Marks the part of a page that a later development block fills in. Removed as blocks land. */
export default function PendingBlock({ children, block }) {
  return (
    <div className="ag-pending">
      <b>En construcción · bloque {block}</b>
      <span>{children}</span>
    </div>
  )
}
