// US-003 : inviter des participants (SPEC-001, R12, R13, R16, R20)
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { personalLinkToken, startTestSmtp } from './smtp'

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

// Un jeu d'Alice, une session dans une période ouverte, et un participant du jeu avec email
async function openPeriod(options: { state?: string, seats?: number } = {}) {
  const key = `invitations-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2027-03-10T09:00:00Z') } })
  const period = await prisma.registrationPeriod.create({
    data: {
      name: `Période ${key}`,
      gameId: game.id,
      publicId: `pub-${key}`,
      state: options.state ?? 'open',
      responseDelayDays: 10,
      sessions: { create: { sessionId: session.id, seats: options.seats ?? 5 } }
    }
  })
  const participant = await prisma.participant.create({
    data: { name: `Joueuse ${key}`, slug: `joueuse-${key}`, email: `joueuse-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
  })
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
      expect(registration).toMatchObject({ status: 'invited', source: 'invitation', sessionId: session.id, invitedById: alice.id })
      expect(registration.invitationSentAt).not.toBeNull()
      // Échéance : aujourd'hui + délai de la période (10 jours)
      const delay = registration.responseDueAt!.getTime() - before
      expect(delay).toBeGreaterThan(10 * 86_400_000 - 60_000)
      expect(delay).toBeLessThan(10 * 86_400_000 + 60_000)
    }

    // La nouvelle personne est créée et liée au jeu, son email en minuscules
    const created = registrations.find((registration) => registration.participantId !== participant.id)!
    expect(created.participant).toMatchObject({ name: 'Nouvelle Venue', email: 'nouvelle.venue@example.test' })
    expect(await prisma.participantGame.count({ where: { participantId: created.participantId, gameId: game.id } })).toBe(1)

    // Chaque email porte le jeu, la session, l'échéance et un lien dont seul le hash est en base
    const email = emailsTo(participant.email!)[0]!
    expect(email.text).toContain(game.title)
    expect(email.text).toContain(session.name)
    expect(email.text).toContain('10 mars 2027')
    const token = personalLinkToken(email)!
    expect(email.text).toContain(`/inscription/${token}`)
    const own = registrations.find((registration) => registration.participantId === participant.id)!
    expect(own.tokenHash).toBe(sha256(token))
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

  it('ne rapproche pas un participant d’une autre équipe : une fiche distincte est créée', async () => {
    const { session, period } = await openPeriod()

    const response = await invite(period.id, {
      sessionId: session.id,
      newParticipant: { name: 'Homonyme', email: world.b.participant.email }
    })

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })
    expect(registration.participantId).not.toBe(world.b.participant.id)
    expect(await prisma.participantGame.count({ where: { participantId: world.b.participant.id } })).toBe(1)
  })

  it('refuse une seconde inscription de la même personne dans la période', async () => {
    const { session, period, participant } = await openPeriod()
    expect((await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })).status).toBe(200)

    const again = await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    expect(again.status).toBe(409)
    expect((again.body as any).message).toContain(participant.name)

    // Par l'email aussi
    const byEmail = await invite(period.id, { sessionId: session.id, newParticipant: { name: 'X', email: participant.email } })
    expect(byEmail.status).toBe(409)
    expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(1)
  })

  it('refuse une personne sans email', async () => {
    const { game, session, period } = await openPeriod()
    const withoutEmail = await prisma.participant.create({
      data: { name: 'Sans Email', slug: `sans-email-${counter}`, gameLinks: { create: { gameId: game.id } } }
    })

    const response = await invite(period.id, { sessionId: session.id, participantIds: [withoutEmail.id] })
    expect(response.status).toBe(400)
    expect((response.body as any).message).toContain('Sans Email')
  })

  it('refuse d’inviter dans une période qui n’est pas ouverte', async () => {
    const draft = await openPeriod({ state: 'draft' })
    expect((await invite(draft.period.id, { sessionId: draft.session.id, participantIds: [draft.participant.id] })).status).toBe(409)

    const closed = await openPeriod({ state: 'closed' })
    expect((await invite(closed.period.id, { sessionId: closed.session.id, participantIds: [closed.participant.id] })).status).toBe(409)
  })

  it('refuse une session hors de la période, ou un participant d’un autre jeu', async () => {
    const { game, session, period, participant } = await openPeriod()
    const outside = await prisma.session.create({ data: { name: 'Hors période', slug: `hors-periode-${counter}`, gameId: game.id } })
    const stranger = await openPeriod()

    expect((await invite(period.id, { sessionId: outside.id, participantIds: [participant.id] })).status).toBe(400)
    expect((await invite(period.id, { sessionId: session.id, participantIds: [stranger.participant.id] })).status).toBe(400)
    expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(0)
  })

  it('dépasser les places est permis', async () => {
    const { game, session, period, participant } = await openPeriod({ seats: 1 })
    const second = await prisma.participant.create({
      data: { name: 'Seconde', slug: `seconde-${counter}`, email: `seconde-${counter}@example.test`, gameLinks: { create: { gameId: game.id } } }
    })

    const response = await invite(period.id, { sessionId: session.id, participantIds: [participant.id, second.id] })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ invitedCount: 2 })
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

  it('liste les inscriptions de la période, sans le hash du jeton', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })

    const response = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject([{ sessionId: session.id, status: 'invited', participant: { id: participant.id } }])
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
    expect(updated.tokenHash).toBe(sha256(newToken))
    expect(await prisma.registration.count({ where: { tokenHash: sha256(oldToken) } })).toBe(0)
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

  it('une invitation qui a reçu une réponse ne se renvoie ni ne s’annule', async () => {
    const { session, period, participant } = await openPeriod()
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })
    const registration = await prisma.registration.update({
      where: { periodId_participantId: { periodId: period.id, participantId: participant.id } },
      data: { status: 'confirmed', respondedAt: new Date() }
    })

    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/resend`)).status).toBe(409)
    expect((await api(alice, 'DELETE', `/api/registrations/${registration.id}`)).status).toBe(409)
    expect(await prisma.registration.count({ where: { id: registration.id } })).toBe(1)
  })
})

describe('période qui a des inscriptions', () => {
  it('ne se supprime pas, et ne perd pas une session qui a des inscriptions', async () => {
    const { game, session, period, participant } = await openPeriod()
    const other = await prisma.session.create({ data: { name: 'Autre', slug: `autre-${counter}`, gameId: game.id } })
    await invite(period.id, { sessionId: session.id, participantIds: [participant.id] })

    expect((await api(alice, 'DELETE', `/api/registration-periods/${period.id}`)).status).toBe(409)

    const body = { name: period.name, gameId: game.id, state: 'open', sessions: [{ sessionId: other.id, seats: 3 }] }
    const removed = await api(alice, 'PUT', `/api/registration-periods/${period.id}`, body)
    expect(removed.status).toBe(409)
    expect((removed.body as any).message).toContain(session.name)

    // Ajouter une session en gardant la première reste possible
    const added = await api(alice, 'PUT', `/api/registration-periods/${period.id}`, { ...body, sessions: [{ sessionId: session.id, seats: 5 }, { sessionId: other.id, seats: 3 }] })
    expect(added.status, JSON.stringify(added.body)).toBe(200)
  })
})
