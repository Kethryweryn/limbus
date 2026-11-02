import { createHash } from 'node:crypto'
import { expect } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { linkToken, startTestSmtp } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { parcoursSession, signIn, slugOf, test, uniqueName } from './helpers'

// EPIC-004 (SPEC-004) : une session se renomme depuis sa fiche, puis s'annule et l'équipe en est prévenue (US-021)
test('une session se renomme, s’annule, et l’équipe est prévenue', async ({ page }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const { session, participant } = await parcoursSession(prisma, 'Session à annuler', [['Aube', 'Léa Parcours']])

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}`)
    await page.waitForLoadState('networkidle')

    // Renommage : la fiche s'ouvre à sa nouvelle adresse
    const renamed = uniqueName('Session renommée')
    await page.getByRole('button', { name: 'Modifier' }).first().click()
    await page.getByLabel('Nom', { exact: true }).fill(renamed)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('heading', { name: renamed, level: 1 })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/sessions/${slugOf(renamed)}`))

    // Annulation : la modale d'information de l'équipe s'ouvre d'elle-même
    await page.getByRole('button', { name: 'Modifier' }).first().click()
    await page.getByLabel('Statut').click()
    await page.getByRole('option', { name: 'Annulée' }).click()
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Envoyer à l’équipe' })).toBeVisible()
    await dialog.getByLabel('Message').fill('La session est annulée, désolés.')
    page.once('dialog', (confirmation) => confirmation.accept())
    await dialog.getByRole('button', { name: 'Envoyer à l’équipe' }).click()
    await expect(dialog.getByText(/email\(s\) envoyé\(s\)/)).toBeVisible()
    await expect.poll(() => smtp.to(participant('Léa Parcours').email!).length).toBe(1)
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { status: true } })).status).toBe('cancelled')
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})

// EPIC-004 (US-022, US-024) : une session reportée demande la présence de son équipe, et l'onglet Présence suit les réponses
test('une session se reporte, et la présence de l’équipe se demande et se suit', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const { session, participant } = await parcoursSession(prisma, 'Session à reporter', [['Aube', 'Léa Parcours']])
    const email = participant('Léa Parcours').email!

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Reporter' }).click()
    const dialog = page.getByRole('dialog')
    const name = uniqueName('Session reportée')
    await dialog.getByLabel('Nom de la nouvelle session').fill(name)
    await dialog.getByRole('button', { name: 'Reporter' }).click()

    // La nouvelle session s'ouvre sur son onglet Présence
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    await expect(page).toHaveURL(/tab=presence/)
    page.once('dialog', (confirmation) => confirmation.accept())
    await page.getByRole('button', { name: 'Envoyer les demandes' }).click()
    await expect(page.getByText(/1 demande\(s\) envoyée\(s\)\./)).toBeVisible()

    // La personne répond par son lien ; l'équipe voit la réponse
    await expect.poll(() => smtp.to(email).length).toBe(1)
    const token = linkToken(smtp.to(email)[0]!, '/presence/')
    const created = await prisma.session.findFirstOrThrow({ where: { name } })
    const attendance = await prisma.sessionAttendance.findFirstOrThrow({ where: { sessionId: created.id } })
    expect(attendance.tokenHash).toBe(createHash('sha256').update(token!).digest('hex'))
    const guest = await otherPage()
    await guest.goto(`/presence/${token}`)
    await guest.waitForLoadState('networkidle')
    await guest.getByRole('button', { name: 'Je viens' }).click()
    await expect(guest.getByText('Votre réponse : je viens')).toBeVisible()
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Confirmé', { exact: true }).first()).toBeVisible()
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})

// EPIC-004 (SPEC-004) : l'onglet Timeline assigne les responsables des événements du jeu
test('l’onglet Timeline assigne un responsable à un événement', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { session, game, participant } = await parcoursSession(prisma, 'Session timeline')
    const responsible = participant('Noé Parcours')
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: responsible.id, role: 'organizer' } })
    const eventName = uniqueName('Briefing des PNJ')
    const event = await prisma.timelineEvent.create({ data: { name: eventName, slug: slugOf(eventName), gameId: game.id, day: 1, time: '09:00', requiredResponsibles: 1 } })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}?tab=timeline`)
    await page.waitForLoadState('networkidle')
    await page.getByLabel(`Assigner ${responsible.name} à ${eventName}`).check()
    await page.getByRole('button', { name: 'Enregistrer la timeline' }).click()
    await expect.poll(() => prisma.timelineEventResponsible.count({ where: { sessionId: session.id, timelineEventId: event.id, participantId: responsible.id } })).toBe(1)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel(`Assigner ${responsible.name} à ${eventName}`)).toBeChecked()
  } finally {
    await prisma.$disconnect()
  }
})
