// SPEC-020, EPIC-054 : résumé des jeux et page Inscriptions d'un jeu en onglets (US-230), sur les quatre axes
// (ADR-0079) : actions, erreurs de saisie, droits, hors ligne
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { cardByTitle, orgaGame, orgaSession, registrationTab, signIn, slugOf, test, testUser, uniqueName, type TestPrisma } from './helpers'

// Jeu au vivier ouvert, une session prévue, deux personnes dans le vivier et une sortie
async function gameWithPool(prisma: TestPrisma, base: string) {
  const game = await orgaGame(prisma, base)
  const session = await orgaSession(prisma, game.id, `Session ${base}`, { date: new Date('2099-04-10T09:00:00Z') })
  const period = await prisma.registrationPeriod.create({
    data: { gameId: game.id, publicId: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } }
  })
  const person = async (label: string, status: 'received' | 'withdrawn') => {
    const name = uniqueName(label)
    const email = `${slugOf(name)}@example.test`
    const participant = await prisma.participant.create({ data: { name, slug: slugOf(name), email, gameLinks: { create: { gameId: game.id } } } })
    await prisma.registration.create({ data: { gameId: game.id, periodId: period.id, participantId: participant.id, email, status, source: 'form', firstName: label, lastName: 'Test' } })
    return name
  }
  return { game, session, period, kept: [await person('Alix', 'received'), await person('Basile', 'received')], left: await person('Côme', 'withdrawn') }
}

const summaryRow = (page: Page, title: string) => page.getByRole('listitem', { name: title })
const heading = (page: Page, title: string) => page.getByRole('heading', { level: 1, name: title, exact: true })

async function openSummary(page: Page) {
  await page.goto('/registrations')
  await page.waitForLoadState('networkidle')
}

