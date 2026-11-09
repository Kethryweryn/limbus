// US-005 : suivre et gérer les inscriptions (SPEC-001, R16, R20, R21, ADR-0020, ADR-0021)
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, tokenFor } from './api'
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
const DAY_MS = 24 * 60 * 60 * 1000

type PeriodRegistrations = ApiResponse<'/api/registration-periods/:id/registrations'>

async function publicGet(token: string) {
  const response = await fetch(`${inject('baseUrl')}/api/public/registrations/${token}`, { headers: { 'x-forwarded-for': `10.5.0.${counter}` } })
  return { status: response.status, body: await response.json() as unknown }
}

// Une période ouverte d'Alice et une invitation envoyée par l'API, dont le test connaît le lien
async function invited() {
  const key = `suivi-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2027-03-10T09:00:00Z') } })
  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: game.id,
      publicId: `pub-${key}`,
      state: 'open',
      responseDelayDays: 10,
      sessions: { create: { sessionId: session.id } }
    }
  })
  const participant = await prisma.participant.create({
    data: { name: `Joueuse ${key}`, slug: `joueuse-${key}`, email: `joueuse-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
  })
  const response = await api(alice, 'POST', `/api/registration-periods/${period.id}/invitations`, { sessionId: session.id, participantIds: [participant.id] })
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })
  const token = personalLinkToken(smtp.received.filter((email) => email.to.includes(participant.email!)).at(-1)!)!
  return { key, game, session, period, participant, registration, token }
}

async function confirm(registrationId: string, session: { id: string, gameId: string }, participantId: string) {
  const sessionId = session.id
  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: 'received', respondedAt: new Date(), charterAcceptedAt: new Date(), phone: '0612345678', dietary: 'Arachides', healthConsentAt: new Date(), invitedSessionId: null }
  })
  await prisma.registrationSession.create({ data: { gameId: session.gameId, registrationId, sessionId, status: 'confirmed', confirmedAt: new Date(), answer: 'available' } })
  await prisma.sessionParticipant.create({ data: { sessionId, participantId, role: 'participant' } })
}

describe('relancer une invitation sans réponse', () => {
  it('envoie un rappel sans lien ; le lien de l’invitation reste valable, et la date de relance est notée', async () => {
    const { game, participant, registration, token } = await invited()

    const response = await api(alice, 'POST', `/api/registrations/${registration.id}/remind`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)

    const reminder = smtp.received.filter((email) => email.to.includes(participant.email!)).at(-1)!
    expect(reminder.text).toContain('Nous n’avons pas encore reçu votre réponse')
    expect(reminder.text).toContain(`intitulé « Invitation : ${game.title} »`)
    expect(personalLinkToken(reminder)).toBeFalsy()
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(await prisma.registrationLink.findMany({ where: { registrationId: registration.id }, select: { tokenHash: true } })).toEqual([{ tokenHash: sha256(token) }])
    expect(saved.lastRemindedAt).not.toBeNull()
    expect(saved.invitationSentAt).toEqual(registration.invitationSentAt)
    expect(saved.responseDueAt).toEqual(registration.responseDueAt)
    expect((await publicGet(token)).body).toMatchObject({ status: 'invited', canAccept: true })
  })

  it('« Nouveau lien » invalide l’ancien, pour une personne qui a perdu son email', async () => {
    const { participant, registration, token } = await invited()
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/resend`)).status).toBe(200)
    const newToken = personalLinkToken(smtp.received.filter((email) => email.to.includes(participant.email!)).at(-1)!)!
    expect(newToken).not.toBe(token)
    expect((await publicGet(token)).status).toBe(404)
  })

  it('refuse une invitation dont l’email n’est jamais parti, ou qui a répondu', async () => {
    const { session, participant, registration } = await invited()
    await prisma.registration.update({ where: { id: registration.id }, data: { invitationSentAt: null } })
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/remind`)).status).toBe(409)
    await confirm(registration.id, session, participant.id)
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/remind`)).status).toBe(409)
  })
})

describe('prolonger l’échéance', () => {
  it('fixe l’échéance à la date choisie ; une invitation en retard ne l’est plus', async () => {
    const { period, registration } = await invited()
    await prisma.registration.update({ where: { id: registration.id }, data: { responseDueAt: new Date(Date.now() - 2 * DAY_MS) } })
    const responseDueAt = new Date(Date.now() + 5 * DAY_MS)
    const response = await api(alice, 'POST', `/api/registrations/${registration.id}/extend`, { responseDueAt: responseDueAt.toISOString() })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).responseDueAt).toEqual(responseDueAt)
    const list = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(new Date(bodyOf<PeriodRegistrations>(list)[0]?.responseDueAt ?? 0).getTime()).toBeGreaterThan(Date.now())
  })

  it('refuse une date passée, invalide ou absente, avec un message en français', async () => {
    const { registration } = await invited()
    const past = await api(alice, 'POST', `/api/registrations/${registration.id}/extend`, { responseDueAt: new Date(Date.now() - DAY_MS).toISOString() })
    expect(past.status).toBe(400)
    expect(JSON.stringify(past.body)).toContain('dans le futur')
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/extend`, { responseDueAt: 'demain' })).status).toBe(400)
    expect(JSON.stringify((await api(alice, 'POST', `/api/registrations/${registration.id}/extend`, {})).body)).toContain('La nouvelle échéance est obligatoire')
  })
})

