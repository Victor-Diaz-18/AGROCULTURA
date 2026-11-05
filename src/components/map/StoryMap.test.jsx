import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CONFIG, mapStory, storyWithoutPlace } from '../../test/fixtures.js'
import { SECTOR_LABELS_MIN_ZOOM, ZOOM_LIMITS } from '../../config/map.js'
import { mockMapSize } from '../../test/layout.js'
import StoryMap from './StoryMap.jsx'

const sectors = CONFIG.sectores
const far = [
  mapStory({ codigo: 'HIS-2026-001', titulo: 'En Minca', lat: 11.14, lon: -74.118 }),
  mapStory({ codigo: 'HIS-2026-002', titulo: 'En La Tagua', lat: 11.13, lon: -74.087, origen: 'proyecto' }),
  mapStory({ codigo: 'HIS-2026-003', titulo: 'En Tijereras', lat: 11.109, lon: -74.111 }),
]

let restore
beforeEach(() => {
  restore = mockMapSize()
})
afterEach(() => restore())

const setup = (props = {}) => {
  const handlers = { onSelect: vi.fn(), onViewChange: vi.fn() }
  const view = render(<StoryMap stories={far} sectors={sectors} selectedCode={null} focus={null} {...handlers} {...props} />)
  return { ...view, ...handlers }
}
const fillOf = (button) => button.querySelector('path').getAttribute('fill')

