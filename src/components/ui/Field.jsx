/** A label with its input inside (the label text is the accessible name). */
export default function Field({ label, children }) {
  return (
    <label className="ag-field">
      {label}
      {children}
    </label>
  )
}
