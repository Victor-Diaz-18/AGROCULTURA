import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Accessibility in a real browser (WCAG 2.2 AA, with colors and layout, which jsdom cannot judge), on a desktop and on a phone.
 * `npm test` also runs axe on every page without colors; this one adds the contrast.
 */
const check = async (page, name) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const report = result.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
  expect(report, `${name}\n${report.join('\n')}`).toEqual([])
}

const signInAdmin = async (page) => {
  await page.goto('/admin')
  await page.getByLabel('Usuario').fill('admin')
  await page.getByLabel('Contraseña').fill('clave-de-prueba-123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('link', { name: /Revisión/ }).first()).toBeVisible()
}

test('el mapa, su ficha y el ingreso', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ag-storyitem').first()).toBeVisible()
  await check(page, 'mapa')

  await page.locator('.ag-storyitem').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await check(page, 'ficha')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /Ingresar/ }).click()
  await expect(page.getByRole('dialog', { name: 'Ingresar' })).toBeVisible()
  await check(page, 'ingresar')

  await page.getByRole('dialog').getByRole('button', { name: 'Crea una' }).click()
  await expect(page.getByRole('dialog', { name: 'Crear cuenta' })).toBeVisible()
  await check(page, 'crear cuenta')
})

test('el área del narrador: contar en tres pasos y «Mis historias»', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await page.getByRole('dialog', { name: 'Ingresar' }).getByRole('button', { name: 'Crea una' }).click()
  const dialog = page.getByRole('dialog', { name: 'Crear cuenta' })
  await dialog.getByLabel('Nombre de usuario').fill(`Luz Marina Ospina ${String(Date.now()).slice(-5)}`)
  await dialog.getByLabel('Contraseña', { exact: true }).fill('mi clave 7391')
  await dialog.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByRole('link', { name: /Contar una historia/ }).first().click()
  await check(page, 'contar 1')
  await page.getByLabel('O escríbela').fill('Un recuerdo de la finca.')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await check(page, 'contar 2')
  await page.getByLabel('Ponle un título').fill('Mi historia')
  await page.getByRole('button', { name: 'Minca', exact: true }).click()
  await page.getByRole('combobox', { name: /Cuándo ocurrió/ }).selectOption('Antes de 1960')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await check(page, 'contar 3')
  await page.getByRole('link', { name: /Mis historias/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Mis historias' })).toBeVisible()
  await check(page, 'mis historias')
})

test('la administración y sus diálogos', async ({ page }) => {
  await page.goto('/admin')
  await check(page, 'acceso del equipo')
  await signInAdmin(page)
  await check(page, 'resumen')

  await page.getByRole('button', { name: 'Revisar', exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await check(page, 'revisar')
  await page.keyboard.press('Escape')

  for (const [link, name] of [[/Historias del proyecto/, 'historias del proyecto'], [/Configuración/, 'configuración']]) {
    await page.getByRole('link', { name: link }).first().click()
    await page.waitForTimeout(500)
    await check(page, name)
  }
})

test('con el teclado: el primer Tab es «Saltar al contenido» y los grupos del mapa se abren con Enter', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a keyboard test')
  await page.goto('/')
  await expect(page.locator('.ag-storyitem').first()).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#contenido')).toBeFocused()
})