test.describe('page Inscriptions d’un jeu', () => {
  test('le résumé donne l’état et le vivier de chaque jeu ; un jeu sans vivier propose de le créer', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const full = await gameWithPool(prisma, 'Résumé plein')
      const empty = await orgaGame(prisma, 'Résumé vide')
      await signIn(page, prisma, E2E_USERS.orga)
      await openSummary(page)
      await expect(summaryRow(page, full.game.title).getByText('Ouvert')).toBeVisible()
      await expect(summaryRow(page, full.game.title).getByText('2 personnes dans le vivier')).toBeVisible()
      await expect(summaryRow(page, empty.title).getByText('Pas de vivier')).toBeVisible()

      await summaryRow(page, empty.title).getByRole('link', { name: 'Créer le vivier' }).click()
      await expect(heading(page, empty.title)).toBeVisible()
      await expect(page.getByRole('tab')).toHaveCount(0)
      await expect(page.getByRole('main').getByRole('button', { name: 'Formulaire' })).toBeVisible()
      await page.getByRole('main').getByRole('button', { name: 'Créer le vivier' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('chaque onglet a sa part, l’onglet ouvert reste dans l’adresse et le lien ramène au résumé', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      const ctx = await gameWithPool(prisma, 'Onglets')
      await signIn(page, prisma, E2E_USERS.orga)
      await openSummary(page)
      await page.getByRole('link', { name: ctx.game.title, exact: true }).click()
      await expect(heading(page, ctx.game.title)).toBeVisible()
      const main = page.getByRole('main')

      // Sessions, par défaut : le rappel et la session ; ni le vivier ni les réglages
      await expect(main.getByText(/« Annoncer le casting » envoie les emails/)).toBeVisible()
      await expect(main.locator(`[data-session="${ctx.session.name}"]`)).toBeVisible()
      await expect(main.getByRole('button', { name: 'Copier le lien' })).toHaveCount(0)

      // Vivier : ses personnes, les sorties repliées
      await registrationTab(page, 'Vivier')
      await expect(page.getByRole('tab', { name: 'Vivier (2)' })).toBeVisible()
      await expect(page).toHaveURL(/onglet=vivier/)
      await expect(main.getByText(ctx.kept[0]!)).toBeVisible()
      await expect(main.getByText('Sorties du vivier : 1')).toBeVisible()
      await expect(main.getByText(ctx.left)).toBeHidden()
      await main.getByText('Sorties du vivier : 1').click()
      await expect(main.getByText(ctx.left)).toBeVisible()
      await expect(main.locator(`[data-session="${ctx.session.name}"]`)).toBeHidden()

      // Rechargé, puis retour depuis une autre page : le même onglet
      await page.reload()
      await expect(main.getByText(ctx.kept[1]!)).toBeVisible()
      await page.getByRole('link', { name: 'Jeux' }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: 'Jeux' })).toBeVisible()
      await page.goBack()
      await expect(main.getByText(ctx.kept[1]!)).toBeVisible()

      // Réglages : le vivier, son lien et le formulaire ; le message de l'action en haut de la page
      await registrationTab(page, 'Réglages')
      await expect(main.getByRole('button', { name: 'Supprimer le vivier' })).toBeVisible()
      await main.getByRole('button', { name: 'Copier le lien' }).click()
      const message = main.getByText('Lien de diffusion copié.')
      await expect(message).toBeVisible()
      const above = await message.evaluate((node) => {
        const tabs = document.querySelector('[role="tablist"]')
        return Boolean(tabs && (node.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING))
      })
      expect(above).toBe(true)
      await main.getByRole('button', { name: 'Formulaire' }).click()
      await expect(page.getByRole('dialog', { name: /Formulaire d’inscription/ })).toBeVisible()
      await page.keyboard.press('Escape')

      await main.getByRole('link', { name: '← Tous les jeux' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Inscriptions' })).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('avec un jeu actif, Inscriptions mène à sa page, sans lien vers le résumé', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameWithPool(prisma, 'Jeu actif inscriptions')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/games')
      await page.waitForLoadState('networkidle')
      await page.getByPlaceholder('Rechercher un jeu...').fill(ctx.game.title)
      await cardByTitle(page, ctx.game.title).getByRole('button', { name: 'Rendre actif' }).click()
      await expect(page.getByText('Jeu actif :')).toBeVisible()

      await page.getByRole('link', { name: 'Inscriptions' }).first().click()
      await expect(heading(page, ctx.game.title)).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/registrations/${ctx.game.slug}`))
      await expect(page.getByRole('link', { name: '← Tous les jeux' })).toHaveCount(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('la fiche de session mène à la page du jeu', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Lien de session')
      const session = await orgaSession(prisma, game.id, 'Session sans vivier', { date: new Date('2099-04-10T09:00:00Z') })
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(`/sessions/${session.slug}?tab=cast`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('link', { name: 'créez-le dans Inscriptions' }).click()
      await expect(heading(page, game.title)).toBeVisible()
      await expect(page.getByRole('main').getByRole('button', { name: 'Créer le vivier' })).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une co-organisatrice a le jeu ; une organisatrice sans accès et une participante ne l’ont pas', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameWithPool(prisma, 'Droits inscriptions')
      const coOrga = await testUser(prisma, 'Co-orga inscriptions')
      await prisma.gameShare.create({ data: { gameId: ctx.game.id, userId: coOrga.user.id } })
      await signIn(page, prisma, coOrga.email)
      await openSummary(page)
      await page.getByRole('link', { name: ctx.game.title, exact: true }).click()
      await registrationTab(page, 'Vivier')
      await expect(page.getByRole('main').getByText(ctx.kept[0]!)).toBeVisible()

      const stranger = await testUser(prisma, 'Sans accès inscriptions')
      await signIn(page, prisma, stranger.email)
      await openSummary(page)
      await expect(summaryRow(page, ctx.game.title)).toHaveCount(0)
      await page.goto(`/registrations/${ctx.game.slug}`)
      await expect(page.getByText('Ce jeu est introuvable, ou vous n’y avez pas accès.')).toBeVisible()
      await expect(page.getByRole('tab')).toHaveCount(0)
      await expect(page.getByText(ctx.kept[0]!)).toHaveCount(0)

      // Une participante du jeu, sans accès à son organisation
      const player = await testUser(prisma, 'Joueuse inscriptions')
      await prisma.participant.create({ data: { name: player.name, slug: slugOf(player.name), email: player.email, userId: player.user.id, gameLinks: { create: { gameId: ctx.game.id } } } })
      await signIn(page, prisma, player.email)
      await page.goto(`/registrations/${ctx.game.slug}`)
      await expect(page.getByText('Ce jeu est introuvable, ou vous n’y avez pas accès.')).toBeVisible()
      await expect(page.getByText(ctx.kept[0]!)).toHaveCount(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, le résumé et la page du jeu se relisent, onglets compris', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameWithPool(prisma, 'Inscriptions hors ligne')
      await signIn(page, prisma, E2E_USERS.orga)
      await openSummary(page)
      await page.getByRole('link', { name: ctx.game.title, exact: true }).click()
      await expect(page.getByRole('main').locator(`[data-session="${ctx.session.name}"]`)).toBeVisible()
      await page.getByRole('link', { name: 'Jeux' }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: 'Jeux' })).toBeVisible()

      await context.setOffline(true)
      await page.getByRole('link', { name: 'Inscriptions' }).first().click()
      await expect(summaryRow(page, ctx.game.title).getByText('2 personnes dans le vivier')).toBeVisible()
      await page.getByRole('link', { name: ctx.game.title, exact: true }).click()
      await expect(page.getByRole('main').locator(`[data-session="${ctx.session.name}"]`)).toBeVisible()
      await registrationTab(page, 'Vivier')
      await expect(page.getByRole('main').getByText(ctx.kept[0]!)).toBeVisible()
      await registrationTab(page, 'Réglages')
      await expect(page.getByRole('main').getByRole('button', { name: 'Copier le lien' })).toBeVisible()
      await context.setOffline(false)
    } finally {
      await prisma.$disconnect()
    }
  })
})
