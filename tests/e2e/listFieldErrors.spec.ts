// SPEC-023, R11 : le refus d'une ligne du trombinoscope d'un personnage ou du cast d'une session s'affiche sous son champ
import { expect } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { castSession, gameCharacter, gamePerson, orgaGame, signIn, test } from './helpers'

test('trombinoscope : une note trop longue est refusée sous le champ de son personnage, puis s’enregistre une fois raccourcie', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du trombinoscope refusé')
    const viewer = await gameCharacter(prisma, game.id, 'Aube regarde')
    const seen = await gameCharacter(prisma, game.id, 'Brume vue')
    const other = await gameCharacter(prisma, game.id, 'Ciel à côté')
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/characters/${viewer.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Trombinoscope' }).click()
    const modal = page.getByRole('dialog')
    const entry = (name: string) => modal.locator('article').filter({ has: page.getByRole('heading', { level: 3, name }) })

    // Erreurs de saisie : chaque message sous le champ de sa ligne, rien d'enregistré
    await entry(seen.name).getByLabel('Note personnalisée').fill('a'.repeat(501))
    await entry(other.name).getByLabel('Nom affiché').fill('b'.repeat(201))
    await modal.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(entry(seen.name).getByText('La note : 500 caractères au plus')).toBeVisible()
    await expect(entry(other.name).getByText('La fausse identité : 200 caractères au plus')).toBeVisible()
    await expect(entry(seen.name).getByText('La fausse identité')).toHaveCount(0)
    await expect(modal.getByText('Certaines informations sont manquantes ou incorrectes.')).toBeVisible()
    expect(await prisma.characterTrombinoscopeEntry.count({ where: { viewerCharacterId: viewer.id } })).toBe(0)

    // Actions : raccourcies, les saisies s'enregistrent et les messages disparaissent
    await entry(seen.name).getByLabel('Note personnalisée').fill('Une note courte')
    await entry(other.name).getByLabel('Nom affiché').fill('Le Voyageur')
    await modal.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(modal).toBeHidden()
    await expect.poll(async () => (await prisma.characterTrombinoscopeEntry.findFirst({ where: { viewerCharacterId: viewer.id, targetCharacterId: seen.id }, select: { note: true } }))?.note).toBe('Une note courte')
  } finally {
    await prisma.$disconnect()
  }
})

test('cast : une note trop longue est refusée sous la note de sa ligne, puis s’enregistre une fois raccourcie', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du cast refusé')
    const role = await gameCharacter(prisma, game.id, 'Aube castée')
    const free = await gameCharacter(prisma, game.id, 'Brume libre')
    const lea = await gamePerson(prisma, game.id, 'Léa cast')
    const session = await castSession(prisma, game.id, 'Session du cast refusé', [[role, lea]])
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}?tab=cast`)
    await page.waitForLoadState('networkidle')
    const row = (name: string) => page.locator('div.grid').filter({ has: page.getByText(name, { exact: true }) }).filter({ has: page.getByLabel('Notes') })

    // Erreurs de saisie : le plafond s'affiche sous la note de la ligne, rien d'enregistré
    await row(role.name).getByLabel('Notes').fill('a'.repeat(50_001))
    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
    await expect(row(role.name).getByText(/^La note : 50\s000 caractères au plus$/)).toBeVisible()
    await expect(row(free.name).getByText(/caractères au plus/)).toHaveCount(0)
    await expect(page.getByText('Certaines informations sont manquantes ou incorrectes.')).toBeVisible()
    expect((await prisma.sessionAssignment.findFirstOrThrow({ where: { sessionId: session.id, characterId: role.id } })).notes).toBeNull()

    // Actions : raccourcie, la note s'enregistre et le message disparaît
    await row(role.name).getByLabel('Notes').fill('Arrive en avance')
    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
    await expect.poll(async () => (await prisma.sessionAssignment.findFirstOrThrow({ where: { sessionId: session.id, characterId: role.id } })).notes).toBe('Arrive en avance')
    await expect(page.getByText(/caractères au plus/)).toHaveCount(0)
  } finally {
    await prisma.$disconnect()
  }
})
