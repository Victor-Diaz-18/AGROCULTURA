import { expect, test } from '@playwright/test'

/**
 * The tour: what a family and the team really do, in a real browser against the real API (e2e/server.py).
 * The steps share one database, so they run one after another and the later ones use what the earlier ones made.
 */
test.describe.configure({ mode: 'serial' })

const PHONE = `3${String(Date.now()).slice(-9)}` // a new person every run
const STORY = `El camino de mulas ${String(Date.now()).slice(-5)}`
const ADMIN = { usuario: 'admin', clave: 'clave-de-prueba-123' }

async function signUp(page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Ingresar/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ingresar' })
  await dialog.getByLabel('Tu nombre').fill('Rosa Elena Pérez')
  await dialog.getByLabel('Número de celular').fill(PHONE)
  await dialog.getByLabel('Elige una clave de 4 a 6 números').fill('4821')
  await dialog.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText('Rosa Elena Pérez').first()).toBeVisible()
}

async function tellStory(page, { title, text }) {
  await page.getByRole('link', { name: /Contar una historia/ }).first().click()
  await page.getByLabel('O escríbela').fill(text)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByLabel('Ponle un título').fill(title)
  await page.getByRole('button', { name: 'Minca', exact: true }).click()
  await page.getByRole('combobox', { name: /Cuándo ocurrió/ }).selectOption('Antes de 1960')
  await page.getByRole('button', { name: 'Siguiente' }).click()
}

test('una familia crea su cuenta, cuenta una historia y la ve en «Mis historias» en revisión', async ({ page }) => {
  await signUp(page)
  await tellStory(page, { title: STORY, text: 'Antes de que hubiera carretera, el café bajaba en mula por el camino viejo.' })
  await expect(page.getByText('REVISA ANTES DE ENVIAR')).toBeVisible()
  await expect(page.getByText('Hay señal', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Enviar historia' }).click()

  await expect(page.getByRole('heading', { name: 'Mis historias' })).toBeVisible()
  const row = page.getByRole('row', { name: new RegExp(STORY) })
  await expect(row).toContainText('En revisión')
  await expect(row).toContainText(/HIS-\d{4}-\d{3}/)
})

test('lo que está en revisión no aparece en el mapa público', async ({ browser }) => {
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto('/')
  await expect(visitor.getByRole('list', { name: 'Historias en esta zona del mapa' })).toBeVisible()
  await expect(visitor.getByText(STORY)).toHaveCount(0)
})

test('el equipo entra, revisa la historia, hace las tres comprobaciones y la aprueba', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('Usuario').fill(ADMIN.usuario)
  await page.getByLabel('Contraseña').fill(ADMIN.clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.getByRole('link', { name: /Revisión/ }).first().click()

  await page.getByRole('row', { name: new RegExp(STORY) }).getByRole('button', { name: 'Revisar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revisar historia' })
  await expect(dialog.getByRole('heading', { name: STORY })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Aprobar y publicar' })).toBeDisabled() // not before the three checks
  for (const check of [/cultura cafetera/, /Minca o en un sector/, /datos personales/]) await dialog.getByRole('checkbox', { name: check }).click()
  await dialog.getByRole('button', { name: 'Aprobar y publicar' }).click()

  await expect(page.getByText(/publicada/i).first()).toBeVisible()
})

test('ya aprobada, cualquier visitante la encuentra en el mapa, la busca, la abre y ve su ficha', async ({ browser }) => {
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto('/')

  const list = visitor.getByRole('list', { name: 'Historias en esta zona del mapa' })
  await expect(list.getByRole('button', { name: new RegExp(STORY) })).toBeVisible()

  const search = visitor.getByRole('searchbox', { name: 'Buscar historias' })
  await search.fill('rosa elena') // by narrator: hers and the example story of another Rosa Elena
  await expect(list.getByRole('button', { name: new RegExp(STORY) })).toBeVisible()
  await search.fill(STORY.split(' ').at(-1)) // by a word only her title has
  await expect(list.getByRole('button')).toHaveCount(1)
  await search.fill('zzzz')
  await expect(visitor.getByText('No hay historias con estos filtros')).toBeVisible()
  await visitor.getByRole('button', { name: 'Quitar los filtros' }).click()

  await list.getByRole('button', { name: new RegExp(STORY) }).click()
  const card = visitor.getByRole('dialog', { name: 'Ficha de la historia' })
  await expect(card.getByRole('heading', { name: STORY })).toBeVisible()
  await expect(card).toContainText('Rosa Elena Pérez')
  await expect(card).toContainText('Antes de 1960')
})

test('sin señal la familia guarda su historia en el dispositivo y sale sola al volver la conexión', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Ingresar/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ingresar' })
  await dialog.getByRole('button', { name: 'Ya tengo cuenta' }).click()
  await dialog.getByLabel('Número de celular').fill(PHONE)
  await dialog.getByLabel('Tu clave').fill('4821')
  await dialog.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByText('Rosa Elena Pérez').first()).toBeVisible()

  const second = `${STORY} sin señal`
  await tellStory(page, { title: second, text: 'Esta historia se cuenta sin señal.' })
  await context.setOffline(true) // the real connection goes away
  await expect(page.getByText('Se guarda en el dispositivo y se envía sola cuando vuelva la señal.')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar en el dispositivo' }).click()
  const row = page.getByRole('row', { name: new RegExp(second) })
  await expect(row).toContainText('Borrador')
  await expect(row).toContainText('Por asignar')

  await context.setOffline(false)

  await expect(page.getByText(/Volvió la señal: se envió 1 borrador a revisión/)).toBeVisible()
  await expect(row).toContainText('En revisión')
  await expect(row).toContainText(/HIS-\d{4}-\d{3}/)
})

test('lo que quedó a medias se recupera al volver', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Ingresar/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ingresar' })
  await dialog.getByRole('button', { name: 'Ya tengo cuenta' }).click()
  await dialog.getByLabel('Número de celular').fill(PHONE)
  await dialog.getByLabel('Tu clave').fill('4821')
  await dialog.getByRole('button', { name: 'Ingresar' }).click()
  await page.getByRole('link', { name: /Contar una historia/ }).first().click()
  await page.getByLabel('O escríbela').fill('Algo que no alcancé a terminar.')
  await page.waitForTimeout(900) // it is kept on the phone a moment after the typing stops

  await page.reload()

  await expect(page.getByText('Recuperamos la historia que dejaste a medias.')).toBeVisible()
  await expect(page.getByLabel('O escríbela')).toHaveValue('Algo que no alcancé a terminar.')
})
