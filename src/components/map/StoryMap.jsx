import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { DEFAULT_CENTER, DEFAULT_ZOOM, SECTOR_LABELS_MAX_ZOOM, TILE_PROVIDER, ZOOM_LIMITS } from '../../config/map.js'
import { pointsOf } from '../../utils/geo.js'
import FCode from '../ui/FCode.jsx'

/**
 * The map of published stories (F1): one pin per story, red for the community and teal for the project
 * (F12), grouped when they are close. It is a Leaflet map built once; React only tells it what to show.
 *
 *  - stories: [{ codigo, titulo, origen, lat, lon }]
 *  - selectedCode: the story marked on the map (dark, bigger, with its title)
 *  - focus: { code, nonce }: asks to bring that story into view (the same code can be asked again)
 *  - onSelect(story): a pin was tapped
 *  - onViewChange(bounds): the visible zone changed: { south, west, north, east }, or null while the map has no size
 *
 * Everything that comes from people (titles, sector names) goes in as text, never as HTML.
 */

const PIN_PATH = 'M20 46C20 46 4 32 4 18a16 16 0 0 1 32 0c0 14-16 28-16 28z'
const SIZES = { normal: [34, 41], selected: [46, 55] }
const COLORS = { comunidad: '#B8323F', proyecto: '#2F6F73', selected: '#17261F' }

const svg = (name, attrs = {}) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name)
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value))
  return element
}

function pinElement(story, selected) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ag-pin'
  button.setAttribute('aria-label', `Ver ${story.titulo}`)
  const drawing = svg('svg', { width: '100%', height: '100%', viewBox: '0 0 40 48', 'aria-hidden': 'true' })
  drawing.append(
    svg('path', { d: PIN_PATH, fill: selected ? COLORS.selected : (COLORS[story.origen] ?? COLORS.comunidad), stroke: '#FFFFFF', 'stroke-width': '2.5' }),
    svg('circle', { cx: '20', cy: '18', r: '6', fill: '#FFFFFF' }),
  )
  button.append(drawing)
  return button
}

function pinIcon(story, selected) {
  const [width, height] = selected ? SIZES.selected : SIZES.normal
  return L.divIcon({ className: 'ag-pin-icon', html: pinElement(story, selected), iconSize: [width, height], iconAnchor: [width / 2, height] })
}

function clusterIcon(cluster) {
  const count = cluster.getChildCount()
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ag-cluster'
  button.setAttribute('aria-label', `${count} historias juntas: toca para acercar`)
  button.textContent = String(count)
  return L.divIcon({ className: 'ag-cluster-icon', html: button, iconSize: [44, 44] })
}

function sectorLabel(sector) {
  const label = document.createElement('span')
  label.className = 'ag-sector-label'
  label.textContent = sector.nombre.toUpperCase()
  return L.marker([sector.centro.lat, sector.centro.lon], {
    icon: L.divIcon({ className: 'ag-sector-label-icon', html: label, iconSize: [0, 0] }),
    interactive: false,
    keyboard: false,
    zIndexOffset: -1000,
  })
}

/** The sector names are shown only while the map is far enough; they leave as one zooms in, like a map's own labels. */
function syncSectorLabels(map, layer) {
  if (!map || !layer) return
  const show = map.getZoom() <= SECTOR_LABELS_MAX_ZOOM
  if (show && !map.hasLayer(layer)) map.addLayer(layer)
  else if (!show && map.hasLayer(layer)) map.removeLayer(layer)
}

function viewOf(map) {
  const size = map.getSize()
  if (size.x === 0 || size.y === 0) return null // not laid out (nothing to measure)
  const bounds = map.getBounds()
  return { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() }
}

