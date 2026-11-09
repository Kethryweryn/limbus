// US-198 : listes de l'écriture d'un jeu (SPEC-003) : recherche, filtre par jeu, archives, pages, jeu actif et saisie
// refusée, pour chaque élément du contenu d'un jeu
import { expect, type Locator, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { cardByTitle as card, orgaGame, signIn, slugOf, test, uniqueName, type TestPrisma } from './helpers'

type List = {
  // Élément, pour les données du test
  noun: string
  list: string
  heading: string
  create: string
  search: string
  // Taille d'une page de la liste
  pageSize: number
  // Champ du nom dans le formulaire, et message quand il est vide
  nameLabel: string
  nameRequired: string
  // Message propre à une fiche hors d'atteinte ; sinon, la page d'erreur dit « Page introuvable » (US-157)
  notFound: string
  // Crée un élément ; `secondary` va dans un champ cherché autre que le nom
  seed: (prisma: TestPrisma, gameId: string, name: string, secondary?: string) => Promise<{ slug: string }>
  // Champs obligatoires en plus du nom, remplis à la création
  fillRequired?: (form: Locator) => Promise<void>
  // Élément lu par son nom, après une création par l'écran
  find: (prisma: TestPrisma, name: string) => Promise<unknown>
}

const LISTS: List[] = [
  {
    noun: 'personnage', list: '/characters', heading: 'Personnages', create: 'Créer un personnage', search: 'Rechercher un personnage...', pageSize: 6, nameLabel: 'Nom', nameRequired: 'Le nom est requis.', notFound: 'Personnage introuvable',
    find: (prisma, name) => prisma.character.findFirst({ where: { name } }),
    seed: (prisma, gameId, name, secondary) => prisma.character.create({ data: { name, slug: slugOf(name), gameId, pitch: secondary } })
  },
  {
    noun: 'groupe', list: '/factions', heading: 'Groupes', create: 'Créer un groupe', search: 'Rechercher un groupe...', pageSize: 9, nameLabel: 'Nom', nameRequired: 'Le nom est requis.', notFound: 'Groupe introuvable',
    find: (prisma, name) => prisma.faction.findFirst({ where: { name } }),
    seed: (prisma, gameId, name, secondary) => prisma.faction.create({ data: { name, slug: slugOf(name), gameId, pitch: secondary } })
  },
  {
    noun: 'intrigue', list: '/intrigues', heading: 'Intrigues', create: 'Créer une intrigue', search: 'Rechercher une intrigue...', pageSize: 9, nameLabel: 'Nom', nameRequired: 'Le nom est requis.', notFound: 'Intrigue introuvable',
    find: (prisma, name) => prisma.intrigue.findFirst({ where: { name } }),
    seed: (prisma, gameId, name, secondary) => prisma.intrigue.create({ data: { name, slug: slugOf(name), gameId, pitch: secondary } })
  },
  {
    noun: 'objet', list: '/items', heading: 'Objets', create: 'Créer un objet', search: 'Rechercher un objet...', pageSize: 9, nameLabel: 'Nom', nameRequired: 'Le nom est requis.', notFound: 'Objet introuvable',
    find: (prisma, name) => prisma.item.findFirst({ where: { name } }),
    seed: (prisma, gameId, name, secondary) => prisma.item.create({ data: { name, slug: slugOf(name), gameId, description: secondary } })
  },
  {
    noun: 'document', list: '/documents', heading: 'Documents', create: 'Créer un document', search: 'Rechercher un document...', pageSize: 9, nameLabel: 'Titre', nameRequired: 'Le titre est requis.', notFound: 'Document introuvable',
    fillRequired: (form) => form.getByLabel('Corps', { exact: true }).fill('Texte du document'),
    find: (prisma, name) => prisma.document.findFirst({ where: { title: name } }),
    seed: (prisma, gameId, name, secondary) => prisma.document.create({ data: { title: name, slug: slugOf(name), gameId, content: secondary ?? 'Texte' } })
  },
  {
    noun: 'lieu', list: '/locations', heading: 'Lieux', create: 'Créer un lieu', search: 'Rechercher un lieu...', pageSize: 9, nameLabel: 'Nom', nameRequired: 'Le nom est requis.', notFound: 'Lieu introuvable',
    find: (prisma, name) => prisma.location.findFirst({ where: { name } }),
    seed: (prisma, gameId, name, secondary) => prisma.location.create({ data: { name, slug: slugOf(name), gameId, address: secondary } })
  }
]

async function openList(page: Page, item: List) {
  await page.goto(item.list)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible()
}

for (const item of LISTS) {
  test(`${item.heading} : recherche, filtre par jeu, archives et pages`, async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, `Jeu liste ${item.noun}`)
      const archived = await orgaGame(prisma, `Jeu archivé ${item.noun}`, { published: false })
      const base = uniqueName(`${item.noun} liste`)
      // Une page pleine et un élément de plus, dont un qui ne se trouve que par son champ secondaire
      await Promise.all(Array.from({ length: item.pageSize + 1 }, (_, index) =>
        item.seed(prisma, game.id, `${base} ${String(index + 1).padStart(2, '0')}`, index === 0 ? `secondaire ${base}` : undefined)))
      const hidden = `${base} archivé`
      await item.seed(prisma, archived.id, hidden)

      await signIn(page, prisma, E2E_USERS.orga)
      await openList(page, item)

      // Filtre par jeu : seuls ses éléments, sur deux pages
      await page.getByRole('combobox').filter({ hasText: 'Tous les jeux' }).click()
      await page.getByRole('option', { name: game.title, exact: true }).click()
      await expect(page.getByText(`Page 1 / 2`)).toBeVisible()
      await expect(page.locator('[role="link"]')).toHaveCount(item.pageSize)
      await page.getByRole('button', { name: 'Suivant →' }).click()
      await expect(page.getByText(`Page 2 / 2`)).toBeVisible()
      await expect(page.locator('[role="link"]')).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Suivant →' })).toBeDisabled()
      await page.getByRole('button', { name: '← Précédent' }).click()
      await expect(page.getByText(`Page 1 / 2`)).toBeVisible()

      // Recherche depuis la page 2 : retour à la page 1, et le champ secondaire est cherché aussi
      await page.getByRole('button', { name: 'Suivant →' }).click()
      await page.getByPlaceholder(item.search).fill(`secondaire ${base}`)
      await expect(page.getByText(`Page 1 / 1`)).toBeVisible()
      await expect(page.locator('[role="link"]')).toHaveCount(1)
      await expect(card(page, `${base} 01`)).toBeVisible()

      // Archives : l'élément d'un jeu archivé n'apparaît qu'avec « Afficher les archives »
      await page.getByRole('combobox').filter({ hasText: game.title }).click()
      await page.getByRole('option', { name: 'Tous les jeux', exact: true }).click()
      await page.getByPlaceholder(item.search).fill(hidden)
      await expect(card(page, hidden)).toBeHidden()
      await page.getByLabel('Afficher les archives').check()
      await expect(card(page, hidden)).toBeVisible()
      // « Archivée » pour une intrigue
      await expect(card(page, hidden).getByText(/^\s*Archivée?\s*$/)).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test(`${item.heading} : le jeu actif filtre la liste et préremplit la création, un nom vide est refusé`, async ({ page }) => {
    test.setTimeout(90_000)
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, `Jeu actif ${item.noun}`)
      const other = await orgaGame(prisma, `Autre jeu ${item.noun}`)
      const mine = uniqueName(`${item.noun} du jeu actif`)
      const foreign = uniqueName(`${item.noun} d'un autre jeu`)
      await item.seed(prisma, game.id, mine)
      await item.seed(prisma, other.id, foreign)

      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/games')
      await page.waitForLoadState('networkidle')
      await page.getByPlaceholder('Rechercher un jeu...').fill(game.title)
      await card(page, game.title).getByRole('button', { name: 'Rendre actif' }).click()
      await expect(page.getByText(`Jeu actif :`)).toBeVisible()

      // Navigation dans l'application : le jeu actif est gardé
      await page.getByRole('link', { name: item.heading, exact: true }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(game.title, { exact: true }).first()).toBeVisible()
      // Ni filtre par jeu ni case des archives : la liste est celle du jeu actif
      await expect(page.getByRole('combobox').filter({ hasText: 'Tous les jeux' })).toHaveCount(0)
      await expect(page.getByLabel('Afficher les archives')).toHaveCount(0)
      await page.getByPlaceholder(item.search).fill(item.noun)
      await expect(card(page, mine)).toBeVisible()
      await expect(card(page, foreign)).toBeHidden()

      // Création : le jeu actif est déjà choisi ; un nom vide est refusé avec le message de Limbus (US-204), puis un nom
      // fait d'espaces aussi
      await page.getByRole('button', { name: item.create }).click()
      const form = page.getByRole('dialog')
      await expect(form.getByRole('combobox').filter({ hasText: game.title })).toBeVisible()
      await form.getByRole('button', { name: 'Créer', exact: true }).click()
      await expect(form.getByText(item.nameRequired)).toBeVisible()
      await form.getByLabel(item.nameLabel, { exact: true }).fill('   ')
      await form.getByRole('button', { name: 'Créer', exact: true }).click()
      await expect(form.getByText(item.nameRequired)).toBeVisible()
      await expect(form).toBeVisible()

      // « Changer de jeu » rend la liste de tous les jeux
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Changer de jeu' }).click()
      await expect(page.getByRole('combobox').filter({ hasText: 'Tous les jeux' })).toBeVisible()
      await expect(card(page, foreign)).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test(`${item.heading} : une organisatrice sans accès ne voit rien, une co-organisatrice voit tout`, async ({ otherPage }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, `Jeu droits ${item.noun}`)
      const shared = await orgaGame(prisma, `Jeu partagé ${item.noun}`)
      const privateName = uniqueName(`${item.noun} privé`)
      const sharedName = uniqueName(`${item.noun} partagé`)
      const hidden = await item.seed(prisma, game.id, privateName)
      const visible = await item.seed(prisma, shared.id, sharedName)
      const autre = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.autre } })
      await prisma.gameShare.create({ data: { gameId: shared.id, userId: autre.id } })

      const guest = await otherPage()
      await signIn(guest, prisma, E2E_USERS.autre)
      await openList(guest, item)
      await guest.getByPlaceholder(item.search).fill(item.noun)
      await expect(card(guest, sharedName)).toBeVisible()
      await expect(card(guest, privateName)).toHaveCount(0)

      // Fiche d'un jeu partagé : ouverte ; fiche d'un jeu sans accès : introuvable
      await card(guest, sharedName).getByText(shared.title, { exact: true }).click()
      await expect(guest.getByRole('heading', { level: 1, name: sharedName, exact: true })).toBeVisible()
      expect(guest.url()).toContain(`${item.list}/${visible.slug}`)
      await guest.goto(`${item.list}/${hidden.slug}`)
      await expect(guest.getByRole('heading', { name: new RegExp(`^(Page introuvable|${item.notFound})$`) }).or(guest.getByText(item.notFound))).toBeVisible()
      await expect(guest.getByRole('heading', { level: 1, name: privateName, exact: true })).toHaveCount(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test(`${item.heading} : la liste se relit sans réseau, et une création faite hors ligne part au retour du réseau`, async ({ page, context }) => {
    test.setTimeout(90_000)
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, `Jeu hors ligne ${item.noun}`)
      const known = uniqueName(`${item.noun} connu`)
      await item.seed(prisma, game.id, known)
      const created = uniqueName(`${item.noun} hors ligne`)

      await signIn(page, prisma, E2E_USERS.orga)
      // Avec le réseau : les jeux et la liste, gardés sur l'appareil
      await page.goto('/games')
      await page.waitForLoadState('networkidle')
      await openList(page, item)
      await page.getByPlaceholder(item.search).fill(known)
      await expect(card(page, known)).toBeVisible()

      // Sans réseau : la liste se rouvre depuis l'appareil, et une création est mise en attente
      await context.setOffline(true)
      await page.getByRole('link', { name: 'Jeux', exact: true }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: 'Jeux' })).toBeVisible()
      await page.getByRole('link', { name: item.heading, exact: true }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible()
      await page.getByPlaceholder(item.search).fill(known)
      await expect(card(page, known)).toBeVisible()

      await page.getByPlaceholder(item.search).fill('')
      await page.getByRole('button', { name: item.create }).click()
      const form = page.getByRole('dialog')
      await form.getByLabel('Jeu', { exact: true }).click()
      await page.getByRole('option', { name: game.title, exact: true }).click()
      await form.getByLabel(item.nameLabel, { exact: true }).fill(created)
      await item.fillRequired?.(form)
      await form.getByRole('button', { name: 'Créer', exact: true }).click()
      await expect(page.getByText(/Modifications faites hors ligne : 1 en attente/)).toBeVisible()
      expect(await item.find(prisma, created)).toBeNull()

      // Retour du réseau : la création part
      await context.setOffline(false)
      await expect.poll(() => item.find(prisma, created), { timeout: 20_000 }).not.toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })
}

