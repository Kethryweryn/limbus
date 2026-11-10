// SPEC-020, EPIC-054 : sessions repliées, dans l'adresse, avec leurs tirages (US-231), sur les quatre axes (ADR-0079) :
// actions, erreurs de saisie (aucune saisie), droits (ceux de la page, US-230), hors ligne
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { openRegistrations, orgaGame, orgaSession, signIn, test, type TestPrisma } from './helpers'

const SETTINGS = { weightNotDrawnBefore: false, weightBalance: false, balanceAttribute: null, waitlistSize: 0 }
const RESULT = { sessions: [], rejected: [] }

// Deux sessions prévues, une terminée ; un tirage pour la première et un pour la terminée
async function gameWithSessions(prisma: TestPrisma, base: string) {
  const game = await orgaGame(prisma, base)
  const first = await orgaSession(prisma, game.id, `Première ${base}`, { date: new Date('2099-03-01T09:00:00Z') })
  const second = await orgaSession(prisma, game.id, `Seconde ${base}`, { date: new Date('2099-06-01T09:00:00Z') })
  const done = await orgaSession(prisma, game.id, `Terminée ${base}`, { date: new Date('2020-03-01T09:00:00Z'), status: 'completed' })
  const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state: 'open' } })
  await prisma.registrationDraw.create({ data: { gameId: game.id, periodId: period.id, sessionId: first.id, seed: 'graine-premiere', settings: SETTINGS, result: RESULT } })
  await prisma.registrationDraw.create({ data: { gameId: game.id, periodId: period.id, sessionId: done.id, seed: 'graine-terminee', settings: SETTINGS, result: RESULT } })
  // Une session reportée n'est pas dans la liste ; son tirage s'annule encore
  const postponed = await orgaSession(prisma, game.id, `Reportée ${base}`, { date: new Date('2099-09-01T09:00:00Z'), status: 'postponed' })
  await prisma.registrationDraw.create({ data: { gameId: game.id, periodId: period.id, sessionId: postponed.id, seed: 'graine-reportee', settings: SETTINGS, result: RESULT } })
  return { game, first, second, done, postponed }
}

const block = (page: Page, name: string) => page.locator(`[data-session="${name}"]`)
const toggle = (page: Page, name: string) => block(page, name).getByRole('button', { name: new RegExp(`^${name}`) })
const expanded = (page: Page, name: string) => block(page, name).getByRole('button', { name: 'Sélection' })

test.describe('sessions repliées', () => {
  test('la première session est dépliée, les autres se déplient ; l’adresse garde le choix, même tout replié', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameWithSessions(prisma, 'Repli')
      await signIn(page, prisma, E2E_USERS.orga)
      await openRegistrations(page, ctx.game.title)
      await expect(expanded(page, ctx.first.name)).toBeVisible()
      await expect(expanded(page, ctx.second.name)).toHaveCount(0)
      await expect(toggle(page, ctx.second.name)).toHaveAttribute('aria-expanded', 'false')
      // Une session terminée n'est pas dans la liste
      await expect(block(page, ctx.done.name)).toHaveCount(0)

      await toggle(page, ctx.second.name).click()
      await expect(expanded(page, ctx.second.name)).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`sessions=${ctx.first.id}(%2C|,)${ctx.second.id}`))
      await page.reload()
      await expect(expanded(page, ctx.first.name)).toBeVisible()
      await expect(expanded(page, ctx.second.name)).toBeVisible()

      // Tout replié, puis retour depuis une autre page : rien ne se redéplie
      await toggle(page, ctx.first.name).click()
      await toggle(page, ctx.second.name).click()
      await expect(expanded(page, ctx.first.name)).toHaveCount(0)
      await page.getByRole('link', { name: 'Jeux' }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: 'Jeux' })).toBeVisible()
      await page.goBack()
      await expect(toggle(page, ctx.first.name)).toBeVisible()
      await expect(expanded(page, ctx.first.name)).toHaveCount(0)
      await expect(expanded(page, ctx.second.name)).toHaveCount(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('les tirages d’une session sont sous elle, repliés ; ceux d’une session terminée sont sous « Sessions passées », sans annulation, sauf pour une session reportée', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameWithSessions(prisma, 'Tirages')
      await signIn(page, prisma, E2E_USERS.orga)
      await openRegistrations(page, ctx.game.title)
      const first = block(page, ctx.first.name)
      await expect(first.getByText('graine-premiere')).toBeHidden()
      await first.getByText('Tirages : 1').click()
      await expect(first.getByText('graine-premiere')).toBeVisible()
      await expect(first.getByRole('button', { name: 'Annuler ce tirage' })).toBeVisible()

      const past = page.locator('[data-past-draws]')
      await expect(past.getByText('graine-terminee')).toBeHidden()
      await past.getByText('Sessions passées : 2 tirages').click()
      await expect(past.getByText('graine-terminee')).toBeVisible()
      const done = past.locator('[data-draw]').filter({ hasText: ctx.done.name })
      await expect(done.getByRole('button', { name: 'Annuler ce tirage' })).toHaveCount(0)
      const postponed = past.locator('[data-draw]').filter({ hasText: ctx.postponed.name })
      await expect(postponed.getByRole('button', { name: 'Annuler ce tirage' })).toBeVisible()
      await expect(past.getByText('graine-premiere')).toHaveCount(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, les sessions dépliées et leurs tirages se relisent', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await gameWithSessions(prisma, 'Repli hors ligne')
      await signIn(page, prisma, E2E_USERS.orga)
      await openRegistrations(page, ctx.game.title)
      await toggle(page, ctx.second.name).click()
      await expect(expanded(page, ctx.second.name)).toBeVisible()

      await page.getByRole('link', { name: 'Jeux' }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: 'Jeux' })).toBeVisible()
      await context.setOffline(true)
      await page.goBack()
      await expect(expanded(page, ctx.first.name)).toBeVisible()
      await expect(expanded(page, ctx.second.name)).toBeVisible()
      await block(page, ctx.first.name).getByText('Tirages : 1').click()
      await expect(block(page, ctx.first.name).getByText('graine-premiere')).toBeVisible()
      await context.setOffline(false)
    } finally {
      await prisma.$disconnect()
    }
  })
})
