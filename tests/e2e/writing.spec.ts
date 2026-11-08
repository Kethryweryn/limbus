import { expect, type Locator, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { linkToken } from '../integration/smtp'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { blockWith, signIn, slugOf, test, uniqueName, type TestPrisma } from './helpers'

// Jeu propre au test, de l'organisatrice des parcours
async function writingGame(prisma: TestPrisma, base: string) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
  const title = uniqueName(base)
  return await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
}

async function chooseGame(page: Page, form: Locator, title: string) {
  await form.getByLabel('Jeu', { exact: true }).click()
  await page.getByRole('option', { name: title, exact: true }).click()
}

type Element = {
  // Nom de l'élément, pour les données du test (« personnage »)
  noun: string
  // Liste, bouton de création et champ de recherche
  list: string
  create: string
  search: string
  // Champ du nom (« Nom » ou « Titre ») et champs requis en plus
  nameLabel: string
  fill?: (form: Locator) => Promise<void>
  // Lecture en base, et adresse de sa fiche
  find: (prisma: TestPrisma, name: string) => Promise<{ id: string, slug: string } | null>
}

const ELEMENTS: Record<string, Element> = {
  'un personnage': {
    noun: 'personnage',
    list: '/characters', create: 'Créer un personnage', search: 'Rechercher un personnage...', nameLabel: 'Nom',
    find: (prisma, name) => prisma.character.findFirst({ where: { name } })
  },
  'un groupe': {
    noun: 'groupe',
    list: '/factions', create: 'Créer un groupe', search: 'Rechercher un groupe...', nameLabel: 'Nom',
    find: (prisma, name) => prisma.faction.findFirst({ where: { name } })
  },
  'une intrigue': {
    noun: 'intrigue',
    list: '/intrigues', create: 'Créer une intrigue', search: 'Rechercher une intrigue...', nameLabel: 'Nom',
    find: (prisma, name) => prisma.intrigue.findFirst({ where: { name } })
  },
  'un objet': {
    noun: 'objet',
    list: '/items', create: 'Créer un objet', search: 'Rechercher un objet...', nameLabel: 'Nom',
    find: (prisma, name) => prisma.item.findFirst({ where: { name } })
  },
  'un document': {
    noun: 'document',
    list: '/documents', create: 'Créer un document', search: 'Rechercher un document...', nameLabel: 'Titre',
    fill: (form) => form.getByLabel('Corps').fill('Le texte du document.'),
    find: (prisma, name) => prisma.document.findFirst({ where: { title: name } })
  },
  'un lieu': {
    noun: 'lieu',
    list: '/locations', create: 'Créer un lieu', search: 'Rechercher un lieu...', nameLabel: 'Nom',
    fill: (form) => form.getByLabel('Adresse').fill('1 rue du Test'),
    find: (prisma, name) => prisma.location.findFirst({ where: { name } })
  }
}