describe('StoryMap (F1)', () => {
  it('draws one pin per story, named after it', () => {
    setup()

    for (const title of ['En Minca', 'En La Tagua', 'En Tijereras']) {
      expect(screen.getByRole('button', { name: `Ver ${title}` })).toBeInTheDocument()
    }
    expect(screen.getByRole('application', { name: 'Mapa de historias' })).toBeInTheDocument()
  })

  it('draws no pin for a story that has no place, and does not break', () => {
    setup({ stories: [...far, storyWithoutPlace()] })

    expect(screen.getAllByRole('button', { name: /^Ver / })).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Ver Lo que contaba mi abuela' })).not.toBeInTheDocument()
  })

  it('shows the sectors when the only stories it has are without a place', () => {
    const { onViewChange } = setup({ stories: [storyWithoutPlace()] })

    expect(screen.queryAllByRole('button', { name: /^Ver / })).toHaveLength(0)
    expect(onViewChange).toHaveBeenCalled()
  })

  it('paints the community in red and the project in teal', () => {
    setup()

    expect(fillOf(screen.getByRole('button', { name: 'Ver En Minca' }))).toBe('#B8323F')
    expect(fillOf(screen.getByRole('button', { name: 'Ver En La Tagua' }))).toBe('#2F6F73')
  })

  it('explains the colors', () => {
    const { container } = setup()

    expect(within(container.querySelector('.ag-storymap__legend')).getByText('Comunidad')).toBeInTheDocument()
    expect(within(container.querySelector('.ag-storymap__legend')).getByText('Proyecto')).toBeInTheDocument()
  })

  it('tells which story was tapped', async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()

    await user.click(screen.getByRole('button', { name: 'Ver En La Tagua' }))

    expect(onSelect).toHaveBeenCalledWith(far[1])
  })

  it('marks the selected story: dark, with its title above', () => {
    const { container } = setup({ selectedCode: 'HIS-2026-002' })

    expect(fillOf(screen.getByRole('button', { name: 'Ver En La Tagua' }))).toBe('#17261F')
    expect(fillOf(screen.getByRole('button', { name: 'Ver En Minca' }))).toBe('#B8323F')
    expect(container.querySelector('.ag-pin-tip')).toHaveTextContent('En La Tagua')
  })

  it('un-marks it when the selection goes away', () => {
    const { container, rerender } = setup({ selectedCode: 'HIS-2026-002' })

    rerender(<StoryMap stories={far} sectors={sectors} selectedCode={null} focus={null} onSelect={vi.fn()} onViewChange={vi.fn()} />)

    expect(fillOf(screen.getByRole('button', { name: 'Ver En La Tagua' }))).toBe('#2F6F73')
    expect(container.querySelector('.ag-pin-tip')).toBeNull()
  })

  it('shows what people wrote as text, never as HTML', () => {
    const hostile = mapStory({ codigo: 'HIS-2026-009', titulo: '<img src=x onerror="window.pwned=1"> Trilla' })
    const { container } = setup({ stories: [hostile], selectedCode: 'HIS-2026-009' })

    expect(container.querySelector('.ag-pin-tip img')).toBeNull()
    expect(container.querySelector('.ag-pin-tip')).toHaveTextContent('<img src=x onerror="window.pwned=1"> Trilla')
    expect(container.querySelectorAll('.ag-pin img')).toHaveLength(0)
    expect(window.pwned).toBeUndefined()
  })

  it('groups stories that are close, with how many are in the group', () => {
    const close = [
      mapStory({ codigo: 'HIS-2026-001', titulo: 'Uno', lat: 11.14, lon: -74.118 }),
      mapStory({ codigo: 'HIS-2026-002', titulo: 'Dos', lat: 11.1401, lon: -74.1181 }),
      mapStory({ codigo: 'HIS-2026-003', titulo: 'Tres', lat: 11.1402, lon: -74.1179 }),
    ]
    setup({ stories: close })

    expect(screen.getByRole('button', { name: '3 historias juntas: toca para acercar' })).toHaveTextContent('3')
    expect(screen.queryByRole('button', { name: 'Ver Uno' })).not.toBeInTheDocument()
  })

  describe('the names of the sectors', () => {
    const spread = [
      mapStory({ codigo: 'HIS-2026-001', titulo: 'Oeste', lat: 11.15, lon: -74.3 }),
      mapStory({ codigo: 'HIS-2026-002', titulo: 'Este', lat: 11.05, lon: -73.9 }),
    ]
    const confirmed = sectors.map((sector) => ({ ...sector, provisional: false }))
    const shown = (container) => [...container.querySelectorAll('.ag-sector-label')].filter((label) => !label.hidden).map((label) => label.textContent)
    const zoom = (direction) => screen.getByRole('button', { name: direction === 'in' ? 'Zoom in' : 'Zoom out' })
    const zoomAll = (direction) => {
      for (let step = 0; step < 12 && zoom(direction).getAttribute('aria-disabled') !== 'true'; step++) zoom(direction).click()
    }
    /** From the farthest the map goes, zoom in `levels` levels. */
    const farThenIn = (container, levels) => {
      zoomAll('out')
      for (let step = 0; step < levels; step++) zoom('in').click()
      return shown(container)
    }
    const LEVELS_TO_NAMES = SECTOR_LABELS_MIN_ZOOM - ZOOM_LIMITS.min

    it('are not written while the map is far: a real map does not name a village from the sky', () => {
      const { container } = setup({ stories: spread, sectors: confirmed })
      expect(shown(container)).toEqual([]) // it starts showing all the stories, which is far

      zoomAll('out')
      expect(shown(container)).toEqual([])
      for (let level = 1; level < LEVELS_TO_NAMES; level++) {
        zoom('in').click()
        expect(shown(container)).toEqual([]) // each level below the one where they begin
      }
    })

    it('appear once the map is close enough', () => {
      const { container } = setup({ stories: spread, sectors: confirmed })

      expect(farThenIn(container, LEVELS_TO_NAMES).length).toBeGreaterThan(0)
    })

    it('are written for the sectors that are in view, and no other', () => {
      const { container } = setup({ stories: spread, sectors: confirmed })

      // A level closer the map shows about 7 km by 4 km around its center, where only Tijereras is.
      expect(farThenIn(container, LEVELS_TO_NAMES + 1)).toEqual(['TIJERERAS'])
    })

    it('are not written for a sector whose point has not been confirmed', () => {
      const unsure = sectors.map((sector) => ({ ...sector, provisional: sector.id === 'tijereras' }))
      const { container } = setup({ stories: spread, sectors: unsure })
      const names = new Set()

      zoomAll('out')
      for (let step = 0; step < 8 && zoom('in').getAttribute('aria-disabled') !== 'true'; step++) {
        zoom('in').click()
        shown(container).forEach((name) => names.add(name))
      }

      expect(names.size).toBeGreaterThan(0)
      expect(names.has('TIJERERAS')).toBe(false)
    })

    it('are written when the map starts close up, for the sectors in view', () => {
      const { container } = setup({ sectors: confirmed }) // the stories are in a few km: the map starts at the closest level it fits

      expect(shown(container)).toContain('MINCA')
    })

    it('never show two names one over the other', () => {
      const { container } = setup({ stories: spread, sectors: confirmed })
      zoomAll('out')

      for (let step = 0; step < 8 && zoom('in').getAttribute('aria-disabled') !== 'true'; step++) {
        zoom('in').click()
        const visible = [...container.querySelectorAll('.ag-sector-label')].filter((label) => !label.hidden)
        const points = visible.map((label) => {
          const icon = label.closest('.leaflet-marker-icon')
          const moved = icon.style.transform.match(/-?\d+(\.\d+)?/g)
          return moved ? moved.slice(0, 2).map(Number) : [parseFloat(icon.style.left), parseFloat(icon.style.top)]
        })
        for (let i = 0; i < points.length; i++) {
          for (let j = i + 1; j < points.length; j++) {
            const [dx, dy] = [Math.abs(points[i][0] - points[j][0]), Math.abs(points[i][1] - points[j][1])]
            expect(dx >= 60 || dy >= 16).toBe(true)
          }
        }
      }
    })
  })

  describe('when the filters change (fitKey)', () => {
    const west = mapStory({ codigo: 'HIS-2026-001', titulo: 'Oeste', lat: 11.15, lon: -74.3 })
    const east = mapStory({ codigo: 'HIS-2026-002', titulo: 'Este', lat: 11.05, lon: -73.9 })
    const render2 = (props) => <StoryMap stories={[west, east]} sectors={sectors} selectedCode={null} focus={null} onSelect={vi.fn()} onViewChange={vi.fn()} {...props} />

    it('goes to show the stories that are left', () => {
      const onViewChange = vi.fn()
      const { rerender } = render(render2({ onViewChange, fitKey: 0 }))
      const wide = onViewChange.mock.calls.at(-1)[0]
      expect(wide.west).toBeLessThan(-74.3) // both stories are in view

      rerender(render2({ onViewChange, stories: [east], fitKey: 1 }))

      const close = onViewChange.mock.calls.at(-1)[0]
      expect(close.north - close.south).toBeLessThan(wide.north - wide.south)
      expect(east.lat).toBeGreaterThan(close.south)
      expect(east.lat).toBeLessThan(close.north)
      expect(east.lon).toBeGreaterThan(close.west)
      expect(east.lon).toBeLessThan(close.east)
    })

    it('leaves the view alone when the stories change but the key does not', () => {
      const onViewChange = vi.fn()
      const { rerender } = render(render2({ onViewChange, fitKey: 0 }))
      const before = onViewChange.mock.calls.at(-1)[0]

      rerender(render2({ onViewChange, stories: [east], fitKey: 0 })) // a reload of the stories, not a filter

      expect(onViewChange.mock.calls.at(-1)[0]).toEqual(before)
    })

    it('stays where it is when the filters leave nothing', () => {
      const onViewChange = vi.fn()
      const { rerender } = render(render2({ onViewChange, fitKey: 0 }))
      const before = onViewChange.mock.calls.at(-1)[0]

      rerender(render2({ onViewChange, stories: [], fitKey: 1 }))

      expect(onViewChange.mock.calls.at(-1)[0]).toEqual(before)
    })
  })

  it('tells the page which zone is visible', () => {
    const { onViewChange } = setup()

    const view = onViewChange.mock.calls.at(-1)[0]
    expect(view).toEqual({ south: expect.any(Number), west: expect.any(Number), north: expect.any(Number), east: expect.any(Number) })
    expect(view.north).toBeGreaterThan(view.south)
    expect(view.east).toBeGreaterThan(view.west)
    // the map was fitted to the stories, so all of them are inside
    for (const story of far) {
      expect(story.lat).toBeGreaterThanOrEqual(view.south)
      expect(story.lat).toBeLessThanOrEqual(view.north)
    }
  })

  it('says "unknown" while the map has no size yet', () => {
    restore()
    const { onViewChange } = setup()

    expect(onViewChange.mock.calls.at(-1)[0]).toBeNull()
  })

  it('replaces the pins when the stories change', () => {
    const { rerender } = setup()

    rerender(<StoryMap stories={[far[0]]} sectors={sectors} selectedCode={null} focus={null} onSelect={vi.fn()} onViewChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Ver En Minca' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver En La Tagua' })).not.toBeInTheDocument()
  })

  it('works with no stories at all', () => {
    setup({ stories: [] })

    expect(screen.queryByRole('button', { name: /^Ver / })).not.toBeInTheDocument()
    expect(screen.getByRole('application', { name: 'Mapa de historias' })).toBeInTheDocument()
  })
})

describe('StoryMap: bringing a story into view', () => {
  it('reveals a story that is inside a group', async () => {
    restore = mockMapSize()
    const close = [
      mapStory({ codigo: 'HIS-2026-001', titulo: 'Uno', lat: 11.14, lon: -74.118 }),
      mapStory({ codigo: 'HIS-2026-002', titulo: 'Dos', lat: 11.1401, lon: -74.1181 }),
    ]
    const { rerender } = render(<StoryMap stories={close} sectors={sectors} selectedCode={null} focus={null} onSelect={vi.fn()} onViewChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Ver Uno' })).not.toBeInTheDocument()

    rerender(<StoryMap stories={close} sectors={sectors} selectedCode="HIS-2026-001" focus={{ code: 'HIS-2026-001', nonce: 1 }} onSelect={vi.fn()} onViewChange={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Ver Uno' }, { timeout: 3000 })).toBeInTheDocument()
  })
})
