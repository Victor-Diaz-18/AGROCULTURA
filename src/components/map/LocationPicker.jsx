import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_PROVIDER, ZONE, ZOOM_LIMITS } from '../../config/map.js'
import { inZone, sectorAt } from '../../utils/geo.js'
import Button from '../ui/Button.jsx'

/**
 * Where did it happen? (F3, F1)
 * A story can be anywhere in the area of the map (see ZONE in config/map.js); the sectors are only shortcuts.
 * Three ways, all giving { lat, lon, origen, sectorId }:
 *  - tap a sector button on the map: the story goes to the center of that sector ("sector");
 *  - tap any point of the map ("mapa");
 *  - "Usar mi ubicación", the phone's GPS ("gps"). GPS works without signal.
 * `sectorId` is the sector the point falls in, or null for "another place of the zone". A point outside the area
 * is not accepted. Without map tiles (no signal, nothing cached) the sector buttons and the GPS still work.
 */

const PIN_SVG =
  '<svg width="34" height="41" viewBox="0 0 40 48" aria-hidden="true"><path d="M20 46C20 46 4 32 4 18a16 16 0 0 1 32 0c0 14-16 28-16 28z" fill="#B8323F" stroke="#FFFFFF" stroke-width="2.5"/><circle cx="20" cy="18" r="6" fill="#FFFFFF"/></svg>'
const SECTOR_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'

/** The widest view that still shows nothing but the area of the map (see ZONE): it depends on the size of the map, so it is worked out. */
const zoneBounds = () => L.latLngBounds([ZONE.south, ZONE.west], [ZONE.north, ZONE.east])

export const GPS_MESSAGES = {
  searching: 'Buscando tu ubicación…',
  found: 'Listo: usamos tu ubicación.',
  denied: 'No pudimos ver tu ubicación. Permite la ubicación o elige un sector en el mapa.',
  unavailable: 'No pudimos ubicarte ahora. Toca el mapa o elige un sector.',
  unsupported: 'Este dispositivo no puede darnos tu ubicación. Toca el mapa o elige un sector.',
  outside: 'Tu ubicación queda fuera del área del mapa. Toca en el mapa el lugar donde ocurrió, o elige «Sin ubicación».',
}

export const TAP_MESSAGES = {
  outside: 'Ese punto queda fuera del área del mapa. Elige otro lugar, o elige «Sin ubicación».',
}

const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function sectorIcon(name, selected) {
  return L.divIcon({
    className: 'ag-sector-icon',
    iconSize: null,
    html: `<button type="button" class="ag-sector-pill" aria-pressed="${selected}">${SECTOR_SVG}<span>${escapeHtml(name)}</span></button>`,
  })
}

const pinIcon = L.divIcon({ className: 'ag-location-pin', html: PIN_SVG, iconSize: [34, 41], iconAnchor: [17, 41] })

