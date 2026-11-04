import { describe, expect, it } from 'vitest'
import { CONFIG, mapStory } from '../test/fixtures.js'
import { NO_FILTERS, OTHER_SECTOR, applyFilters, isFiltering, plain, sectorTabs } from './filters.js'

const sectors = CONFIG.sectores
const stories = [
  mapStory({ codigo: 'HIS-2026-001', titulo: 'El camino de mulas', narrador_nombre: 'Aurelio Martínez', sector_id: 'minca', epoca: 'Antes de 1960', formatos: ['Audio', 'Foto'], origen: 'comunidad', etiquetas: ['#café', '#arriería'] }),
  mapStory({ codigo: 'HIS-2026-002', titulo: 'La primera cosecha', narrador_nombre: 'Rosa Elena Pérez', sector_id: 'la-tagua', epoca: '1960 a 1979', formatos: ['Foto', 'Audio'], origen: 'comunidad', etiquetas: ['#cosecha'] }),
  mapStory({ codigo: 'HIS-2026-003', titulo: 'La fiesta de fin de cosecha', narrador_nombre: 'Equipo AGROCULTURA', sector_id: 'minca', epoca: '2000 en adelante', formatos: ['Video', 'Foto'], origen: 'proyecto', etiquetas: ['#familia'] }),
  mapStory({ codigo: 'HIS-2026-004', titulo: 'Un secadero a la orilla del camino', narrador_nombre: 'Luz Marina Ospina', sector_id: null, lugar_nombre: 'Finca La Esperanza', epoca: '1980 a 1999', formatos: ['Texto'], origen: 'comunidad', etiquetas: [] }),
]
const codes = (list) => list.map((story) => story.codigo)
const find = (changes) => codes(applyFilters(stories, { ...NO_FILTERS, ...changes }, sectors))

describe('filters of the map (F11)', () => {
  it('shows everything when nothing is chosen', () => {
    expect(find({})).toEqual(codes(stories))
    expect(isFiltering(NO_FILTERS)).toBe(false)
  })

  it('filters by sector, and by "otro lugar" for the ones that are in none', () => {
    expect(find({ sector: 'minca' })).toEqual(['HIS-2026-001', 'HIS-2026-003'])
    expect(find({ sector: 'la-tagua' })).toEqual(['HIS-2026-002'])
    expect(find({ sector: OTHER_SECTOR })).toEqual(['HIS-2026-004'])
    expect(find({ sector: 'san-lorenzo' })).toEqual([])
  })

  it('filters by origin, period and format', () => {
    expect(find({ origen: 'proyecto' })).toEqual(['HIS-2026-003'])
    expect(find({ epoca: '1960 a 1979' })).toEqual(['HIS-2026-002'])
    expect(find({ formato: 'Video' })).toEqual(['HIS-2026-003'])
    expect(find({ formato: 'Texto' })).toEqual(['HIS-2026-004'])
    expect(find({ formato: 'Audio' })).toEqual(['HIS-2026-001', 'HIS-2026-002'])
  })

  describe('the search', () => {
    it('looks in the title, the narrator, the place, the period and the tags', () => {
      expect(find({ q: 'mulas' })).toEqual(['HIS-2026-001']) // title
      expect(find({ q: 'rosa' })).toEqual(['HIS-2026-002']) // narrator
      expect(find({ q: 'esperanza' })).toEqual(['HIS-2026-004']) // name of the place
      expect(find({ q: 'tagua' })).toEqual(['HIS-2026-002']) // sector
      expect(find({ q: '1980' })).toEqual(['HIS-2026-004']) // period
      expect(find({ q: '#familia' })).toEqual(['HIS-2026-003']) // tag
      expect(find({ q: 'otro lugar' })).toEqual(['HIS-2026-004']) // a story in no sector is "Otro lugar de la zona"
    })

    it('does not care about accents or capitals', () => {
      expect(find({ q: 'cafe' })).toEqual(codes(stories.slice(0, 1))) // "#café" is a tag of the first one only
      expect(find({ q: 'ARRIERIA' })).toEqual(['HIS-2026-001'])
      expect(find({ q: 'martinez' })).toEqual(['HIS-2026-001'])
      expect(find({ q: 'PÉREZ' })).toEqual(['HIS-2026-002'])
    })

    it('wants every word, in any order', () => {
      expect(find({ q: 'cosecha pérez' })).toEqual(['HIS-2026-002'])
      expect(find({ q: 'pérez cosecha' })).toEqual(['HIS-2026-002'])
      expect(find({ q: 'cosecha mulas' })).toEqual([])
    })

    it('ignores extra spaces and an empty search', () => {
      expect(find({ q: '   ' })).toEqual(codes(stories))
      expect(find({ q: '  fiesta   cosecha ' })).toEqual(['HIS-2026-003'])
    })

    it('finds a story that has no tags', () => {
      expect(find({ q: 'secadero' })).toEqual(['HIS-2026-004'])
    })
  })

  it('combines the filters', () => {
    expect(find({ sector: 'minca', origen: 'comunidad' })).toEqual(['HIS-2026-001'])
    expect(find({ sector: 'minca', formato: 'Video', q: 'fiesta' })).toEqual(['HIS-2026-003'])
    expect(find({ sector: 'minca', epoca: '1960 a 1979' })).toEqual([])
  })

  it('knows when something is being filtered', () => {
    expect(isFiltering({ ...NO_FILTERS, q: 'x' })).toBe(true)
    expect(isFiltering({ ...NO_FILTERS, sector: 'minca' })).toBe(true)
  })

  describe('the sector tabs', () => {
    it('count what each sector would show with the other filters', () => {
      const tabs = sectorTabs(stories, NO_FILTERS, sectors)

      expect(tabs.map((tab) => [tab.label, tab.count])).toEqual([
        ['Todos', 4], ['Minca', 2], ['La Tagua', 1], ['San Lorenzo', 0], ['Tijereras', 0], ['Otro lugar', 1],
      ])
      const video = sectorTabs(stories, { ...NO_FILTERS, formato: 'Video' }, sectors)
      expect(video.map((tab) => tab.count)).toEqual([1, 1, 0, 0, 0, 0])
    })

    it('do not count by the sector that is chosen: the other sectors still show their numbers', () => {
      const tabs = sectorTabs(stories, { ...NO_FILTERS, sector: 'la-tagua' }, sectors)

      expect(tabs.find((tab) => tab.id === 'minca').count).toBe(2)
    })

    it('have "Otro lugar" only when some story is in no sector', () => {
      const inSectors = stories.filter((story) => story.sector_id)

      expect(sectorTabs(inSectors, NO_FILTERS, sectors).map((tab) => tab.id)).not.toContain(OTHER_SECTOR)
    })
  })

  it('plain() drops accents and capitals', () => {
    expect(plain('Ñandú Ciénaga ÁÉÍÓÚ')).toBe('nandu cienaga aeiou')
    expect(plain(null)).toBe('')
  })
})