// EPIC-003 (SPEC-003) : chaque élément du jeu se crée depuis sa liste, se renomme depuis sa fiche, se supprime
for (const [label, element] of Object.entries(ELEMENTS)) {
  test(`${label} se crée, se renomme et se supprime`, async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await writingGame(prisma, `Jeu ${element.noun}`)
      const name = uniqueName(`${element.noun} créé`)

      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(element.list)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: element.create }).click()
      const form = page.getByRole('dialog')
      await chooseGame(page, form, game.title)
      await form.getByLabel(element.nameLabel, { exact: true }).fill(name)
      await element.fill?.(form)
      await form.getByRole('button', { name: 'Créer', exact: true }).click()
      await expect(form).toBeHidden()
      const created = await element.find(prisma, name)
      expect(created).not.toBeNull()

      // Renommage depuis la fiche
      const renamed = uniqueName(`${element.noun} renommé`)
      await page.goto(`${element.list}/${created!.slug}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Modifier' }).first().click()
      await page.getByLabel(element.nameLabel, { exact: true }).fill(renamed)
      await page.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByRole('heading', { name: renamed })).toBeVisible()
      const saved = await element.find(prisma, renamed)
      expect(saved).toMatchObject({ id: created!.id })
      // La fiche reste ouverte à sa nouvelle adresse
      await expect(page).toHaveURL(new RegExp(`${element.list}/${saved!.slug}$`))

      // Suppression depuis la liste
      await page.goto(element.list)
      await page.waitForLoadState('networkidle')
      await page.getByPlaceholder(element.search).fill(renamed)
      page.once('dialog', (dialog) => dialog.accept())
      await blockWith(page, page.getByText(renamed, { exact: true }), 'Supprimer').getByRole('button', { name: 'Supprimer' }).click()
      await expect(page.getByText(renamed, { exact: true })).toBeHidden()
      expect(await element.find(prisma, renamed)).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })
}

// US-186 : chaque fiche d'écriture se supprime depuis elle-même, en lecture comme en modification, puis ramène à la liste
const SHEETS: Array<{ noun: string, list: string, create: (prisma: TestPrisma, gameId: string, name: string) => Promise<{ id: string, slug: string }>, exists: (prisma: TestPrisma, id: string) => Promise<unknown> }> = [
  { noun: 'personnage', list: '/characters', create: (prisma, gameId, name) => prisma.character.create({ data: { name, slug: slugOf(name), gameId } }), exists: (prisma, id) => prisma.character.findUnique({ where: { id } }) },
  { noun: 'groupe', list: '/factions', create: (prisma, gameId, name) => prisma.faction.create({ data: { name, slug: slugOf(name), gameId } }), exists: (prisma, id) => prisma.faction.findUnique({ where: { id } }) },
  { noun: 'intrigue', list: '/intrigues', create: (prisma, gameId, name) => prisma.intrigue.create({ data: { name, slug: slugOf(name), gameId } }), exists: (prisma, id) => prisma.intrigue.findUnique({ where: { id } }) },
  { noun: 'objet', list: '/items', create: (prisma, gameId, name) => prisma.item.create({ data: { name, slug: slugOf(name), gameId } }), exists: (prisma, id) => prisma.item.findUnique({ where: { id } }) },
  { noun: 'lieu', list: '/locations', create: (prisma, gameId, name) => prisma.location.create({ data: { name, slug: slugOf(name), gameId } }), exists: (prisma, id) => prisma.location.findUnique({ where: { id } }) },
  { noun: 'document', list: '/documents', create: (prisma, gameId, name) => prisma.document.create({ data: { title: name, slug: slugOf(name), content: 'Texte', gameId } }), exists: (prisma, id) => prisma.document.findUnique({ where: { id } }) },
  { noun: 'événement', list: '/timeline', create: (prisma, gameId, name) => prisma.timelineEvent.create({ data: { name, slug: slugOf(name), gameId, day: 1, time: '10:00' } }), exists: (prisma, id) => prisma.timelineEvent.findUnique({ where: { id } }) }
]

for (const sheet of SHEETS) {
  test(`un ${sheet.noun} se supprime depuis sa fiche, en lecture et en modification`, async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await writingGame(prisma, `Jeu suppression ${sheet.noun}`)
      const [read, edited] = await Promise.all([
        sheet.create(prisma, game.id, uniqueName(`${sheet.noun} lu`)),
        sheet.create(prisma, game.id, uniqueName(`${sheet.noun} modifié`))
      ])
      await signIn(page, prisma, E2E_USERS.orga)

      // En lecture
      await page.goto(`${sheet.list}/${read.slug}`)
      await page.waitForLoadState('networkidle')
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${sheet.list}(\\?.*)?$`))
      expect(await sheet.exists(prisma, read.id)).toBeNull()

      // En modification ; refuser la confirmation ne supprime rien
      await page.goto(`${sheet.list}/${edited.slug}?edit=1`)
      await page.waitForLoadState('networkidle')
      page.once('dialog', (dialog) => dialog.dismiss())
      await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
      expect(await sheet.exists(prisma, edited.id)).not.toBeNull()
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${sheet.list}(\\?.*)?$`))
      expect(await sheet.exists(prisma, edited.id)).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })
}

// EPIC-003 (SPEC-003) : un événement de la timeline, placé par jour et heure
test('un événement de la timeline se crée et se renomme', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await writingGame(prisma, 'Jeu timeline')
    const name = uniqueName('Arrivée des invités')

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/timeline')
    await page.waitForLoadState('networkidle')
    // La timeline s'ouvre jeu par jeu
    await page.getByPlaceholder('Rechercher un jeu...').fill(game.title)
    await blockWith(page, page.getByText(game.title, { exact: true }), 'Ouvrir').getByRole('button', { name: 'Ouvrir' }).click()
    await page.getByRole('button', { name: 'Créer un événement' }).click()
    const form = page.getByRole('dialog')
    await chooseGame(page, form, game.title)
    await form.getByLabel('Jour').fill('1')
    await form.getByLabel('Heure').fill('14:30')
    await form.getByLabel('Nom', { exact: true }).fill(name)
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form).toBeHidden()
    const created = await prisma.timelineEvent.findFirstOrThrow({ where: { name } })
    expect(created).toMatchObject({ gameId: game.id, day: 1, time: '14:30' })

    const renamed = uniqueName('Départ des invités')
    await page.goto(`/timeline/${created.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Modifier' }).first().click()
    await page.getByLabel('Nom', { exact: true }).fill(renamed)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('heading', { name: renamed })).toBeVisible()
    expect((await prisma.timelineEvent.findUniqueOrThrow({ where: { id: created.id } })).name).toBe(renamed)
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-012 (US-058, US-064) : un jeu se crée, se renomme, et se partage avec une co-organisatrice qui accepte l'invitation
test('un jeu se crée, se renomme et se partage avec une co-organisatrice', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const title = uniqueName('Nouveau jeu')

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/games')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Créer un jeu' }).click()
    const form = page.getByRole('dialog')
    await form.getByLabel('Titre', { exact: true }).fill(title)
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form).toBeHidden()
    const game = await prisma.game.findFirstOrThrow({ where: { title } })

    const renamed = uniqueName('Jeu renommé')
    await page.goto(`/games/${game.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Modifier' }).first().click()
    await page.getByLabel('Titre', { exact: true }).fill(renamed)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('heading', { name: renamed })).toBeVisible()

    // Partage : l'invitée reçoit un lien et l'accepte depuis son compte
    await page.getByRole('button', { name: 'Partager' }).click()
    const share = page.getByRole('dialog')
    await share.getByPlaceholder('email@exemple.fr').fill(E2E_USERS.autre)
    await share.getByRole('button', { name: 'Inviter' }).click()
    await expect(share.getByText(`Invitation envoyée à ${E2E_USERS.autre}.`)).toBeVisible()
    await expect.poll(() => mailbox.to(E2E_USERS.autre).length).toBe(1)
    const token = linkToken(mailbox.to(E2E_USERS.autre)[0]!, '/invitations/')

    const guest = await otherPage()
    await signIn(guest, prisma, E2E_USERS.autre)
    await guest.goto(`/invitations/${token}`)
    await guest.waitForLoadState('networkidle')
    await guest.getByRole('button', { name: 'Accepter l’invitation' }).click()
    await expect(guest).toHaveURL(new RegExp(`/games/${(await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).slug}$`))
    const autre = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.autre } })
    expect(await prisma.gameShare.count({ where: { gameId: game.id, userId: autre.id } })).toBe(1)
  } finally {
    await prisma.$disconnect()
  }
})

// Une fiche à l'adresse inconnue (lien ancien, slug changé) le dit, au lieu de rester en chargement
for (const [path, message] of [['/documents', 'Document introuvable'], ['/timeline', 'Événement introuvable']] as const) {
  test(`${path} : une adresse inconnue affiche « ${message} »`, async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(`${path}/adresse-inconnue`)
      await expect(page.getByText(message)).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })
}
