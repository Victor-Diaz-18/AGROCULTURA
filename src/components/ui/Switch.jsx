/** On/off switch with a text label next to it. */
export default function Switch({ checked, onChange, children, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="ag-switch"
      onClick={() => onChange?.(!checked)}
    >
      <span className="ag-switch__track">
        <span className="ag-switch__knob" />
      </span>
      <span className="ag-switch__label">{children}</span>
    </button>
  )
}
