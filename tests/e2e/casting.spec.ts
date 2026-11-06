// US-053 : créer une session et la caster depuis l'interface
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS, PARCOURS } from './constants'
import { choose, signIn, uniqueName } from './helpers'

test('une session créée depuis la liste se caste depuis le vivier, et ses réservations restent (US-176)', async ({ page }) => {
  const prisma = createTestPrisma()
  const name = uniqueName('Session casting e2e')
  try {
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/sessions')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Créer une session' }).click()
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Créer', exact: true }) })
    await choose(page, form.getByRole('combobox').first(), PARCOURS.game)
    await form.getByLabel('Nom').fill(name)
    await form.getByRole('button', { name: 'Créer', exact: true }).click()

    await expect.poll(() => prisma.session.count({ where: { name } })).toBe(1)
    const session = await prisma.session.findFirstOrThrow({ where: { name } })
    await page.goto(`/sessions/${session.slug}?tab=cast`)
    await page.waitForLoadState('networkidle')

    const row = (character: string) => page.locator('form > div.grid').filter({ hasText: character })
    // Hors du vivier : la personne du jeu n'est pas proposée
    await row('Aube').getByRole('combobox').click()
    await expect(page.getByRole('option', { name: /Léa Parcours \(vivier : intéressée\)/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Sam Parcours/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await choose(page, row('Aube').getByRole('combobox'), /Léa Parcours/)
    await choose(page, row('Brume').getByRole('combobox'), /Noé Parcours/)
    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()

    // Retenues, le personnage réservé : elles confirment ensuite
    await expect.poll(() => prisma.sessionAssignment.count({ where: { sessionId: session.id, reservedRegistrationId: { not: null } } })).toBe(2)
    expect(await prisma.registrationSession.count({ where: { sessionId: session.id, status: 'retained' } })).toBe(2)
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id } })).toBe(0)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(row('Aube').getByRole('combobox')).toContainText('Léa Parcours')
    await expect(row('Aube').getByText('Réservé, en attente de confirmation')).toBeVisible()
    await expect(row('Brume').getByRole('combobox')).toContainText('Noé Parcours')

    // Inviter pour cette session : la session est déjà choisie
    await page.getByRole('button', { name: 'Inviter pour cette session' }).click()
    const invitation = page.getByRole('dialog')
    await expect(invitation.getByText('Inviter à rejoindre le vivier')).toBeVisible()
    await expect(invitation.getByRole('combobox').first()).toContainText(name)
  } finally {
    await prisma.$disconnect()
  }
})