// US-198 : une modification faite hors ligne sur un élément changé entre-temps par quelqu'un d'autre est signalée en
// conflit, et l'on choisit la version à garder (SPEC-010 R8, R9)
test('une modification hors ligne d’un lieu changé entre-temps est en conflit, et l’on garde la version du serveur', async ({ page, context }) => {
  test.setTimeout(90_000)
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu conflit')
    const name = uniqueName('lieu en conflit')
    const location = await prisma.location.create({ data: { name, slug: slugOf(name), gameId: game.id, notes: 'Notes de départ' } })
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/games')
    await page.waitForLoadState('networkidle')
    await openList(page, LISTS.find((item) => item.list === '/locations')!)
    await page.getByPlaceholder('Rechercher un lieu...').fill(name)
    await expect(card(page, name)).toBeVisible()

    // Hors ligne : les notes changent sur l'appareil
    await context.setOffline(true)
    await card(page, name).getByRole('button', { name: 'Modifier' }).click()
    const form = page.getByRole('dialog')
    await form.getByLabel('Notes', { exact: true }).fill('Notes écrites hors ligne')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByText(/Modifications faites hors ligne : 1 en attente/)).toBeVisible()

    // Entre-temps, quelqu'un d'autre change le lieu
    await prisma.location.update({ where: { id: location.id }, data: { notes: 'Notes de la co-organisatrice' } })

    // Retour du réseau : conflit, rien n'est écrasé
    await context.setOffline(false)
    await page.getByRole('button', { name: 'Voir les modifications' }).click()
    const panel = page.getByRole('dialog', { name: 'Modifications faites hors ligne' })
    await expect(panel.getByText('Conflit', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(panel.getByText('Cet élément a été modifié par quelqu’un d’autre entre-temps.')).toBeVisible()
    expect((await prisma.location.findUniqueOrThrow({ where: { id: location.id } })).notes).toBe('Notes de la co-organisatrice')

    // Garder celle du serveur : la file se vide, la base ne change pas
    await panel.getByRole('button', { name: 'Garder celle du serveur' }).click()
    await expect(panel.getByText('Aucune modification en attente.')).toBeVisible()
    expect((await prisma.location.findUniqueOrThrow({ where: { id: location.id } })).notes).toBe('Notes de la co-organisatrice')
  } finally {
    await prisma.$disconnect()
  }
})
