// US-100, US-102 : verrouiller une attribution, proposer une répartition, l'appliquer puis l'enregistrer
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { parcoursSession, signIn } from './helpers'

// US-170 : une pré-inscrite proposée est retenue à l'enregistrement, son personnage réservé
test('l’assistant propose une pré-inscrite, retenue quand le cast s’enregistre', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { session, game, participant } = await parcoursSession(prisma, 'Session pré-inscrite e2e')
    const registration = await prisma.registration.findFirstOrThrow({ where: { participantId: participant('Léa Parcours').id, period: { gameId: game.id } } })
    await prisma.registrationSession.create({ data: { registrationId: registration.id, sessionId: session.id, status: 'preregistered', answer: 'available' } })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}?tab=cast`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Proposer une répartition' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('retenue à l’enregistrement, à confirmer')).toBeVisible()
    await dialog.getByRole('button', { name: 'Appliquer la proposition' }).click()
    expect(await prisma.registrationSession.findFirst({ where: { registrationId: registration.id, sessionId: session.id }, select: { status: true } })).toEqual({ status: 'preregistered' })

    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
    await expect.poll(() => prisma.registrationSession.findFirst({ where: { registrationId: registration.id, sessionId: session.id }, select: { status: true } })).toEqual({ status: 'retained' })
    expect(await prisma.sessionAssignment.count({ where: { sessionId: session.id, reservedRegistrationId: registration.id } })).toBe(1)
  } finally {
    await prisma.$disconnect()
  }
})

test('l’assistant remplit le cast sans toucher à la ligne verrouillée, et rien n’est enregistré avant le clic', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { session, character, participant } = await parcoursSession(prisma, 'Session assistant e2e', [['Aube', 'Léa Parcours']])
    const noe = participant('Noé Parcours')
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: noe.id, role: 'participant' } })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}?tab=cast`)
    await page.waitForLoadState('networkidle')

    const row = (name: string) => page.locator('form > div.grid').filter({ hasText: name })
    await row('Aube').getByRole('button', { name: 'Verrouiller' }).click()
    await expect(row('Aube').getByRole('button', { name: 'Déverrouiller' })).toBeVisible()

    await page.getByRole('button', { name: 'Proposer une répartition' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Proposition de répartition')).toBeVisible()
    await expect(dialog.getByText('verrouillée')).toBeVisible()
    await dialog.getByRole('button', { name: 'Appliquer la proposition' }).click()

    await expect(page.getByText('Proposition appliquée')).toBeVisible()
    await expect(row('Brume').getByRole('combobox')).toContainText('Noé Parcours')
    await expect(row('Aube').getByRole('combobox')).toContainText('Léa Parcours')
    // Appliquer n'enregistre rien
    expect(await prisma.sessionAssignment.count({ where: { sessionId: session.id, participantId: noe.id } })).toBe(0)

    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
    await expect.poll(() => prisma.sessionAssignment.count({ where: { sessionId: session.id, participantId: noe.id } })).toBe(1)
    expect(await prisma.sessionAssignment.findFirst({ where: { sessionId: session.id, characterId: character('Aube').id }, select: { locked: true, participantId: true } }))
      .toEqual({ locked: true, participantId: participant('Léa Parcours').id })
  } finally {
    await prisma.$disconnect()
  }
})