export default function StoryMap({ stories, sectors, selectedCode, focus, onSelect, onViewChange }) {
  const elementRef = useRef(null)
  const mapRef = useRef(null)
  const clusterRef = useRef(null)
  const sectorLayerRef = useRef(null)
  const markers = useRef(new Map()) // story code -> { marker, story }
  const selectedRef = useRef(selectedCode)
  const fitted = useRef(false)
  const onSelectRef = useRef(onSelect)
  const onViewChangeRef = useRef(onViewChange)
  selectedRef.current = selectedCode
  onSelectRef.current = onSelect
  onViewChangeRef.current = onViewChange

  // The map itself, created once.
  useEffect(() => {
    const map = L.map(elementRef.current, {
      minZoom: ZOOM_LIMITS.min,
      maxZoom: ZOOM_LIMITS.max,
      scrollWheelZoom: false, // the page must keep scrolling when the mouse passes over the map
    })
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    L.tileLayer(TILE_PROVIDER.url, { attribution: TILE_PROVIDER.attribution, maxZoom: TILE_PROVIDER.maxZoom }).addTo(map)
    sectorLayerRef.current = L.layerGroup() // added to the map only while the zoom allows it
    clusterRef.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      iconCreateFunction: clusterIcon,
    }).addTo(map)
    const emit = () => onViewChangeRef.current?.(viewOf(map))
    map.on('moveend', emit)
    map.on('zoomend', () => syncSectorLabels(map, sectorLayerRef.current))
    mapRef.current = map

    let observer
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        map.invalidateSize()
        emit()
      })
      observer.observe(elementRef.current)
    }
    return () => {
      observer?.disconnect()
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      sectorLayerRef.current = null
      markers.current = new Map()
      fitted.current = false
    }
  }, [])

  // The names of the sectors, where the sectors are.
  useEffect(() => {
    const layer = sectorLayerRef.current
    if (!layer) return
    layer.clearLayers()
    sectors.forEach((sector) => layer.addLayer(sectorLabel(sector)))
    syncSectorLabels(mapRef.current, layer)
  }, [sectors])

  // One pin per story. The tooltip of the selected one is made of text, not HTML.
  useEffect(() => {
    const cluster = clusterRef.current
    const map = mapRef.current
    if (!cluster || !map) return
    cluster.clearLayers()
    markers.current = new Map()
    const layers = stories.map((story) => {
      const marker = L.marker([story.lat, story.lon], { icon: pinIcon(story, false), keyboard: false })
      marker.on('click', () => onSelectRef.current?.(story))
      markers.current.set(story.codigo, { marker, story })
      return marker
    })
    cluster.addLayers(layers)

    if (!fitted.current) {
      const points = stories.length > 0 ? pointsOf(stories) : sectors.map((sector) => [sector.centro.lat, sector.centro.lon])
      if (points.length > 0) {
        fitted.current = true
        const size = map.getSize()
        if (size.x > 0 && size.y > 0) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13, animate: false })
        else map.setView(L.latLngBounds(points).getCenter(), DEFAULT_ZOOM)
      }
    }
    syncSectorLabels(map, sectorLayerRef.current)
    onViewChangeRef.current?.(viewOf(map))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories])

  // The marked story: dark, bigger, with its title above.
  useEffect(() => {
    markers.current.forEach(({ marker, story }, code) => {
      const selected = code === selectedCode
      marker.setIcon(pinIcon(story, selected))
      marker.setZIndexOffset(selected ? 1000 : 0)
      marker.unbindTooltip()
      if (selected) {
        const title = document.createElement('span')
        title.textContent = story.titulo
        marker.bindTooltip(title, { permanent: true, direction: 'top', offset: [0, -52], className: 'ag-pin-tip', opacity: 1 }).openTooltip()
      }
    })
  }, [selectedCode, stories])

  // Bring a story into view, even when it is inside a group.
  useEffect(() => {
    if (!focus?.code) return
    const entry = markers.current.get(focus.code)
    const map = mapRef.current
    if (!entry || !map) return
    const { marker } = entry
    clusterRef.current.zoomToShowLayer(marker, () => {
      if (!map.getBounds().contains(marker.getLatLng())) map.panTo(marker.getLatLng())
    })
  }, [focus, stories])

  return (
    <div className="ag-storymap">
      <div ref={elementRef} className="ag-storymap__map" role="application" aria-label="Mapa de historias" />
      <div className="ag-storymap__legend">
        <span>
          <i style={{ background: COLORS.comunidad }} />
          Comunidad
        </span>
        <span>
          <i style={{ background: COLORS.proyecto }} />
          Proyecto
        </span>
      </div>
      <FCode className="ag-storymap__code">F1</FCode>
    </div>
  )
}
