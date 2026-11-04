import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Runs axe-core (the accessibility checker) over what is on the page and fails with a readable list.
 * jsdom has no layout or colors, so the contrast rule is checked in a real browser instead (see e2e/).
 */
export async function expectAccessible(root = document.body, options = {}) {
  const result = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, ...options.rules },
  })
  const report = result.violations.map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => `   ${node.target.join(' ')}`).join('\n')}`)
  expect(report, report.join('\n')).toEqual([])
}
