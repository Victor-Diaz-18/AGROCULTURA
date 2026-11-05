import { expect, test } from '@playwright/test'

/**
 * The tour: what a family and the team really do, in a real browser against the real API (e2e/server.py).
 * The steps share one database, so they run one after another and the later ones use what the earlier ones made.
 */
test.describe.configure({ mode: 'serial' })

const FAMILY = { usuario: `Rosa Elena Pérez ${String(Date.now()).slice(-5)}`, clave: 'mi cafetal 2026' } // a new person every run
const STORY = `El camino de mulas ${String(Date.now()).slice(-5)}`
const ADMIN = { usuario: 'admin', clave: 'clave-de-prueba-123' }

async function signUp(page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Ingresar/ }).click()
  await page.getByRole('dialog', { name: 'Ingresar' }).getByRole('button', { name: 'Crea una' }).click() // «¿No tienes cuenta? Crea una»
  const dialog = page.getByRole('dialog', { name: 'Crear cuenta' })
  await dialog.getByLabel('Nombre de usuario').fill(FAMILY.usuario)
  await dialog.getByLabel('Contraseña', { exact: true }).fill(FAMILY.clave) // not «Mostrar la contraseña»
  await dialog.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText('Rosa Elena Pérez').first()).toBeVisible()
}

/** The authorization to publish, which a story cannot be sent (or kept on the phone) without. */
const authorize = (page) => page.getByRole('checkbox', { name: /^Autorizo que mi historia se publique/ }).check()

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
  await expect(page.getByRole('button', { name: 'Enviar historia' })).toBeDisabled() // not without the authorization
  await authorize(page)

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

test('el equipo entra, revisa la historia, hace las cuatro comprobaciones y la aprueba', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('Usuario').fill(ADMIN.usuario)
  await page.getByLabel('Contraseña').fill(ADMIN.clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.getByRole('link', { name: /Revisión/ }).first().click()

  await page.getByRole('row', { name: new RegExp(STORY) }).getByRole('button', { name: 'Revisar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revisar historia' })
  await expect(dialog.getByRole('heading', { name: STORY })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Aprobar y publicar' })).toBeDisabled() // not before the four checks
  for (const check of [/cultura cafetera/, /zona cafetera de Minca y sus alrededores/, /datos personales/, /El narrador dio su consentimiento/]) await dialog.getByRole('checkbox', { name: check }).click()
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
  await dialog.getByLabel('Usuario').fill(FAMILY.usuario.toLowerCase()) // the same user name, whatever the capitals
  await dialog.getByLabel('Contraseña', { exact: true }).fill(FAMILY.clave)
  await dialog.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByText('Rosa Elena Pérez').first()).toBeVisible()

  const second = `${STORY} sin señal`
  await tellStory(page, { title: second, text: 'Esta historia se cuenta sin señal.' })
  await context.setOffline(true) // the real connection goes away
  await expect(page.getByText('Se guarda en el dispositivo y se envía sola cuando vuelva la señal.')).toBeVisible()
  await authorize(page)
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
  await dialog.getByLabel('Usuario').fill(FAMILY.usuario.toLowerCase()) // the same user name, whatever the capitals
  await dialog.getByLabel('Contraseña', { exact: true }).fill(FAMILY.clave)
  await dialog.getByRole('button', { name: 'Ingresar' }).click()
  await page.getByRole('link', { name: /Contar una historia/ }).first().click()
  await page.getByLabel('O escríbela').fill('Algo que no alcancé a terminar.')
  await page.waitForTimeout(900) // it is kept on the phone a moment after the typing stops

  await page.reload()

  await expect(page.getByText('Recuperamos la historia que dejaste a medias.')).toBeVisible()
  await expect(page.getByLabel('O escríbela')).toHaveValue('Algo que no alcancé a terminar.')
})

