import { useRef } from 'react'
import { useInView } from './Reveal.jsx'

function Mule({ x, load = '#b8855a' }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="ag-vscene__bob">
        <path d="M2 20c-5 2-6 8-7 12" fill="none" stroke="#3f2c20" strokeWidth="2" strokeLinecap="round" />
        <path className="ag-vscene__leg" d="M8 26v15" stroke="#3f2c20" strokeWidth="3.600" strokeLinecap="round" />
        <path className="ag-vscene__leg ag-vscene__leg--b" d="M14 26v15" stroke="#2e2018" strokeWidth="3.600" strokeLinecap="round" />
        <path className="ag-vscene__leg ag-vscene__leg--b" d="M34 26v15" stroke="#3f2c20" strokeWidth="3.600" strokeLinecap="round" />
        <path className="ag-vscene__leg" d="M40 26v15" stroke="#2e2018" strokeWidth="3.600" strokeLinecap="round" />
        <path d="M3 22c0-7 7-10 16-10h15c6 0 9-3 11-8l8 5c-1 7-5 12-9 15-4 4-10 5-16 5H12c-6 0-9-2-9-7z" fill="#5a3f2d" />
        <path d="M45 4l-1-8 5 5 3-6 1 9 9 11c1 2-1 4-3 3l-11-5z" fill="#5a3f2d" />
        <rect x="9" y="1" width="25" height="19" rx="3" fill={load} />
        <path d="M21 1v19M9 10h25" stroke="#7d5636" strokeWidth="1.600" />
        <circle cx="53" cy="6" r="1" fill="#17261f" />
      </g>
    </g>
  )
}

function Plant({ x, s = 1 }) {
  return (
    <g transform={`translate(${x} 200) scale(${s})`}>
      <g className="ag-vscene__plant">
        <path d="M0 0V-46" stroke="#2c4a33" strokeWidth="3" strokeLinecap="round" />
        <path d="M0-14C-14-20-24-18-30-10-20-6-9-7 0-14ZM0-14C14-20 24-18 30-10 20-6 9-7 0-14ZM0-30C-12-36-20-34-26-27-17-23-8-24 0-30ZM0-30C12-36 20-34 26-27 17-23 8-24 0-30ZM0-46C-6-54-4-60 0-64 4-60 6-54 0-46Z" fill="#2f6a42" />
        <circle cx="-7" cy="-19" r="2.800" fill="#b8323f" />
        <circle cx="-2" cy="-22" r="2.800" fill="#c8453f" />
        <circle cx="6" cy="-20" r="2.800" fill="#b8323f" />
        <circle cx="4" cy="-35" r="2.500" fill="#b8323f" />
        <circle cx="-5" cy="-36" r="2.500" fill="#d9a92e" />
      </g>
    </g>
  )
}

function Cloud({ y, slow, s = 1 }) {
  return (
    <g className={`ag-vscene__cloud${slow ? ' ag-vscene__cloud--slow' : ''}`}>
      <path transform={`translate(0 ${y}) scale(${s})`} d="M10 28a14 14 0 0 1 4-27 22 22 0 0 1 40-2 17 17 0 0 1 28 12 11 11 0 0 1 2 17z" fill="#fff" opacity="0.9" />
    </g>
  )
}

/**
 * A drawn landscape that moves: mules with their load go along the ridge, clouds drift, birds pass and the coffee plants move in
 * the wind. It only says "this is the Sierra": it is decoration, hidden from screen readers. It stops when it is off screen, and
 * for people who ask their phone for less movement (see base.css).
 */
export default function MountainScene() {
  const ref = useRef(null)
  const playing = useInView(ref)
  return (
    <div ref={ref} className={`ag-vscene${playing ? '' : ' ag-vscene--paused'}`} aria-hidden="true">
      <svg viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <linearGradient id="ag-cielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bfe0e6" />
            <stop offset="1" stopColor="#f6efd9" />
          </linearGradient>
        </defs>
        <rect width="1200" height="200" fill="url(#ag-cielo)" />
        <circle cx="930" cy="56" r="26" fill="#f4cf6b" />
        <path d="M0 110L120 70l90 26 130-58 110 50 120-34 110 44 150-68 120 52 110-24 140 50v92H0z" fill="#a9c9c6" />
        <Cloud y={26} s={0.9} />
        <Cloud y={58} s={0.6} slow />
        <g className="ag-vscene__birds" fill="none" stroke="#33433a" strokeWidth="2" strokeLinecap="round">
          <path className="ag-vscene__wing" d="M0 20q6-7 11 0q6-7 11 0" />
          <path className="ag-vscene__wing" d="M34 8q5-6 9 0q5-6 9 0" />
          <path className="ag-vscene__wing" d="M56 26q5-6 9 0q5-6 9 0" />
        </g>
        <path d="M0 138l150-40 170 34 190-46 200 44 170-38 170 36 150-26v98H0z" fill="#6f9f7f" />
        <path d="M0 160c200-30 400-26 600-14s400 10 600-12v66H0z" fill="#3f7350" />
        <g className="ag-vscene__mules">
          <g transform="translate(300 110)">
            <Mule x={0} />
            <Mule x={-96} load="#c79a6c" />
            <Mule x={-192} />
          </g>
        </g>
        <path d="M0 176c220-14 420-12 640-6s380 6 560-8v38H0z" fill="#2c5a3c" />
        <Plant x={70} s={1.1} />
        <Plant x={160} s={0.85} />
        <Plant x={300} s={1.2} />
        <Plant x={470} s={0.9} />
        <Plant x={640} s={1.15} />
        <Plant x={790} s={0.85} />
        <Plant x={960} s={1.2} />
        <Plant x={1120} s={0.95} />
      </svg>
    </div>
  )
}
