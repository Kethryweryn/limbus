// US-198 : ce qui est propre à chaque élément du contenu d'un jeu (SPEC-003, R7 à R15)
import { expect, type Locator, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { choose, signIn, slugOf, test, uniqueName, type TestPrisma } from './helpers'
import { escapeRegExp } from '../regexp'

async function ownGame(prisma: TestPrisma, base: string) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
  const title = uniqueName(base)
  return await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
}

// Carte par son titre ; celui d'un objet en plusieurs exemplaires finit par sa quantité (« × 3 »)
function card(page: Page, name: string) {
  return page.locator('[role="link"]').filter({ has: page.getByRole('heading', { name: new RegExp(`^${escapeRegExp(name)}( × \\d+)?$`) }) })
}

// Formulaire d'un élément ouvert depuis sa carte, dans la liste filtrée sur son nom
async function editFromList(page: Page, list: string, search: string, name: string) {
  await page.goto(list)
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder(search).fill(name)
  await card(page, name).getByRole('button', { name: 'Modifier' }).click()
  return page.getByRole('dialog')
}

async function openSheet(page: Page, path: string, name: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
}

function field(form: Locator, label: string) {
  return form.getByLabel(label, { exact: true })
}

test('objet : quantité d’au moins 1, emplacement chez un personnage puis « Aucun personnage », badge « Non associé »', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await ownGame(prisma, 'Jeu objet')
    const name = uniqueName('objet fiche')
    const holder = uniqueName('porteur')
    const intrigue = uniqueName('intrigue de l’objet')
    const item = await prisma.item.create({ data: { name, slug: slugOf(name), gameId: game.id } })
    await prisma.character.create({ data: { name: holder, slug: slugOf(holder), gameId: game.id } })
    await prisma.intrigue.create({ data: { name: intrigue, slug: slugOf(intrigue), gameId: game.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    // Quantité 0 : refusée par le champ, rien n'est enregistré (R10)
    let form = await editFromList(page, '/items', 'Rechercher un objet...', name)
    await field(form, 'Quantité').fill('0')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeVisible()
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(1)

    // Quantité 3, porté par un personnage ; seul dans aucune intrigue : « Non associé »
    await field(form, 'Quantité').fill('3')
    await choose(page, field(form, 'Localisation chez un personnage'), new RegExp(holder))
    await expect(field(form, 'Localisation libre')).toBeDisabled()
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeHidden()
    await expect.poll(async () => (await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(3)
    await expect(card(page, name).getByText('× 3')).toBeVisible()
    await expect(card(page, name).getByText(holder)).toBeVisible()
    await expect(card(page, name).getByText('Non associé')).toBeVisible()

    // « Aucun personnage » se choisit et vide l'emplacement (US-205) ; une intrigue retire « Non associé »
    form = await editFromList(page, '/items', 'Rechercher un objet...', name)
    await choose(page, field(form, 'Localisation chez un personnage'), 'Aucun personnage')
    await expect(field(form, 'Localisation libre')).toBeEnabled()
    await field(form, 'Localisation libre').fill('Coffre de la cave')
    await choose(page, field(form, 'Intrigues associées'), intrigue)
    await page.keyboard.press('Escape')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeHidden()
    await expect.poll(async () => await prisma.item.findUniqueOrThrow({ where: { id: item.id }, select: { locationCharacterId: true, locationText: true } }))
      .toEqual({ locationCharacterId: null, locationText: 'Coffre de la cave' })
    await openSheet(page, `/items/${item.slug}`, name)
    await expect(page.getByText('Coffre de la cave')).toBeVisible()
    await expect(page.getByText('Non associé')).toBeHidden()
    await expect(page.getByText(intrigue)).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

test('document : un corps ou un lien est demandé, et une adresse sans https:// est refusée', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await ownGame(prisma, 'Jeu document')
    const name = uniqueName('document fiche')
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Créer un document' }).click()
    const form = page.getByRole('dialog')
    await choose(page, field(form, 'Jeu'), game.title)
    await field(form, 'Titre').fill(name)

    // Ni corps ni lien (R11)
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form.getByText('Renseignez un corps ou un document lié.')).toBeVisible()

    // Adresse collée sans https:// : refusée par le serveur (R15), le formulaire reste ouvert avec le message
    await field(form, 'Document lié').fill('www.exemple.fr/feuille-de-route')
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form).toBeVisible()
    await expect(form.getByText(/http/i).first()).toBeVisible()
    expect(await prisma.document.findFirst({ where: { title: name } })).toBeNull()

    // Un lien https suffit
    await field(form, 'Document lié').fill('https://exemple.fr/feuille-de-route')
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form).toBeHidden()
    await expect.poll(() => prisma.document.findFirst({ where: { title: name }, select: { documentUrl: true, content: true } }))
      .toMatchObject({ documentUrl: 'https://exemple.fr/feuille-de-route' })
  } finally {
    await prisma.$disconnect()
  }
})

test('personnage : PNJ, groupe choisi dans le formulaire, intrigues associées depuis la fiche, lien d’histoire sans https:// refusé', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await ownGame(prisma, 'Jeu personnage')
    const name = uniqueName('personnage fiche')
    const faction = uniqueName('groupe du personnage')
    const intrigue = uniqueName('intrigue du personnage')
    const character = await prisma.character.create({ data: { name, slug: slugOf(name), gameId: game.id } })
    await prisma.faction.create({ data: { name: faction, slug: slugOf(faction), gameId: game.id } })
    await prisma.intrigue.create({ data: { name: intrigue, slug: slugOf(intrigue), gameId: game.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    const form = await editFromList(page, '/characters', 'Rechercher un personnage...', name)
    await choose(page, field(form, 'Type'), 'PNJ')
    await choose(page, field(form, 'Groupes'), faction)
    await page.keyboard.press('Escape')
    await field(form, 'Lien vers un background externe').fill('docs.google.com/document/d/histoire')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    // Adresse sans https:// : le champ est une adresse web, le navigateur la refuse et le dit ; rien n'est enregistré (R15)
    await expect(form).toBeVisible()
    expect(await field(form, 'Lien vers un background externe').evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false)
    expect((await prisma.character.findUniqueOrThrow({ where: { id: character.id } })).type).toBe('pj')

    await field(form, 'Lien vers un background externe').fill('https://exemple.fr/histoire')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeHidden()
    await expect(card(page, name).getByText('PNJ', { exact: true })).toBeVisible()
    await expect(card(page, name).getByText(faction)).toBeVisible()

    // Intrigues associées depuis la fiche
    await openSheet(page, `/characters/${character.slug}`, name)
    // Sans intrigue, le bouton s'appelle « Ajouter des intrigues »
    await page.getByRole('button', { name: 'Ajouter des intrigues' }).click()
    const modal = page.getByRole('dialog')
    await choose(page, modal.getByLabel('Intrigues', { exact: true }), intrigue)
    await page.keyboard.press('Escape')
    await modal.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(modal).toBeHidden()
    await expect(page.getByRole('link', { name: intrigue })).toBeVisible()
    await expect.poll(() => prisma.characterIntrigue.count({ where: { characterId: character.id } })).toBe(1)
  } finally {
    await prisma.$disconnect()
  }
})

test('groupe : ses membres s’affichent sur sa fiche, et sa suppression garde les personnages (R14)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await ownGame(prisma, 'Jeu groupe')
    const name = uniqueName('groupe fiche')
    const member = uniqueName('membre')
    const faction = await prisma.faction.create({ data: { name, slug: slugOf(name), gameId: game.id } })
    const character = await prisma.character.create({ data: { name: member, slug: slugOf(member), gameId: game.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    const form = await editFromList(page, '/factions', 'Rechercher un groupe...', name)
    await choose(page, field(form, 'Personnages'), member)
    await page.keyboard.press('Escape')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeHidden()

    await openSheet(page, `/factions/${faction.slug}`, name)
    await expect(page.getByRole('link', { name: member })).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Supprimer' }).click()
    await expect(page).toHaveURL(/\/factions$/)
    expect(await prisma.faction.findUnique({ where: { id: faction.id } })).toBeNull()
    expect(await prisma.character.findUnique({ where: { id: character.id } })).not.toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

test('intrigue : le filtre par niveau ne garde que ce niveau (R9)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await ownGame(prisma, 'Jeu intrigue')
    const major = uniqueName('intrigue majeure')
    const minor = uniqueName('intrigue mineure')
    await prisma.intrigue.create({ data: { name: major, slug: slugOf(major), gameId: game.id, level: 'major' } })
    await prisma.intrigue.create({ data: { name: minor, slug: slugOf(minor), gameId: game.id, level: 'minor' } })
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/intrigues')
    await page.waitForLoadState('networkidle')
    await choose(page, page.getByRole('combobox').filter({ hasText: 'Tous les jeux' }), game.title)
    await expect(card(page, major)).toBeVisible()
    await expect(card(page, minor)).toBeVisible()

    await choose(page, page.getByRole('combobox').filter({ hasText: 'Tous les niveaux' }), 'Intrigue mineure')
    await expect(card(page, minor)).toBeVisible()
    await expect(card(page, major)).toBeHidden()
  } finally {
    await prisma.$disconnect()
  }
})

test('lieu : son adresse s’affiche sur sa fiche, et une session qui s’y tient garde le lieu renommé (R13)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await ownGame(prisma, 'Jeu lieu')
    const name = uniqueName('lieu fiche')
    const location = await prisma.location.create({ data: { name, slug: slugOf(name), gameId: game.id, address: '12 rue des Lilas\n75020 Paris' } })
    const sessionName = uniqueName('session au lieu')
    const session = await prisma.session.create({ data: { name: sessionName, slug: slugOf(sessionName), gameId: game.id, locationId: location.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    await openSheet(page, `/locations/${location.slug}`, name)
    await expect(page.getByText('12 rue des Lilas')).toBeVisible()

    const renamed = uniqueName('lieu renommé')
    const form = await editFromList(page, '/locations', 'Rechercher un lieu...', name)
    await field(form, 'Nom').fill(renamed)
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeHidden()
    await page.goto(`/sessions/${session.slug}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(renamed).first()).toBeVisible()
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).locationId).toBe(location.id)
  } finally {
    await prisma.$disconnect()
  }
})

test('timeline : le jour est demandé, et l’événement s’affiche à son jour (R12)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await ownGame(prisma, 'Jeu des événements')
    const name = uniqueName('événement fiche')
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/timeline')
    await page.waitForLoadState('networkidle')
    // La timeline montre un jeu à la fois : on le choisit d'abord
    await page.getByPlaceholder('Rechercher un jeu...').fill(game.title)
    await page.getByRole('button', { name: game.title }).click()
    await page.getByRole('button', { name: /Créer un événement/ }).click()
    const form = page.getByRole('dialog')
    await field(form, 'Nom').fill(name)
    // Jour vide : le champ, obligatoire et d'au moins 1, est refusé par le navigateur, qui le dit ; rien n'est créé
    await field(form, 'Jour').fill('')
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form).toBeVisible()
    expect(await field(form, 'Jour').evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false)
    expect(await prisma.timelineEvent.findFirst({ where: { name } })).toBeNull()

    await field(form, 'Jour').fill('2')
    await field(form, 'Heure').fill('09:30')
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form).toBeHidden()
    await expect.poll(() => prisma.timelineEvent.findFirst({ where: { name }, select: { day: true, time: true } })).toEqual({ day: 2, time: '09:30' })
    await page.getByPlaceholder('Rechercher un événement...').fill(name)
    await expect(page.getByText(/Jour 2/).first()).toBeVisible()
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