describe('libérer une place', () => {
  it('une invitation libérée sort, avec l’organisatrice comme autrice ; le lien le dit', async () => {
    const { registration, token } = await invited()
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/release`)).status).toBe(200)

    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(saved).toMatchObject({ status: 'withdrawn', withdrawnById: alice.id, respondedAt: null })
    const link = await publicGet(token)
    expect(link.body).toMatchObject({ status: 'withdrawn', withdrawalReason: 'released' })
    expect(link.body).not.toHaveProperty('canAccept')
  })

  it('une place libérée peut être réattribuée à la même personne par une réinvitation', async () => {
    const { session, period, participant, registration } = await invited()
    await api(alice, 'POST', `/api/registrations/${registration.id}/release`)
    const response = await api(alice, 'POST', `/api/registration-periods/${period.id}/invitations`, { sessionId: session.id, participantIds: [participant.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: 'invited', withdrawnById: null })
  })

  it('refuse une personne qui a répondu : c’est un retrait', async () => {
    const { session, participant, registration } = await invited()
    await confirm(registration.id, session, participant.id)
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/release`)).status).toBe(409)
  })
})

describe('retirer une personne inscrite', () => {
  it('d’une session : mêmes effets qu’une annulation, avec l’organisatrice comme autrice ; elle reste dans le vivier', async () => {
    const { session, participant, registration } = await invited()
    await confirm(registration.id, session, participant.id)
    const sentBefore = smtp.received.length

    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/withdraw`, { sessionId: session.id })).status).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: 'received' })
    expect(await prisma.registrationSession.findUniqueOrThrow({ where: { registrationId_sessionId: { registrationId: registration.id, sessionId: session.id } } })).toMatchObject({ status: 'cancelled', cancelledById: alice.id })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)
    await expect.poll(() => smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))?.text, { timeout: 10_000 })
      .toContain(`a retiré ${participant.name}`)
  })

  it('du vivier : ses présences à venir sont annulées, et son lien ne marche plus', async () => {
    const { session, participant, registration } = await invited()
    await confirm(registration.id, session, participant.id)
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/withdraw`)).status).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: 'withdrawn', withdrawnById: alice.id })
    expect(await prisma.registrationLink.count({ where: { registrationId: registration.id } })).toBe(0)
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/withdraw`)).status).toBe(409)
  })
})

describe('suivi dans la liste', () => {
  it('signale une personne confirmée retirée à la main de la session (ADR-0021)', async () => {
    const { session, period, participant, registration } = await invited()
    await confirm(registration.id, session, participant.id)

    const before = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(before.body).toMatchObject([{ id: registration.id, sessionLines: [{ sessionId: session.id, missingFromSession: false }] }])

    await prisma.sessionParticipant.deleteMany({ where: { sessionId: session.id, participantId: participant.id } })
    const after = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(after.body).toMatchObject([{ id: registration.id, sessionLines: [{ sessionId: session.id, missingFromSession: true }] }])
    const all = await api(alice, 'GET', `/api/registration-periods?gameId=${period.gameId}`)
    expect(bodyOf<ApiResponse<'/api/registration-periods'>>(all)[0]?.registrations).toMatchObject([{ id: registration.id, sessionLines: [{ missingFromSession: true }] }])
  })

  it('le détail montre les réponses, les allergies et la date du consentement ; la liste non', async () => {
    const { session, period, participant, registration } = await invited()
    await confirm(registration.id, session, participant.id)

    const detail = await api(alice, 'GET', `/api/registrations/${registration.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ id: registration.id, phone: '0612345678', dietary: 'Arachides', sessionLines: [{ sessionId: session.id, status: 'confirmed' }] })
    expect(bodyOf<ApiResponse<'/api/registrations/:id'>>(detail).healthConsentAt).toBeTruthy()
    expect(detail.body).not.toHaveProperty('tokenHash')

    const list = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(bodyOf<PeriodRegistrations>(list)[0]).not.toHaveProperty('dietary')
  })
})

describe('export CSV d’une session', () => {
  it('nom, email, téléphone, statut ; jamais d’allergies ni de contact d’urgence', async () => {
    const { session, participant, registration } = await invited()
    await confirm(registration.id, session, participant.id)
    await prisma.registration.update({ where: { id: registration.id }, data: { emergencyContactName: 'Maman Urgence', emergencyContactPhone: '0699999999' } })

    const response = await fetch(`${inject('baseUrl')}/api/sessions/${session.id}/registrations/export`, {
      headers: { cookie: `__Host-limbus_token=${tokenFor(alice)}` }
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('attachment; filename="inscriptions-session-')
    const csv = await response.text()
    expect(csv).toContain('Nom;Email;Téléphone;Statut')
    expect(csv).toContain(`${participant.name};${registration.email};0612345678;Inscrite`)
    expect(csv).not.toContain('Arachides')
    expect(csv).not.toContain('Urgence')
    expect(csv).not.toContain('0699999999')
  })
})
