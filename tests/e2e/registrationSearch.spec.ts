// SPEC-020, EPIC-054 : rechercher et filtrer dans le vivier (US-232), sur les quatre axes (ADR-0079) : actions, erreurs de
// saisie (recherche sans résultat), droits (ceux de la page, US-230), hors ligne
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { openRegistrations, orgaGame, orgaSession, registrationTab, signIn, slugOf, test, uniqueName, type TestPrisma } from './helpers'

// Trois personnes dans le vivier, dont deux ont demandé la première session ; une invitation sans réponse
async function pool(prisma: TestPrisma, base: string) {
  const game = await orgaGame(prisma, base)
  const first = await orgaSession(prisma, game.id, `Printemps ${base}`, { date: new Date('2099-03-01T09:00:00Z') })
  const second = await orgaSession(prisma, game.id, `Automne ${base}`, { date: new Date('2099-09-01T09:00:00Z') })
  const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state: 'open' } })
  const person = async (label: string, status: 'received' | 'invited', lines: Array<{ sessionId: string, status: 'preregistered' | 'unavailable' }>) => {
    const name = uniqueName(label)
    const email = `${slugOf(name)}@example.test`
    const participant = await prisma.participant.create({ data: { name, slug: slugOf(name), email, gameLinks: { create: { gameId: game.id } } } })
    await prisma.registration.create({
      data: {
        gameId: game.id, periodId: period.id, participantId: participant.id, email, status, source: status === 'invited' ? 'invitation' : 'form',
        sessionLines: { create: lines.map((line) => ({ ...line, answer: line.status === 'unavailable' ? 'unavailable' : 'available' })) }
      }
    })
    return { name, email }
  }
  return {
    game, first, second,
    helene: await person('Hélène', 'received', [{ sessionId: first.id, status: 'preregistered' }]),
    marc: await person('Marc', 'received', [{ sessionId: first.id, status: 'preregistered' }, { sessionId: second.id, status: 'unavailable' }]),
    zoe: await person('Zoé Cœur', 'received', [{ sessionId: second.id, status: 'preregistered' }]),
    invited: await person('Hector', 'invited', [])
  }
}

const main = (page: Page) => page.getByRole('main')

async function openPool(page: Page, prisma: TestPrisma, title: string) {
  await signIn(page, prisma, E2E_USERS.orga)
  await openRegistrations(page, title, 'Vivier')
  await expect(main(page).getByText('Dans le vivier : 3')).toBeVisible()
}

test.describe('recherche dans le vivier', () => {
  test('la recherche trouve par nom sans accents ni majuscules, et par email ; elle filtre aussi les invitations', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await pool(prisma, 'Recherche')
      await openPool(page, prisma, ctx.game.title)
      await main(page).getByPlaceholder('Nom ou email').fill('HELENE')
      await expect(main(page).getByText('Dans le vivier : 1 sur 3')).toBeVisible()
      await expect(main(page).getByText(ctx.helene.name)).toBeVisible()
      await expect(main(page).getByText(ctx.marc.name)).toHaveCount(0)
      await expect(main(page).getByText('Invitations sans réponse : 0 sur 1')).toBeVisible()

      await main(page).getByPlaceholder('Nom ou email').fill(ctx.invited.email)
      await expect(main(page).getByText('Invitations sans réponse : 1 sur 1')).toBeVisible()
      await expect(main(page).getByText('Dans le vivier : 0 sur 3')).toBeVisible()

      // Ligature : « coeur » trouve « Cœur »
      await main(page).getByPlaceholder('Nom ou email').fill('zoe coeur')
      await expect(main(page).getByText(ctx.zoe.name)).toBeVisible()
      await main(page).getByPlaceholder('Nom ou email').fill(ctx.zoe.email.toUpperCase())
      await expect(main(page).getByText(ctx.zoe.name)).toBeVisible()
      await expect(main(page).getByText('Dans le vivier : 1 sur 3')).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('le filtre par vœu garde les personnes qui ont demandé la session, et se combine avec la recherche', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await pool(prisma, 'Voeux')
      await openPool(page, prisma, ctx.game.title)
      await main(page).getByRole('combobox').click()
      await page.getByRole('option', { name: ctx.second.name }).click()
      // Marc n'est pas disponible pour cette session : seule Zoé l'a demandée
      await expect(main(page).getByText('Dans le vivier : 1 sur 3')).toBeVisible()
      await expect(main(page).getByText(ctx.zoe.name)).toBeVisible()
      await expect(main(page).getByText(ctx.marc.name)).toHaveCount(0)

      await main(page).getByRole('combobox').click()
      await page.getByRole('option', { name: ctx.first.name }).click()
      await expect(main(page).getByText('Dans le vivier : 2 sur 3')).toBeVisible()
      await main(page).getByPlaceholder('Nom ou email').fill('marc')
      await expect(main(page).getByText('Dans le vivier : 1 sur 3')).toBeVisible()
      await expect(main(page).getByText(ctx.marc.name)).toBeVisible()

      // La session filtrée est annulée, puis la page relue : le filtre revient à toutes les personnes
      await main(page).getByPlaceholder('Nom ou email').fill('')
      await prisma.session.update({ where: { id: ctx.first.id }, data: { status: 'cancelled' } })
      // Coupure puis retour du réseau : la page relit le vivier
      await context.setOffline(true)
      await context.setOffline(false)
      await expect(main(page).getByText('Dans le vivier : 3')).toBeVisible()
      await expect(main(page).getByRole('combobox')).toContainText('Toutes les personnes')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une recherche sans résultat le dit et s’efface', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await pool(prisma, 'Sans resultat')
      await openPool(page, prisma, ctx.game.title)
      await main(page).getByPlaceholder('Nom ou email').fill('personne-inconnue')
      await expect(main(page).getByText('Personne ne correspond à cette recherche.')).toBeVisible()
      await main(page).getByRole('button', { name: 'Effacer la recherche' }).click()
      await expect(main(page).getByPlaceholder('Nom ou email')).toHaveValue('')
      await expect(main(page).getByText('Dans le vivier : 3')).toBeVisible()
      // La recherche ne va pas dans l'adresse
      await expect(page).not.toHaveURL(/inconnue/)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, la recherche et le filtre marchent sur le vivier relu', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await pool(prisma, 'Recherche hors ligne')
      await openPool(page, prisma, ctx.game.title)
      await page.getByRole('link', { name: 'Jeux' }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: 'Jeux' })).toBeVisible()
      await context.setOffline(true)
      await page.goBack()
      await registrationTab(page, 'Vivier')
      await main(page).getByPlaceholder('Nom ou email').fill('zoe')
      await expect(main(page).getByText(ctx.zoe.name)).toBeVisible()
      await expect(main(page).getByText('Dans le vivier : 1 sur 3')).toBeVisible()
      await context.setOffline(false)
    } finally {
      await prisma.$disconnect()
    }
  })
})
