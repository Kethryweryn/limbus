// SPEC-020, EPIC-054 : ce qui reste à traiter, par jeu et par session (US-233), sur les quatre axes (ADR-0079) : actions,
// erreurs de saisie (aucune saisie), droits, hors ligne
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { orgaGame, orgaSession, signIn, slugOf, test, testUser, uniqueName, type TestPrisma } from './helpers'
import { withFicheValues } from '../fiche'

// Une session prévue au casting jamais annoncé : une retenue aux réponses modifiées, une place annoncée qui attend sa réponse ; une
// session terminée, qui ne compte pas
async function gameToHandle(prisma: TestPrisma, base: string) {
  const game = await orgaGame(prisma, base)
  const session = await orgaSession(prisma, game.id, `Session ${base}`, { date: new Date('2099-05-01T09:00:00Z') })
  const done = await orgaSession(prisma, game.id, `Terminée ${base}`, { date: new Date('2020-05-01T09:00:00Z'), status: 'completed' })
  const period = await prisma.registrationPeriod.create({
    data: { gameId: game.id, publicId: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state: 'open', sessions: { create: [{ sessionId: session.id, open: true }, { sessionId: done.id }] } }
  })
  const person = async (label: string, lines: Array<Record<string, unknown> & { sessionId: string }>) => {
    const name = uniqueName(label)
    const email = `${slugOf(name)}@example.test`
    const participant = await withFicheValues(prisma.participant.create({ data: { slug: slugOf(name), email, gameLinks: { create: { gameId: game.id , name: name } } } }), { name: name })
    await prisma.registration.create({
      data: { gameId: game.id, periodId: period.id, participantId: participant.id, email, status: 'received', source: 'form', sessionLines: { create: lines.map((line) => ({ status: 'preregistered', answer: 'available', ...line })) } }
    })
    return name
  }
  const changed = await person('Modifiée', [{ sessionId: session.id, status: 'retained', answersChangedAt: new Date() }, { sessionId: done.id, status: 'retained', answersChangedAt: new Date() }])
  await person('Attendue', [{ sessionId: session.id, status: 'retained', announcedStatus: 'retained', announcedAt: new Date(), responseDueAt: new Date('2099-04-01T09:00:00Z') }])
  return { game, session, done, changed }
}

const row = (page: Page, title: string) => page.getByRole('listitem', { name: title })
const ALL = '1 réponse modifiée · 1 réponse attendue · 1 casting à annoncer'

test.describe('ce qui reste à traiter', () => {
  test('le résumé et la ligne de la session le disent ; marquer comme lu le fait baisser ; un jeu sans rien n’en dit rien', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameToHandle(prisma, 'A traiter')
      const calm = await orgaGame(prisma, 'Rien à traiter')
      await prisma.registrationPeriod.create({ data: { gameId: calm.id, publicId: `c${Date.now().toString(36)}`, state: 'open' } })
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/registrations')
      await page.waitForLoadState('networkidle')
      await expect(row(page, ctx.game.title).locator('[data-to-handle]')).toHaveText(ALL)
      await expect(row(page, calm.title).locator('[data-to-handle]')).toHaveCount(0)

      await page.getByRole('link', { name: ctx.game.title, exact: true }).click()
      const block = page.locator(`[data-session="${ctx.session.label}"]`)
      await expect(block.locator('[data-to-handle]')).toHaveText(ALL)
      await block.locator('li').filter({ hasText: ctx.changed }).getByRole('button', { name: 'Marquer comme lu' }).click()
      await expect(block.locator('[data-to-handle]')).toHaveText('1 réponse attendue · 1 casting à annoncer')

      await page.getByRole('link', { name: '← Tous les jeux' }).click()
      await expect(row(page, ctx.game.title).locator('[data-to-handle]')).toHaveText('1 réponse attendue · 1 casting à annoncer')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une organisatrice sans accès ne voit pas le jeu ni ses nombres ; une co-organisatrice les voit', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameToHandle(prisma, 'A traiter partage')
      const coOrga = await testUser(prisma, 'Co-orga à traiter')
      await prisma.gameShare.create({ data: { gameId: ctx.game.id, userId: coOrga.user.id } })
      await signIn(page, prisma, coOrga.email)
      await page.goto('/registrations')
      await page.waitForLoadState('networkidle')
      await expect(row(page, ctx.game.title).locator('[data-to-handle]')).toHaveText(ALL)

      const stranger = await testUser(prisma, 'Sans accès à traiter')
      await signIn(page, prisma, stranger.email)
      await page.goto('/registrations')
      await page.waitForLoadState('networkidle')
      await expect(row(page, ctx.game.title)).toHaveCount(0)
      await expect(page.getByText(ALL)).toHaveCount(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, les nombres se relisent depuis la dernière lecture', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameToHandle(prisma, 'A traiter hors ligne')
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/registrations')
      await page.waitForLoadState('networkidle')
      await expect(row(page, ctx.game.title).locator('[data-to-handle]')).toHaveText(ALL)
      await page.getByRole('link', { name: 'Jeux' }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: 'Jeux' })).toBeVisible()

      await context.setOffline(true)
      await page.getByRole('link', { name: 'Inscriptions' }).first().click()
      await expect(row(page, ctx.game.title).locator('[data-to-handle]')).toHaveText(ALL)
      await context.setOffline(false)
    } finally {
      await prisma.$disconnect()
    }
  })
})
