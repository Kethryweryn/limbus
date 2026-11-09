// US-198 : l'écran des jeux (SPEC-003 R3, R4, R15 à R17 ; SPEC-009 R3 ; SPEC-011 R2, R3)
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { cardByTitle as gameCard, orgaGame, signIn, slugOf, test, uniqueName, type TestPrisma } from './helpers'

async function shareWithAutre(prisma: TestPrisma, gameId: string) {
  const autre = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.autre } })
  await prisma.gameShare.create({ data: { gameId, userId: autre.id } })
  return autre
}

async function openGames(page: Page, title: string) {
  await page.goto('/games')
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder('Rechercher un jeu...').fill(title)
}

async function openGameSheet(page: Page, game: { slug: string, title: string }) {
  await page.goto(`/games/${game.slug}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: game.title, exact: true })).toBeVisible()
}

test('archiver un jeu archive son contenu et retire sa page publique, qui ne revient pas à la restauration', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu à archiver', { publicPage: true })
    const character = uniqueName('personnage du jeu archivé')
    await prisma.character.create({ data: { name: character, slug: slugOf(character), gameId: game.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    await openGames(page, game.title)
    page.once('dialog', (dialog) => dialog.accept())
    await gameCard(page, game.title).getByRole('button', { name: 'Archiver' }).click()
    await expect(gameCard(page, game.title)).toBeHidden()
    await expect.poll(() => prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { published: true, publicPage: true } }))
      .toEqual({ published: false, publicPage: false })

    // Son contenu est archivé avec lui (R3)
    await page.goto('/characters')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Rechercher un personnage...').fill(character)
    await expect(page.getByRole('heading', { name: character, exact: true })).toBeHidden()
    await page.getByLabel('Afficher les archives').check()
    await expect(page.getByRole('heading', { name: character, exact: true })).toBeVisible()

    // La page publique n'existe plus (SPEC-009 R3)
    const publicPage = await page.request.get(`/api/public/games/${game.slug}`)
    expect(publicPage.status()).toBe(404)

    // Restauration : le jeu revient, sans sa page publique
    await openGames(page, game.title)
    await page.getByLabel('Afficher les archives').check()
    await expect(gameCard(page, game.title).getByText('Archivé', { exact: true })).toBeVisible()
    await gameCard(page, game.title).getByRole('button', { name: 'Restaurer' }).click()
    await expect.poll(() => prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { published: true, publicPage: true } }))
      .toEqual({ published: true, publicPage: false })
    await expect(gameCard(page, game.title).getByText('Archivé', { exact: true })).toBeHidden()
  } finally {
    await prisma.$disconnect()
  }
})

test('publier puis dépublier la page publique depuis la fiche du jeu', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu à publier')
    await signIn(page, prisma, E2E_USERS.orga)
    await openGameSheet(page, game)

    await page.getByRole('button', { name: 'Publier', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Page publique' })).toBeVisible()
    expect((await page.request.get(`/api/public/games/${game.slug}`)).status()).toBe(200)

    await page.getByRole('button', { name: 'Dépublier', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Page publique' })).toBeHidden()
    expect((await page.request.get(`/api/public/games/${game.slug}`)).status()).toBe(404)
  } finally {
    await prisma.$disconnect()
  }
})

test('un lien de teaser sans https:// est refusé, avec son message, et rien n’est enregistré (R15)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu au teaser')
    await signIn(page, prisma, E2E_USERS.orga)
    await openGames(page, game.title)
    await gameCard(page, game.title).getByRole('button', { name: 'Modifier' }).click()
    const form = page.getByRole('dialog')
    await form.getByLabel('URL du teaser vidéo', { exact: true }).fill('www.youtube.com/watch?v=dQw4w9WgXcQ')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    // Le message du serveur s'affiche dans le formulaire (US-206)
    await expect(form.getByText(/http/i).first()).toBeVisible()
    await expect(form).toBeVisible()
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).teaserUrl).toBeNull()

    await form.getByLabel('URL du teaser vidéo', { exact: true }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeHidden()
    await expect.poll(async () => (await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).teaserUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  } finally {
    await prisma.$disconnect()
  }
})

test('seul un jeu archivé se supprime, en retapant son titre, et tout son contenu part avec lui (US-207, R4)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const active = await orgaGame(prisma, 'Jeu actif non supprimable')
    const game = await orgaGame(prisma, 'Jeu à supprimer', { published: false })
    const character = uniqueName('personnage supprimé')
    const created = await prisma.character.create({ data: { name: character, slug: slugOf(character), gameId: game.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    // Un jeu actif ne propose pas la suppression
    await openGameSheet(page, active)
    await expect(page.getByRole('button', { name: 'Supprimer définitivement' })).toHaveCount(0)

    await openGameSheet(page, game)
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click()
    const modal = page.getByRole('dialog')
    await modal.getByLabel('Titre du jeu').fill('Un autre titre')
    await modal.getByRole('button', { name: 'Supprimer définitivement' }).click()
    await expect(modal.getByText('Le titre ne correspond pas.')).toBeVisible()
    expect(await prisma.game.findUnique({ where: { id: game.id } })).not.toBeNull()

    await modal.getByLabel('Titre du jeu').fill(game.title)
    await modal.getByRole('button', { name: 'Supprimer définitivement' }).click()
    await expect(page).toHaveURL(/\/games$/)
    await expect.poll(() => prisma.game.findUnique({ where: { id: game.id } })).toBeNull()
    expect(await prisma.character.findUnique({ where: { id: created.id } })).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

test('une co-organisatrice modifie le jeu, sans le partager, le léguer ni le supprimer, et peut le quitter (R16, R17)', async ({ otherPage }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de la co-organisatrice', { published: false })
    const autre = await shareWithAutre(prisma, game.id)
    const guest = await otherPage()
    await signIn(guest, prisma, E2E_USERS.autre)
    await openGameSheet(guest, game)

    await expect(guest.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible()
    await expect(guest.getByRole('button', { name: 'Partager' })).toHaveCount(0)
    await expect(guest.getByRole('button', { name: 'Léguer une copie' })).toHaveCount(0)
    await expect(guest.getByRole('button', { name: 'Supprimer définitivement' })).toHaveCount(0)

    // Elle quitte le jeu (SPEC-011 R2) : plus d'accès
    guest.once('dialog', (dialog) => dialog.accept())
    await guest.getByRole('button', { name: 'Quitter ce jeu' }).click()
    await expect(guest).toHaveURL(/\/games$/)
    expect(await prisma.gameShare.findFirst({ where: { gameId: game.id, userId: autre.id } })).toBeNull()
    await guest.goto(`/games/${game.slug}`)
    await expect(guest.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

test('la propriétaire propose le transfert du jeu, la co-organisatrice l’accepte et en devient propriétaire (SPEC-011 R3)', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu à transférer')
    const autre = await shareWithAutre(prisma, game.id)
    await signIn(page, prisma, E2E_USERS.orga)
    await openGameSheet(page, game)
    await page.getByRole('button', { name: 'Partager' }).click()
    const modal = page.getByRole('dialog')
    page.once('dialog', (dialog) => dialog.accept())
    await modal.getByRole('button', { name: 'Proposer le transfert' }).click()
    await expect(modal.getByRole('button', { name: 'Retirer la proposition de transfert' })).toBeVisible()

    const guest = await otherPage()
    await signIn(guest, prisma, E2E_USERS.autre)
    await openGameSheet(guest, game)
    await expect(guest.getByText('Transfert proposé')).toBeVisible()
    await guest.getByRole('button', { name: 'Accepter' }).click()
    await expect(guest.getByText('Transfert proposé')).toBeHidden()
    await expect.poll(() => prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { ownerId: true } })).toEqual({ ownerId: autre.id })
    // La nouvelle propriétaire gère les partages
    await expect(guest.getByRole('button', { name: 'Partager' })).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
