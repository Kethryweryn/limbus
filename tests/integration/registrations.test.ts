// US-164 : inviter une personne à rejoindre le vivier, ou pour une session (SPEC-018, R4)
import { inSentence } from '~/utils/sessionLabels'
import { labelled } from '../sessionLabel'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api, errorMessage } from './api'
import { createTestPrisma } from './db'
import { personalLinkToken, startTestSmtp } from './smtp'
import type { RegistrationPeriodState } from '~/generated/prisma/enums'
import { withFicheValues } from '../fiche'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

// Un jeu d'Alice, une session, un vivier ouvert, et un participant du jeu avec email
async function openPeriod(options: { state?: RegistrationPeriodState } = {}) {
  const key = `invitations-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await labelled(prisma, await prisma.session.create({ data: { slug: `session-${key}`, gameId: game.id, date: new Date('2027-03-10T09:00:00Z') } }))
  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: game.id,
      publicId: `pub-${key}`,
      state: options.state ?? 'open',
      responseDelayDays: 10,
      sessions: { create: { sessionId: session.id } }
    }
  })
  const participant = await withFicheValues(prisma.participant.create({
    data: { slug: `joueuse-${key}`, email: `joueuse-${key}@example.test`, gameLinks: { create: { gameId: game.id , name: `Joueuse ${key}` } } }
  }), { name: `Joueuse ${key}` })
  return { key, game, session, period, participant }
}

function invite(periodId: string, body: Record<string, unknown>) {
  return api(alice, 'POST', `/api/registration-periods/${periodId}/invitations`, body)
}

function emailsTo(address: string) {
  return smtp.received.filter((email) => email.to.includes(address))
}

describe('inviter des participants', () => {
  it('invite un participant du jeu et une nouvelle personne, avec un email chacun', async () => {
    const { game, session, period, participant } = await openPeriod()
    const before = Date.now()

    const response = await invite(period.id, {
      sessionId: session.id,
      participantIds: [participant.id],
      newParticipant: { name: 'Nouvelle Venue', email: 'Nouvelle.Venue@Example.test' }
    })

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toEqual({ invitedCount: 2, sentCount: 2, failures: [] })

    const registrations = await prisma.registration.findMany({ where: { periodId: period.id }, include: { participant: true } })
    expect(registrations).toHaveLength(2)
    for (const registration of registrations) {
      expect(registration).toMatchObject({ status: 'invited', source: 'invitation', invitedSessionId: session.id, invitedById: alice.id })
      expect(registration.invitationSentAt).not.toBeNull()
      // Échéance : aujourd'hui + délai de la période (10 jours)
      const delay = registration.responseDueAt!.getTime() - before
      expect(delay).toBeGreaterThan(10 * 86_400_000 - 60_000)
      expect(delay).toBeLessThan(10 * 86_400_000 + 60_000)
    }

    // La nouvelle personne est créée et liée au jeu, son email en minuscules
    const created = registrations.find((registration) => registration.participantId !== participant.id)!
    expect(created.participant).toMatchObject({ email: 'nouvelle.venue@example.test' })
    expect(await prisma.participantGame.findMany({ where: { participantId: created.participantId, gameId: game.id }, select: { name: true } })).toEqual([{ name: 'Nouvelle Venue' }])

    // Chaque email porte le jeu, la session, l'échéance et un lien dont seul le hash est en base
    const email = emailsTo(participant.email!)[0]!
    expect(email.text).toContain(game.title)
    expect(email.text).toContain(inSentence(session.label))
    const token = personalLinkToken(email)!
    expect(email.text).toContain(`/inscription/${token}`)
    const own = registrations.find((registration) => registration.participantId === participant.id)!
    expect(await prisma.registrationLink.findMany({ where: { registrationId: own.id }, select: { tokenHash: true } })).toEqual([{ tokenHash: sha256(token) }])
    expect(JSON.stringify(registrations)).not.toContain(token)
    expect(emailsTo('nouvelle.venue@example.test')).toHaveLength(1)
  })

  it('rapproche une nouvelle personne d’un participant d’un autre jeu de la même propriétaire, sans tenir compte de la casse (R12)', async () => {
    const other = await openPeriod()
    const { game, session, period } = await openPeriod()
    const participants = await prisma.participant.count()

    const response = await invite(period.id, {
      sessionId: session.id,
      newParticipant: { name: 'Autre nom', email: other.participant.email!.toUpperCase() }
    })

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await prisma.participant.count()).toBe(participants)
    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })
    expect(registration.participantId).toBe(other.participant.id)
    expect(await prisma.participantGame.count({ where: { participantId: other.participant.id, gameId: game.id } })).toBe(1)
  })

  // SPEC-022 R4 : une fiche par adresse dans tout Limbus ; le nom du jeu est celui que l'équipe saisit
  it('rapproche la fiche d’une autre équipe, avec le nom saisi par l’équipe', async () => {
    const { session, period } = await openPeriod()
    const bobGame = await prisma.game.create({ data: { title: `Bob ${period.id}`, slug: `bob-${period.id}`.toLowerCase(), description: '', ownerId: world.users.bob.id } })
    const bobs = await withFicheValues(prisma.participant.create({ data: { slug: `nom-chez-bob-${period.id}`.toLowerCase(), email: `homonyme-${period.id}@example.test`.toLowerCase(), gameLinks: { create: { gameId: bobGame.id, name: 'Nom chez Bob' } } } }), { name: 'Nom chez Bob' })

    const response = await invite(period.id, {
      sessionId: session.id,
      newParticipant: { name: 'Homonyme', email: bobs.email! }
    })

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })
    expect(registration.participantId).toBe(bobs.id)
    const links = await prisma.participantGame.findMany({ where: { participantId: bobs.id }, select: { gameId: true, name: true } })
    expect(links).toEqual(expect.arrayContaining([{ gameId: bobGame.id, name: 'Nom chez Bob' }, { gameId: period.gameId, name: 'Homonyme' }]))
  })

  it('refuse une personne déjà dans le vivier ou déjà invitée', async () => {
    const { session, period, participant } = await openPeriod()
    expect((await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })).status).toBe(200)

    const again = await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    expect(again.status).toBe(409)
    expect(errorMessage(again)).toContain(participant.name)

    // Par l'email aussi
    const byEmail = await invite(period.id, { sessionId: session.id, newParticipant: { name: 'X', email: participant.email } })
    expect(byEmail.status).toBe(409)
    expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(1)
  })

  it('refuse une personne sans email', async () => {
    const { game, session, period } = await openPeriod()
    const withoutEmail = await withFicheValues(prisma.participant.create({
      data: { slug: `sans-email-${counter}`, gameLinks: { create: { gameId: game.id , name: 'Sans Email' } } }
    }), { name: 'Sans Email' })

    const response = await invite(period.id, { sessionId: session.id, participantIds: [withoutEmail.id] })
    expect(response.status).toBe(400)
    expect(errorMessage(response)).toContain('Sans Email')
  })

  it('refuse d’inviter dans un vivier qui n’est pas ouvert', async () => {
    const draft = await openPeriod({ state: 'draft' })
    expect((await invite(draft.period.id, { sessionId: draft.session.id, participantIds: [draft.participant.id] })).status).toBe(409)

    const closed = await openPeriod({ state: 'closed' })
    expect((await invite(closed.period.id, { sessionId: closed.session.id, participantIds: [closed.participant.id] })).status).toBe(409)
  })

  it('refuse une session d’un autre jeu ou annulée, ou un participant d’un autre jeu', async () => {
    const { game, session, period, participant } = await openPeriod()
    const cancelled = await labelled(prisma, await prisma.session.create({ data: { slug: `annulee-${counter}`, gameId: game.id, status: 'cancelled' } }))
    const stranger = await openPeriod()

    expect((await invite(period.id, { sessionId: stranger.session.id, participantIds: [participant.id] })).status).toBe(400)
    expect((await invite(period.id, { sessionId: cancelled.id, participantIds: [participant.id] })).status).toBe(400)
    expect((await invite(period.id, { sessionId: session.id, participantIds: [stranger.participant.id] })).status).toBe(400)
    expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(0)
  })

  it('sans session, elle invite au vivier seulement', async () => {
    const { period, participant, session } = await openPeriod()
    const response = await invite(period.id, { participantIds: [participant.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })).toMatchObject({ status: 'invited', invitedSessionId: null })
    expect(emailsTo(participant.email!)[0]!.text).not.toContain(session.label)
  })

  it('une invitée sans réponse n’est pas réservée : aucune ligne pour la session', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    expect(await prisma.registrationSession.count({ where: { sessionId: session.id } })).toBe(0)
  })

  it('un échec d’envoi est signalé sans annuler les invitations', async () => {
    const { session, period, participant } = await openPeriod()
    await smtp.disable()
    try {
      const response = await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ invitedCount: 1, sentCount: 0, failures: [{ participantName: participant.name, message: 'SMTP désactivé' }] })
    } finally {
      await smtp.enable()
    }
    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })
    expect(registration.invitationSentAt).toBeNull()
  })

  it('liste les personnes du vivier, sans le hash du jeton', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })

    const response = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject([{ invitedSessionId: session.id, status: 'invited', participant: { id: participant.id } }])
    expect(JSON.stringify(response.body)).not.toContain('tokenHash')
  })
})

describe('renvoyer et annuler une invitation', () => {
  it('renvoyer envoie un nouveau lien et invalide l’ancien', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    const first = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })
    const oldToken = personalLinkToken(emailsTo(participant.email!)[0]!)!

    const response = await api(alice, 'POST', `/api/registrations/${first.id}/resend`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)

    const emails = emailsTo(participant.email!)
    expect(emails).toHaveLength(2)
    const newToken = personalLinkToken(emails[1]!)!
    expect(newToken).not.toBe(oldToken)
    const updated = await prisma.registration.findUniqueOrThrow({ where: { id: first.id } })
    expect(await prisma.registrationLink.findMany({ where: { registrationId: first.id }, select: { tokenHash: true } })).toEqual([{ tokenHash: sha256(newToken) }])
    expect(await prisma.registrationLink.count({ where: { tokenHash: sha256(oldToken) } })).toBe(0)
    // L'échéance ne bouge pas : la prolonger est une autre action (US-005)
    expect(updated.responseDueAt).toEqual(first.responseDueAt)
  })

  it('annuler supprime l’inscription sans réponse', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })

    expect((await api(alice, 'DELETE', `/api/registrations/${registration.id}`)).status).toBe(200)
    expect(await prisma.registration.count({ where: { id: registration.id } })).toBe(0)
  })

  it('une invitation qui a reçu une réponse ne s’annule pas', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    const registration = await prisma.registration.update({
      where: { periodId_participantId: { periodId: period.id, participantId: participant.id } },
      data: { status: 'received', respondedAt: new Date() }
    })

    expect((await api(alice, 'DELETE', `/api/registrations/${registration.id}`)).status).toBe(409)
    expect(await prisma.registration.count({ where: { id: registration.id } })).toBe(1)
  })
})

describe('règles issues de la revue de code', () => {
  it('une personne qui a décliné peut être réinvitée, avec un nouveau lien', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    const declined = await prisma.registration.update({
      where: { periodId_participantId: { periodId: period.id, participantId: participant.id } },
      data: { status: 'withdrawn', respondedAt: new Date(), withdrawnAt: new Date(), phone: '0612345678', charterAcceptedAt: new Date() }
    })

    const response = await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const reinvited = await prisma.registration.findUniqueOrThrow({ where: { id: declined.id } })
    expect(reinvited).toMatchObject({ status: 'invited', respondedAt: null, withdrawnAt: null, charterAcceptedAt: null, phone: '0612345678' })
    // Réinvitée : un seul lien, le nouveau
    expect(await prisma.registrationLink.findMany({ where: { registrationId: declined.id }, select: { tokenHash: true } })).toEqual([{ tokenHash: sha256(personalLinkToken(emailsTo(participant.email!).at(-1)!)!) }])
    expect(emailsTo(participant.email!)).toHaveLength(2)
  })

  // Deux fiches avec la même adresse : la base les refuse (SPEC-022, US-240, participantMerge.test.ts)

  it('le renvoi part à l’adresse de l’inscription', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    const registration = await prisma.registration.update({
      where: { periodId_participantId: { periodId: period.id, participantId: participant.id } },
      data: { email: `nouvelle-${counter}@example.test` }
    })
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/resend`)).status).toBe(200)
    expect(emailsTo(`nouvelle-${counter}@example.test`)).toHaveLength(1)
  })

})

describe('vivier qui a des personnes', () => {
  it('ne se supprime pas', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    expect((await api(alice, 'DELETE', `/api/registration-periods/${period.id}`)).status).toBe(409)
  })
})
