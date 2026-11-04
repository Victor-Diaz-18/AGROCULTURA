import FCode from '../ui/FCode.jsx'

export const STEPS = [
  { n: 1, label: 'Cuéntala', codes: 'F3 F4 F5 F13' },
  { n: 2, label: 'Dónde y cuándo', codes: 'F3 F1' },
  { n: 3, label: 'Revisar y enviar', codes: 'F10' },
]

/** The three steps of "Contar una historia": the current one is dark, the finished ones show a check. */
export default function Stepper({ current, ref }) {
  return (
    <ol ref={ref} className="ag-stepper" aria-label="Pasos para contar una historia">
      {STEPS.map(({ n, label, codes }) => {
        const done = n < current
        return (
          <li
            key={n}
            className={`ag-step${done ? ' ag-step--done' : ''}`}
            aria-current={n === current ? 'step' : undefined}
          >
            <span className="ag-step__num" aria-hidden="true">
              {done ? '✓' : n}
            </span>
            <span className="ag-step__label">{label}</span>
            <FCode className="ag-step__codes">{codes}</FCode>
          </li>
        )
      })}
    </ol>
  )
}
