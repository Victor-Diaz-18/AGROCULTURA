import { vi } from 'vitest'

/**
 * jsdom has no layout: every element is 0 x 0 and a Leaflet map cannot know what it shows.
 * This gives the map of stories a size (restore it with the returned function, or vi.restoreAllMocks).
 */
export function mockMapSize(width = 800, height = 470) {
  const isMap = (element) => element.classList?.contains('ag-storymap__map')
  const w = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function () {
    return isMap(this) ? width : 0
  })
  const h = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function () {
    return isMap(this) ? height : 0
  })
  return () => {
    w.mockRestore()
    h.mockRestore()
  }
}
