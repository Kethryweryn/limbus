import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { personalLinkToken, startTestSmtp } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { expectLoggedIn, login } from './helpers'

// EPIC-001 : invitation par l'organisatrice → réponse par le lien personnel → présence dans la session
test('une personne invitée accepte par son lien et rejoint la session', async ({ page, browser }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    await login(page, E2E_USERS.orga)
    await expectLoggedIn(page)
    await page.goto('/registrations')
    await page.getByRole('button', { name: 'Inviter', exact: true }).click()
    await page.getByText('Camille Invitée').click()
    await page.getByRole('button', { name: 'Inviter (1)' }).click()
    await expect(page.getByText('1 invitation, 1 email envoyé.')).toBeVisible()

    await expect.poll(() => smtp.received.length).toBe(1)
    const token = personalLinkToken(smtp.received[0]!)
    expect(smtp.received[0]!.to).toEqual(['camille.invitee@example.test'])

    // La personne invitée n'a pas de compte : navigateur vierge
    const guest = await (await browser.newContext()).newPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await expect(guest.getByRole('heading', { name: 'Jeu des inscriptions' })).toBeVisible()
    await expect(guest.getByText('Jouer ensemble, avec bienveillance.')).toBeVisible()
    await expect(guest.getByLabel('Prénom')).toHaveValue('Camille')

    await guest.getByLabel('Nom', { exact: true }).fill('Invitée')
    await guest.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    await guest.getByLabel('Contact d’urgence : nom').fill('Dominique')
    await guest.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
    await guest.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await guest.getByRole('button', { name: 'Accepter l’invitation' }).click()
    await expect(guest.getByText('Votre inscription est confirmée.')).toBeVisible()

    // L'organisatrice la retrouve dans la session et dans la liste des inscriptions
    const session = await prisma.session.findUniqueOrThrow({ where: { slug: 'session-printemps' } })
    const participants = await (await page.request.get(`/api/sessions/${session.id}`)).json()
    expect(JSON.stringify(participants)).toContain('Camille Invitée')
    await page.goto('/registrations')
    await expect(page.getByText('Confirmée', { exact: true })).toBeVisible()

    // Elle entre dans le circuit de paiement sans attendre le casting (US-007, R22)
    await page.goto('/sessions/session-printemps?tab=payments')
    await expect(page.getByText('Camille Invitée').first()).toBeVisible()
    await expect(page.getByText('Personnage à attribuer')).toBeVisible()
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})

// EPIC-019 : questions propres au jeu et affinités, remplies par le lien personnel
test('la personne invitée répond aux questions du jeu et à ses affinités', async ({ browser }) => {
  const prisma = createTestPrisma()
  try {
    const key = `questions-e2e-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const definition = {
      standardFields: {
        lastName: { asked: false, required: false },
        firstName: { asked: true, required: false },
        facebookName: { asked: false, required: false },
        phone: { asked: false, required: false },
        emergencyContact: { asked: false, required: false },
        dietary: { asked: false, required: false }
      },
      affinities: { wantWith: { asked: true, required: true } },
      questions: [{ id: 'style', label: 'Ton style de jeu', type: 'single', required: true, options: ['Combat', 'Intrigue'] }]
    }
    const game = await prisma.game.create({
      data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id, noteIntention: 'Note', registrationForm: { create: { versions: { create: { number: 1, definition } } } } }
    })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-05-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { name: 'Période', gameId: game.id, publicId: `pub-${key}`, state: 'open', sessions: { create: { sessionId: session.id, seats: 3 } } } })
    const participant = await prisma.participant.create({ data: { name: 'Lou Test', slug: `lou-${key}`, email: `lou-${key}@example.test`, gameLinks: { create: { gameId: game.id } } } })
    const token = randomBytes(32).toString('base64url')
    const registration = await prisma.registration.create({
      data: {
        periodId: period.id, sessionId: session.id, participantId: participant.id, status: 'invited', source: 'invitation',
        email: participant.email!, tokenHash: createHash('sha256').update(token).digest('hex'), responseDueAt: new Date(Date.now() + 7 * 86_400_000)
      }
    })

    const guest = await (await browser.newContext()).newPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await guest.getByLabel('Avec qui je veux jouer').fill('Léa\nNoé')
    await guest.getByLabel('Intrigue').check()
    await guest.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await guest.getByRole('button', { name: 'Accepter l’invitation' }).click()
    await expect(guest.getByText('Votre inscription est confirmée.')).toBeVisible()

    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, select: { questionAnswers: true, affinities: { select: { text: true }, orderBy: { position: 'asc' } } } })
    expect(saved.questionAnswers).toEqual({ style: 'Intrigue' })
    expect(saved.affinities.map((affinity) => affinity.text)).toEqual(['Léa', 'Noé'])
  } finally {
    await prisma.$disconnect()
  }
})
