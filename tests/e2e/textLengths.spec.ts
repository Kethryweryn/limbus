import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { cardByTitle as card, fieldError, orgaGame, signIn, slugOf, uniqueName } from './helpers'

// SPEC-023, US-253 : une longueur maximale sur chaque texte, des emails vérifiés partout ; le refus sous son champ

test('personnage : un nom trop long est refusé sous le champ ; un historique de 300 000 caractères s’enregistre', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu des longueurs')
    const name = uniqueName('personnage des longueurs')
    const character = await prisma.character.create({ data: { name, slug: slugOf(name), gameId: game.id } })
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/characters')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Rechercher un personnage...').fill(name)
    await card(page, name).getByRole('button', { name: 'Modifier' }).click()
    const form = page.getByRole('dialog')

    // Erreurs de saisie : le plafond s'affiche sous le champ, rien n'est enregistré
    await form.getByLabel('Nom', { exact: true }).fill('a'.repeat(201))
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(fieldError(page, 'Nom', 'Le nom : 200 caractères au plus')).toBeVisible()
    await expect(form).toBeVisible()
    expect((await prisma.character.findUniqueOrThrow({ where: { id: character.id } })).name).toBe(name)

    // Actions : un long historique passe
    const background = 'Il était une fois une très longue histoire. '.repeat(7_000).slice(0, 300_000)
    await form.getByLabel('Nom', { exact: true }).fill(name)
    await form.getByLabel('Background', { exact: true }).fill(background)
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeHidden()
    await expect.poll(async () => (await prisma.character.findUniqueOrThrow({ where: { id: character.id } })).background?.length).toBe(300_000)
  } finally {
    await prisma.$disconnect()
  }
})

test('jeu : une adresse de contact mal formée est refusée sous le champ ; une adresse en majuscules est mise en minuscules', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de l’adresse de contact')
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/games')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Rechercher un jeu...').fill(game.title)
    await card(page, game.title).getByRole('button', { name: 'Modifier' }).click()
    const form = page.getByRole('dialog')

    // Le navigateur accepte « contact@jeu » (champ email), Limbus non : une adresse a un domaine complet
    await form.getByLabel('Adresse de contact', { exact: true }).fill('contact@jeu')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(fieldError(page, 'Adresse de contact', 'Email invalide')).toBeVisible()
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).contactEmail).toBeNull()

    await form.getByLabel('Adresse de contact', { exact: true }).fill('Contact@Jeu.TEST')
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(form).toBeHidden()
    await expect.poll(async () => (await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).contactEmail).toBe('contact@jeu.test')
  } finally {
    await prisma.$disconnect()
  }
})

test('hors ligne : un nom de lieu trop long saisi sans réseau est refusé au retour du réseau, avec son plafond', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du lieu hors ligne')
    const name = uniqueName('lieu des longueurs')
    const location = await prisma.location.create({ data: { name, slug: slugOf(name), gameId: game.id } })
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/locations')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Rechercher un lieu...').fill(name)
    await expect(card(page, name)).toBeVisible()

    await context.setOffline(true)
    await card(page, name).getByRole('button', { name: 'Modifier' }).click()
    const form = page.getByRole('dialog')
    await form.getByLabel('Nom', { exact: true }).fill('a'.repeat(201))
    await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByText(/Modifications faites hors ligne : 1 en attente/)).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText(/Modifications faites hors ligne : 1 erreur/)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Voir les modifications' }).click()
    await expect(page.getByRole('dialog').getByText('Le nom : 200 caractères au plus')).toBeVisible()
    expect((await prisma.location.findUniqueOrThrow({ where: { id: location.id } })).name).toBe(name)
  } finally {
    await context.setOffline(false)
    await prisma.$disconnect()
  }
})