test('una historia sin ubicación y sin nombre: se cuenta, se aprueba, sale en la lista y el público no ve ni el lugar ni el nombre', async ({ page, browser }) => {
  const HIDDEN_TITLE = `Lo que no se dice ${String(Date.now()).slice(-5)}`
  const FAMILY_NUMBER = FAMILY.usuario.split(' ').at(-1) // what makes this family's name unique among the examples
  await page.goto('/')
  await page.getByRole('button', { name: /Ingresar/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ingresar' })
  await dialog.getByLabel('Usuario').fill(FAMILY.usuario)
  await dialog.getByLabel('Contraseña', { exact: true }).fill(FAMILY.clave)
  await dialog.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByText('Rosa Elena Pérez').first()).toBeVisible()

  await page.getByRole('link', { name: /Contar una historia/ }).first().click()
  await page.getByLabel('O escríbela').fill('Hay cosas de la finca que prefiero contar sin decir quién soy ni dónde queda.')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByLabel('Ponle un título').fill(HIDDEN_TITLE)
  await page.getByRole('radio', { name: 'Sin ubicación' }).check()
  await expect(page.getByRole('application', { name: 'Mapa para elegir dónde ocurrió' })).toHaveCount(0) // no map for a story without a place
  await page.getByLabel(/Nombre de referencia/).fill('Finca Los Mangos, cerca de San Lorenzo')
  await page.getByRole('combobox', { name: /Cuándo ocurrió/ }).selectOption('1980 a 1999')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('checkbox', { name: 'Publicar sin mi nombre' }).check()
  await expect(page.getByRole('checkbox', { name: /^Autorizo/ })).toHaveAccessibleName(
    'Autorizo que mi historia se publique sin mi nombre (saldrá como «Narrador anónimo») y sin ubicación en el mapa.',
  )
  await authorize(page)
  await page.getByRole('button', { name: 'Enviar historia' }).click()
  await expect(page.getByRole('row', { name: new RegExp(HIDDEN_TITLE) })).toContainText('En revisión')

  const team = await (await browser.newContext()).newPage()
  await team.goto('/admin')
  await team.getByLabel('Usuario').fill(ADMIN.usuario)
  await team.getByLabel('Contraseña', { exact: true }).fill(ADMIN.clave)
  await team.getByRole('button', { name: 'Ingresar' }).click()
  await team.getByRole('link', { name: /Revisión/ }).first().click()
  await team.getByRole('row', { name: new RegExp(HIDDEN_TITLE) }).getByRole('button', { name: 'Revisar' }).click()
  const review = team.getByRole('dialog', { name: 'Revisar historia' })
  await expect(review).toContainText(FAMILY.usuario) // the team does see the real name
  for (const check of [/cultura cafetera/, /zona cafetera de Minca y sus alrededores/, /datos personales/, /El narrador dio su consentimiento/]) await review.getByRole('checkbox', { name: check }).click()
  await review.getByRole('button', { name: 'Aprobar y publicar' }).click()
  await expect(team.getByText(/publicada/i).first()).toBeVisible()

  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto('/')
  const list = visitor.getByRole('list', { name: 'Historias en esta zona del mapa' })
  const item = list.getByRole('button', { name: new RegExp(HIDDEN_TITLE) })
  await expect(item).toBeVisible() // it is on the list...
  await expect(item).toContainText('Sin ubicación en el mapa') // ...and says it is not on the map
  await expect(item).toContainText('Narrador anónimo')
  await expect(visitor.getByRole('button', { name: `Ver ${HIDDEN_TITLE}` })).toHaveCount(0) // no pin
  await item.click()
  const card = visitor.getByRole('dialog', { name: 'Ficha de la historia' })
  await expect(card.getByRole('heading', { name: HIDDEN_TITLE })).toBeVisible()
  await expect(card).toContainText('Esta historia no tiene ubicación en el mapa.')
  await expect(card.getByRole('button', { name: 'Ver en el mapa' })).toHaveCount(0)
  // What the public reads of THIS story (the family's earlier story, told with its name, is also on the list: that is another one).
  const everything = (await item.innerText()) + (await card.innerText())
  expect(everything).not.toContain(FAMILY_NUMBER) // not the name
  expect(everything).not.toContain('Los Mangos') // not the reference
  expect(everything).not.toContain('San Lorenzo, ') // nor a sector as its place
})
