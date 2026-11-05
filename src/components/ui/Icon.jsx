/** Icon set copied from the approved design (24x24, 2px round strokes). */

const PATHS = {
  montana: (
    <>
      <path d="M2.5 20l6.5-12 4 7 2.5-4 6 9z" />
      <path d="M7 11l2 1.5 1.8-1.2" />
    </>
  ),
  hoja: (
    <>
      <path d="M5 19C4 11 10 5 20 4c0 10-6 16-15 15z" />
      <path d="M5 19c3-5 6-8 10-10" />
    </>
  ),
  ave: (
    <>
      <path d="M3 13c3 0 5-1 6-4a5 5 0 0 1 9.5 1L22 11l-3.5 1.500C18 17 14 20 8 20c-3 0-4-1-5-2 3 0 5-1 6-3" />
      <path d="M14.500 9h.01" />
    </>
  ),
  personas: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.300a3.200 3.200 0 0 1 0 5.400M18 14.500a6 6 0 0 1 3 5.500" />
    </>
  ),
  grano: (
    <>
      <ellipse cx="12" cy="12" rx="6.500" ry="9" transform="rotate(35 12 12)" />
      <path d="M17 5c-3 3-1 6-4.500 8S9 16 7 19" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M18.400 5.600L17 7M7 17l-1.400 1.400" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  mapa: (
    <>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  lista: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  bandeja: (
    <>
      <path d="M4 13l2-8h12l2 8v6H4z" />
      <path d="M4 13h5l1 2h4l1-2h5" />
    </>
  ),
  bandera: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  engranaje: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </>
  ),
  globo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  avatar: (
    <>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
      <path d="M3 9V5a2 2 0 0 1 2-2h2M21 9V5a2 2 0 0 0-2-2h-2" />
    </>
  ),
  resumen: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  altavoz: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  wifi: <path d="M5 12.6a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 20h.01" />,
  'wifi-off': (
    <path d="M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 3-1.9M10.7 5.1A15 15 0 0 1 22 9M2 9a15 15 0 0 1 3.5-2.4M12 20h.01" />
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  camara: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </>
  ),
  foto: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M4 18l5-5 4 4 3-3 4 4" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  'enlace-externo': <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  // Filled glyphs (player controls)
  play: <path d="M8 5v14l11-7z" />,
  pausa: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  detener: <rect x="6" y="6" width="12" height="12" rx="2" />,
}

const FILLED = new Set(['play', 'pausa', 'detener'])

export default function Icon({ name, size = 18, strokeWidth = 2, label, className, style }) {
  const filled = FILLED.has(name)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{ flex: 'none', ...style }}
    >
      {PATHS[name]}
    </svg>
  )
}
