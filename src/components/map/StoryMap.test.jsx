import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CONFIG, mapStory } from '../../test/fixtures.js'
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
    const labels = (container) => [...container.querySelectorAll('.ag-sector-label')].map((label) => label.textContent)

    it('are written on the map while it is far away', () => {
      const { container } = setup({ stories: spread })

      expect(labels(container)).toEqual(['MINCA', 'LA TAGUA', 'SAN LORENZO', 'TIJERERAS'])
    })

    it('are not there when the map starts close up', () => {
      const { container } = setup() // the stories are a few hundred meters apart: the map starts zoomed in

      expect(labels(container)).toEqual([])
    })

    it('go away as the map is zoomed in and come back when it is zoomed out', () => {
      const { container } = setup({ stories: spread })
      expect(labels(container)).toHaveLength(4)

      for (let step = 0; step < 3; step++) screen.getByRole('button', { name: 'Zoom in' }).click()
      expect(labels(container)).toEqual([])

      for (let step = 0; step < 3; step++) screen.getByRole('button', { name: 'Zoom out' }).click()
      expect(labels(container)).toHaveLength(4)
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
