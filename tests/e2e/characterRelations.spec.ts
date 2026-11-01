import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { signIn } from './helpers'

// EPIC-024 : l'équipe relie deux personnages depuis la page de l'un, et la relation apparaît sur la page de l'autre
test('l’équipe relie deux personnages, la relation se voit des deux côtés', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `relations-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const ada = await prisma.character.create({ data: { name: 'Ada Relation', slug: `ada-${key}`, gameId: game.id } })
    const bran = await prisma.character.create({ data: { name: 'Bran Relation', slug: `bran-${key}`, gameId: game.id } })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/characters/${ada.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Ajouter une relation' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText('Choisir un personnage').click()
    await page.getByRole('option', { name: 'Bran Relation' }).click()
    await dialog.getByLabel('Rôle de Ada Relation').fill('demi-sœur de')
    await dialog.getByLabel('Description').fill('Brouillés depuis la guerre')
    await dialog.getByLabel('Dans la fiche de Ada Relation').check()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Ada Relation : demi-sœur de')).toBeVisible()
    await expect(page.getByText('Dans sa fiche')).toBeVisible()

    const stored = await prisma.characterRelation.findFirstOrThrow({ where: { fromCharacterId: ada.id } })
    expect(stored).toMatchObject({ toCharacterId: bran.id, type: 'family', fromLabel: 'demi-sœur de', fromVisible: true, toVisible: false })

    await page.goto(`/characters/${bran.slug}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Brouillés depuis la guerre')).toBeVisible()
    await expect(page.getByText('Dans sa fiche')).toBeHidden()
  } finally {
    await prisma.$disconnect()
  }
})
