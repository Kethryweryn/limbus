import { expect } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { linkToken } from '../integration/smtp'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { parcoursPerson, parcoursSession, signIn, slugOf, test, uniqueName } from './helpers'

// EPIC-004 (SPEC-004) : une session change de date depuis sa fiche, puis s'annule et l'équipe en est prévenue (US-021)
test('une session change de date, s’annule, et l’équipe est prévenue', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const lea = await parcoursPerson(prisma, 'Léa Annulation')
    const { session } = await parcoursSession(prisma, 'Session à annuler', [['Aube', lea.name]])

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}`)
    await page.waitForLoadState('networkidle')

    // Nouvelle date : le libellé et l'adresse suivent (SPEC-021) ; une année propre au test, pour un libellé unique
    const year = 2400 + Math.floor(Math.random() * 5000)
    await page.getByRole('button', { name: 'Modifier' }).first().click()
    await page.getByLabel('Date', { exact: true }).fill(`${year}-03-14T15:00`)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('heading', { name: `Session du 14 mars ${year}`, level: 1 })).toBeVisible()
    const { slug } = await prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { slug: true } })
    await expect(page).toHaveURL(new RegExp(`/sessions/${slug}([?]|$)`))

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
    await expect.poll(() => mailbox.to(lea.email).length).toBe(1)
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { status: true } })).status).toBe('cancelled')
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-004 (US-022, US-024) : une session reportée demande la présence de son équipe, et l'onglet Présence suit les réponses
test('une session se reporte, et la présence de l’équipe se demande et se suit', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const { email, name: lea } = await parcoursPerson(prisma, 'Léa Report')
    const { session } = await parcoursSession(prisma, 'Session à reporter', [['Aube', lea]])

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Reporter' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Reporter' }).click()

    // La nouvelle session s'ouvre sur son onglet Présence ; l'ancienne est reportée sur elle. Sans nom (SPEC-021), elle
    // se retrouve par le report
    await expect(page).toHaveURL(/tab=presence/)
    const { status, postponedToSessionId } = await prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { status: true, postponedToSessionId: true } })
    expect(status).toBe('postponed')
    const created = await prisma.session.findUniqueOrThrow({ where: { id: postponedToSessionId! } })
    await expect(page.getByRole('heading', { name: created.name, level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: session.name })).toBeVisible()
    page.once('dialog', (confirmation) => confirmation.accept())
    await page.getByRole('button', { name: 'Envoyer les demandes' }).click()
    await expect(page.getByText(/1 demande\(s\) envoyée\(s\)\./)).toBeVisible()

    // La personne répond par son lien ; l'équipe voit la réponse
    await expect.poll(() => mailbox.to(email).length).toBe(1)
    const token = linkToken(mailbox.to(email)[0]!, '/presence/')
    const guest = await otherPage()
    await guest.goto(`/presence/${token}`)
    await guest.waitForLoadState('networkidle')
    await guest.getByRole('button', { name: 'Je viens' }).click()
    await expect(guest.getByText('Votre réponse : je viens')).toBeVisible()
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Confirmé', { exact: true }).first()).toBeVisible()
  } finally {
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
