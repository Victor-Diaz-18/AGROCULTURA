import { expect, test } from '@playwright/test'

/** Moving a real mouse over the map: jsdom has no coordinates, so this can only be tried in a browser. */
test('al pasar el mouse sobre un ícono del mapa sale el nombre, sin clic; y el clic sigue abriendo la ficha', async ({ page }) => {
  await page.goto('/')
  const pin = page.locator('.ag-storymap .ag-pin').first()
  await expect(pin).toBeVisible()
  const name = (await pin.getAttribute('aria-label')).replace(/^Ver /, '')
  await expect(page.locator('.ag-pin-tip')).toHaveCount(0)

  await pin.hover()
  await expect(page.locator('.ag-pin-tip')).toHaveText(name)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.mouse.move(0, 0)
  await expect(page.locator('.ag-pin-tip')).toHaveCount(0)

  await pin.click()
  await expect(page.getByRole('dialog', { name: 'Ficha de la historia' })).toBeVisible()
})
