// US-255 : au retour du réseau, les modifications faites hors ligne partent sans recharger la page, qui relit ses
// données ; jamais pendant une saisie ni dans une fenêtre ouverte (SPEC-010, R7)
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { cardByTitle as card, orgaGame, signIn, slugOf, test, uniqueName } from './helpers'

const markPage = (page: Page) => page.evaluate(() => { (window as unknown as { sansRechargement: boolean }).sansRechargement = true })
const notReloaded = (page: Page) => page.evaluate(() => (window as unknown as { sansRechargement?: boolean }).sansRechargement === true)

async function twoLocations(page: Page, base: string) {
  const prisma = createTestPrisma()
  const game = await orgaGame(prisma, base)
  const names = [uniqueName('Lieu renommé'), uniqueName('Lieu relu')]
  const [renamed, reread] = await Promise.all(names.map((name) => prisma.location.create({ data: { name, slug: slugOf(name), gameId: game.id } })))
  await signIn(page, prisma, E2E_USERS.orga)
  await page.goto('/locations')
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder('Rechercher un lieu...').fill(game.title)
  await expect(card(page, reread!.name)).toBeVisible()
  await markPage(page)
  return { prisma, renamed: renamed!, reread: reread! }
}

async function renameOffline(page: Page, name: string, newName: string) {
  await card(page, name).getByRole('button', { name: 'Modifier' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Nom', { exact: true }).fill(newName)
  await form.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText(/Modifications faites hors ligne : 1 en attente/)).toBeVisible()
}

test('au retour du réseau, la modification part et la page relit ses données, sans se recharger', async ({ page, context }) => {
  const { prisma, renamed, reread } = await twoLocations(page, 'Jeu du retour du réseau')
  try {
    await context.setOffline(true)
    const newName = `${renamed.name} (hors ligne)`
    await renameOffline(page, renamed.name, newName)
    // Changé sur le serveur entre-temps : seule une relecture l'affiche
    await prisma.location.update({ where: { id: reread.id }, data: { address: 'Adresse venue du serveur' } })

    await context.setOffline(false)
    await expect(page.getByText('Modifications envoyées')).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => (await prisma.location.findUniqueOrThrow({ where: { id: renamed.id } })).name).toBe(newName)
    await expect(card(page, reread.name).getByText('Adresse venue du serveur')).toBeVisible()
    await expect(card(page, newName)).toBeVisible()
    expect(await notReloaded(page)).toBe(true)
  } finally {
    await context.setOffline(false)
    await prisma.$disconnect()
  }
})

test('une saisie en cours au retour du réseau reste intacte, et la page se relit à la fermeture de la fenêtre', async ({ page, context }) => {
  const { prisma, renamed, reread } = await twoLocations(page, 'Jeu de la saisie en cours')
  try {
    await context.setOffline(true)
    const newName = `${renamed.name} (hors ligne)`
    await renameOffline(page, renamed.name, newName)
    await prisma.location.update({ where: { id: reread.id }, data: { address: 'Adresse venue du serveur' } })

    // Une autre fiche en cours de modification quand le réseau revient
    await card(page, reread.name).getByRole('button', { name: 'Modifier' }).click()
    const form = page.getByRole('dialog')
    await form.getByLabel('Notes', { exact: true }).fill('Saisie en cours')
    await context.setOffline(false)
    await expect.poll(async () => (await prisma.location.findUniqueOrThrow({ where: { id: renamed.id } })).name, { timeout: 20_000 }).toBe(newName)
    await expect(page.getByText('Modifications envoyées')).toBeVisible()
    await page.waitForTimeout(3_000)
    await expect(form.getByLabel('Notes', { exact: true })).toHaveValue('Saisie en cours')
    expect(await notReloaded(page)).toBe(true)

    // Fenêtre fermée : la page se relit
    await form.getByRole('button', { name: 'Annuler' }).click()
    await expect(card(page, reread.name).getByText('Adresse venue du serveur')).toBeVisible({ timeout: 5_000 })
    expect(await notReloaded(page)).toBe(true)
  } finally {
    await context.setOffline(false)
    await prisma.$disconnect()
  }
})