export default function LocationPicker({ sectors, value, onChange }) {
  const elementRef = useRef(null)
  const mapRef = useRef(null)
  const sectorLayer = useRef(null)
  const pinRef = useRef(null)
  const fitted = useRef(false)
  const onChangeRef = useRef(onChange)
  const sectorsRef = useRef(sectors)
  onChangeRef.current = onChange
  sectorsRef.current = sectors
  const [gps, setGps] = useState({ busy: false, message: '' })

  // The map itself, created once.
  useEffect(() => {
    const map = L.map(elementRef.current, {
      minZoom: ZOOM_LIMITS.min - 1, // until the size of the map is known (below): going further out would only show what is not accepted
      maxZoom: ZOOM_LIMITS.max,
      maxBounds: zoneBounds(),
      maxBoundsViscosity: 1,
      scrollWheelZoom: false, // the page must keep scrolling when the mouse passes over the map
    })
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    L.tileLayer(TILE_PROVIDER.url, {
      attribution: TILE_PROVIDER.attribution,
      maxZoom: TILE_PROVIDER.maxZoom,
      crossOrigin: TILE_PROVIDER.crossOrigin,
    }).addTo(map)
    sectorLayer.current = L.layerGroup().addTo(map)
    map.on('click', (event) => {
      const point = { lat: event.latlng.lat, lon: event.latlng.lng }
      if (!inZone(point)) {
        setGps({ busy: false, message: TAP_MESSAGES.outside })
        return
      }
      setGps({ busy: false, message: '' })
      onChangeRef.current({ ...point, origen: 'mapa', sectorId: sectorAt(point, sectorsRef.current)?.id ?? null })
    })
    mapRef.current = map

    // The widest view is the one that shows the whole area: whatever the size of the map, no further out.
    const limitZoomOut = () => {
      const size = map.getSize()
      if (size.x > 0 && size.y > 0) map.setMinZoom(Math.min(map.getBoundsZoom(zoneBounds()), ZOOM_LIMITS.max))
    }
    limitZoomOut()
    let observer
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        map.invalidateSize()
        limitZoomOut()
      })
      observer.observe(elementRef.current)
    }
    return () => {
      observer?.disconnect()
      map.remove()
      mapRef.current = null
      sectorLayer.current = null
      pinRef.current = null
      fitted.current = false
    }
  }, [])

  // The sector buttons (they show which one is chosen).
  useEffect(() => {
    const map = mapRef.current
    const layer = sectorLayer.current
    if (!map || !layer) return
    layer.clearLayers()
    // A sector whose point is not confirmed gets no shortcut: it would put the story on a made-up place.
    sectors.filter((sector) => !sector.provisional).forEach((sector) => {
      const marker = L.marker([sector.centro.lat, sector.centro.lon], {
        icon: sectorIcon(sector.nombre, value?.sectorId === sector.id),
        keyboard: false, // the button inside is already focusable
        zIndexOffset: 500,
      })
      marker.on('click', () =>
        onChangeRef.current({ lat: sector.centro.lat, lon: sector.centro.lon, origen: 'sector', sectorId: sector.id }),
      )
      layer.addLayer(marker)
    })
    if (sectors.length > 0 && !fitted.current) {
      fitted.current = true
      const bounds = L.latLngBounds(sectors.map((sector) => [sector.centro.lat, sector.centro.lon]))
      const size = map.getSize()
      if (size.x > 0 && size.y > 0) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 })
      else map.setView(bounds.getCenter(), DEFAULT_ZOOM)
    }
  }, [sectors, value?.sectorId])

  // The red pin where the story happened. A chosen sector needs none: its button is already marked.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value || value.origen === 'sector') {
      pinRef.current?.remove()
      pinRef.current = null
      return
    }
    const position = [value.lat, value.lon]
    if (pinRef.current) pinRef.current.setLatLng(position)
    else pinRef.current = L.marker(position, { icon: pinIcon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map)
    if (value.origen === 'gps') map.setView(position, 14)
  }, [value])

  const useMyLocation = () => {
    if (!navigator.geolocation) return setGps({ busy: false, message: GPS_MESSAGES.unsupported })
    setGps({ busy: true, message: GPS_MESSAGES.searching })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lon: coords.longitude }
        if (!inZone(point)) {
          setGps({ busy: false, message: GPS_MESSAGES.outside })
          return
        }
        onChangeRef.current({ ...point, origen: 'gps', sectorId: sectorAt(point, sectorsRef.current)?.id ?? null })
        setGps({ busy: false, message: GPS_MESSAGES.found })
      },
      (failure) => setGps({ busy: false, message: failure?.code === 1 ? GPS_MESSAGES.denied : GPS_MESSAGES.unavailable }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  return (
    <div className="ag-locpicker">
      <div ref={elementRef} className="ag-locpicker__map" role="application" aria-label="Mapa para elegir dónde ocurrió" />
      <div className="ag-locpicker__actions">
        <Button variant="outline" size="sm" icon="pin" onClick={useMyLocation} disabled={gps.busy}>
          Usar mi ubicación
        </Button>
        <span role="status" className="ag-hint">
          {gps.message}
        </span>
      </div>
    </div>
  )
}
