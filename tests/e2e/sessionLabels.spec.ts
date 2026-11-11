// SPEC-021, EPIC-055 : une session sans nom, désignée par sa date (US-234), sur les quatre axes (ADR-0079) : actions,
// erreurs de saisie (plus rien à refuser : voir l'US), droits (ceux de SPEC-004, inchangés : non rejoués ici), hors ligne
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { choose, orgaGame, orgaSession, signIn, test, type TestPrisma } from './helpers'

const labelsOf = async (prisma: TestPrisma, gameId: string) =>
  (await prisma.session.findMany({ where: { gameId }, orderBy: { date: 'asc' }, select: { name: true } })).map((row) => row.name)

async function createFromList(page: Page, gameTitle: string, date: string) {
  await page.getByRole('button', { name: 'Créer une session' }).click()
  await choose(page, page.getByLabel('Jeu', { exact: true }), gameTitle)
  await page.getByLabel('Date', { exact: true }).fill(date)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
}

test.describe('session sans nom', () => {
  // Les heures saisies sont celles de Paris, comme le libellé
  test.use({ timezoneId: 'Europe/Paris' })

  test('le formulaire ne demande pas de nom ; une seconde session le même jour ajoute l’heure aux deux', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Libellés de session')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/sessions')
      await page.waitForLoadState('networkidle')

      await page.getByRole('button', { name: 'Créer une session' }).click()
      await expect(page.getByLabel('Nom', { exact: true })).toHaveCount(0)
      await page.keyboard.press('Escape')

      await createFromList(page, game.title, '2099-05-15T14:00')
      await expect.poll(() => labelsOf(prisma, game.id)).toEqual(['Session du 15 mai 2099'])
      await createFromList(page, game.title, '2099-05-15T19:30')
      await expect.poll(() => labelsOf(prisma, game.id)).toEqual(['Session du 15 mai 2099, 14 h', 'Session du 15 mai 2099, 19 h 30'])
      const first = await prisma.session.findFirstOrThrow({ where: { gameId: game.id }, orderBy: { date: 'asc' }, select: { slug: true } })
      expect(first.slug).toMatch(new RegExp(`^${game.slug}-2099-05-15(-\\d+)?$`))

      // Sa fiche se lit par son libellé, à son adresse
      await page.goto(`/sessions/${first.slug}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Session du 15 mai 2099, 14 h' })).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('déplacée, une session prend le libellé de sa nouvelle date, et sa voisine perd son heure', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Session déplacée')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/sessions')
      await page.waitForLoadState('networkidle')
      await createFromList(page, game.title, '2099-06-01T10:00')
      await createFromList(page, game.title, '2099-06-01T16:00')
      await expect.poll(() => labelsOf(prisma, game.id)).toEqual(['Session du 1er juin 2099, 10 h', 'Session du 1er juin 2099, 16 h'])

      const evening = await prisma.session.findFirstOrThrow({ where: { gameId: game.id, name: { endsWith: '16 h' } }, select: { slug: true } })
      await page.goto(`/sessions/${evening.slug}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Modifier' }).first().click()
      await page.getByLabel('Date', { exact: true }).fill('2099-06-08T16:00')
      await page.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Session du 8 juin 2099' })).toBeVisible()
      await expect.poll(() => labelsOf(prisma, game.id)).toEqual(['Session du 1er juin 2099', 'Session du 8 juin 2099'])
    } finally {
      await prisma.$disconnect()
    }
  })

  test('« Reporter » ne demande pas de nom : la nouvelle session se lit par sa date', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Report sans nom')
      const session = await orgaSession(prisma, game.id, 'À reporter', { date: new Date('2099-07-14T08:00:00Z') })
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(`/sessions/${session.slug}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Reporter' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByLabel('Nom de la nouvelle session')).toHaveCount(0)
      await dialog.getByLabel('Nouvelle date').fill('2099-09-21T10:00')
      await dialog.getByRole('button', { name: 'Reporter' }).click()
      await expect.poll(async () => (await prisma.session.findFirst({ where: { gameId: game.id, status: 'scheduled' }, select: { name: true } }))?.name)
        .toBe('Session du 21 septembre 2099')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('créée sans réseau, une session prend son libellé au retour du réseau', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Session hors ligne')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/sessions')
      await page.waitForLoadState('networkidle')
      await context.setOffline(true)
      await createFromList(page, game.title, '2099-10-03T14:00')
      expect(await labelsOf(prisma, game.id)).toEqual([])
      await context.setOffline(false)
      await expect.poll(() => labelsOf(prisma, game.id), { timeout: 20000 }).toEqual(['Session du 3 octobre 2099'])
    } finally {
      await prisma.$disconnect()
    }
  })
})
