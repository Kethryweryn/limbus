// US-053 : créer une session et la caster depuis l'interface
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS, PARCOURS } from './constants'
import { choose, signIn } from './helpers'

test('une session créée depuis la liste se caste et garde son casting', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/sessions')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Créer une session' }).click()
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Créer', exact: true }) })
    await choose(page, form.getByRole('combobox').first(), PARCOURS.game)
    await form.getByLabel('Nom').fill('Session casting e2e')
    await form.getByRole('button', { name: 'Créer', exact: true }).click()

    await expect.poll(() => prisma.session.count({ where: { name: 'Session casting e2e' } })).toBe(1)
    const session = await prisma.session.findFirstOrThrow({ where: { name: 'Session casting e2e' } })
    await page.goto(`/sessions/${session.slug}?tab=cast`)
    await page.waitForLoadState('networkidle')

    const row = (character: string) => page.locator('form > div.grid').filter({ hasText: character })
    await choose(page, row('Aube').getByRole('combobox'), /Léa Parcours/)
    await choose(page, row('Brume').getByRole('combobox'), /Noé Parcours/)
    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()

    await expect.poll(() => prisma.sessionAssignment.count({ where: { sessionId: session.id, participantId: { not: null } } })).toBe(2)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(row('Aube').getByRole('combobox')).toContainText('Léa Parcours')
    await expect(row('Brume').getByRole('combobox')).toContainText('Noé Parcours')
  } finally {
    await prisma.$disconnect()
  }
})
