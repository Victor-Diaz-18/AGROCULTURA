/** Toggle chip (tags, formats). Pressed = dark green. */
export default function Chip({ pressed, onClick, size = 'md', children, ...props }) {
  return (
    <button
      type="button"
      className={`ag-chip ag-chip--${size}`}
      aria-pressed={pressed}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}
