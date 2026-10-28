// US-005 : suivre et gérer les inscriptions (SPEC-001, R16, R20, R21, ADR-0020, ADR-0021)
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api, tokenFor } from './api'
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

async function publicGet(token: string) {
  const response = await fetch(`${inject('baseUrl')}/api/public/registrations/${token}`, { headers: { 'x-forwarded-for': `10.5.0.${counter}` } })
  return { status: response.status, body: await response.json() as any }
}

// Une période ouverte d'Alice et une invitation envoyée par l'API, dont le test connaît le lien
async function invited() {
  const key = `suivi-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2027-03-10T09:00:00Z') } })
  const period = await prisma.registrationPeriod.create({
    data: {
      name: `Période ${key}`,
      gameId: game.id,
      publicId: `pub-${key}`,
      state: 'open',
      responseDelayDays: 10,
      sessions: { create: { sessionId: session.id, seats: 5 } }
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

async function confirm(registrationId: string, sessionId: string, participantId: string) {
  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: 'confirmed', respondedAt: new Date(), confirmedAt: new Date(), phone: '0612345678', dietary: 'Arachides', healthConsentAt: new Date() }
  })
  await prisma.sessionParticipant.create({ data: { sessionId, participantId, role: 'participant' } })
}

describe('relancer une invitation sans réponse', () => {
  it('envoie un rappel avec un nouveau lien, invalide l’ancien et note la date de relance', async () => {
    const { participant, registration, token } = await invited()

    const response = await api(alice, 'POST', `/api/registrations/${registration.id}/remind`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)

    const reminder = smtp.received.filter((email) => email.to.includes(participant.email!)).at(-1)!
    expect(reminder.text).toContain('Nous n’avons pas encore reçu votre réponse')
    const newToken = personalLinkToken(reminder)!
    expect(newToken).not.toBe(token)
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(saved.tokenHash).toBe(sha256(newToken))
    expect(saved.lastRemindedAt).not.toBeNull()
    // La date d'invitation reste celle du premier envoi
    expect(saved.invitationSentAt).toEqual(registration.invitationSentAt)
    expect(saved.responseDueAt).toEqual(registration.responseDueAt)
    expect((await publicGet(token)).status).toBe(404)
  })

  it('refuse une inscription qui a répondu', async () => {
    const { session, participant, registration } = await invited()
    await confirm(registration.id, session.id, participant.id)
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/remind`)).status).toBe(409)
  })
})

describe('prolonger l’échéance', () => {
  it('ajoute des jours à l’échéance à venir', async () => {
    const { registration } = await invited()
    const response = await api(alice, 'POST', `/api/registrations/${registration.id}/extend`, { days: 3 })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(saved.responseDueAt!.getTime()).toBe(registration.responseDueAt!.getTime() + 3 * DAY_MS)
  })

  it('une échéance passée repart d’aujourd’hui : la personne n’est plus en retard', async () => {
    const { period, registration } = await invited()
    await prisma.registration.update({ where: { id: registration.id }, data: { responseDueAt: new Date(Date.now() - 2 * DAY_MS) } })
    const before = Date.now()
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/extend`, { days: 2 })).status).toBe(200)
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(saved.responseDueAt!.getTime()).toBeGreaterThanOrEqual(before + 2 * DAY_MS)
    const list = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(new Date((list.body as any)[0].responseDueAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('refuse un nombre de jours invalide, avec un message en français', async () => {
    const { registration } = await invited()
    const response = await api(alice, 'POST', `/api/registrations/${registration.id}/extend`, { days: 0 })
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.body)).toContain('Prolongez d’au moins un jour')
  })
})

describe('libérer une place', () => {
  it('passe l’inscription à désistée, avec l’organisatrice comme autrice ; le lien dit que la place est réattribuée', async () => {
    const { registration, token } = await invited()
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/release`)).status).toBe(200)

    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(saved).toMatchObject({ status: 'withdrawn', withdrawnById: alice.id, respondedAt: null })
    const link = await publicGet(token)
    expect(link.body).toMatchObject({ status: 'withdrawn', withdrawalReason: 'released' })
    expect(link.body.canAccept).toBeUndefined()
  })

  it('une place libérée peut être réattribuée à la même personne par une réinvitation', async () => {
    const { session, period, participant, registration } = await invited()
    await api(alice, 'POST', `/api/registrations/${registration.id}/release`)
    const response = await api(alice, 'POST', `/api/registration-periods/${period.id}/invitations`, { sessionId: session.id, participantIds: [participant.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: 'invited', withdrawnById: null })
  })

  it('refuse une inscription confirmée : c’est un retrait', async () => {
    const { session, participant, registration } = await invited()
    await confirm(registration.id, session.id, participant.id)
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/release`)).status).toBe(409)
  })
})

describe('retirer une personne confirmée', () => {
  it('mêmes effets qu’un désistement, avec l’organisatrice comme autrice', async () => {
    const { session, participant, registration } = await invited()
    await confirm(registration.id, session.id, participant.id)
    const sentBefore = smtp.received.length

    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/withdraw`)).status).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: 'withdrawn', withdrawnById: alice.id })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)
    await expect.poll(() => smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))?.text, { timeout: 10_000 })
      .toContain(`a retiré ${participant.name}`)
  })

  it('refuse une invitation sans réponse : c’est une libération de place', async () => {
    const { registration } = await invited()
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/withdraw`)).status).toBe(409)
  })
})

describe('suivi dans la liste', () => {
  it('signale une personne confirmée retirée à la main de la session (ADR-0021)', async () => {
    const { session, period, participant, registration } = await invited()
    await confirm(registration.id, session.id, participant.id)

    const before = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(before.body).toMatchObject([{ id: registration.id, missingFromSession: false }])

    await prisma.sessionParticipant.deleteMany({ where: { sessionId: session.id, participantId: participant.id } })
    const after = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(after.body).toMatchObject([{ id: registration.id, missingFromSession: true }])
    const all = await api(alice, 'GET', `/api/registration-periods?gameId=${period.gameId}&include=registrations`)
    expect((all.body as any)[0].registrations).toMatchObject([{ id: registration.id, missingFromSession: true }])
  })

  it('le détail montre les réponses, les allergies et la date du consentement ; la liste non', async () => {
    const { session, period, participant, registration } = await invited()
    await confirm(registration.id, session.id, participant.id)

    const detail = await api(alice, 'GET', `/api/registrations/${registration.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ id: registration.id, phone: '0612345678', dietary: 'Arachides', session: { id: session.id } })
    expect((detail.body as any).healthConsentAt).toBeTruthy()
    expect((detail.body as any).tokenHash).toBeUndefined()

    const list = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect((list.body as any)[0].dietary).toBeUndefined()
  })
})

describe('export CSV d’une session', () => {
  it('nom, email, téléphone, statut ; jamais d’allergies ni de contact d’urgence', async () => {
    const { session, participant, registration } = await invited()
    await confirm(registration.id, session.id, participant.id)
    await prisma.registration.update({ where: { id: registration.id }, data: { emergencyContactName: 'Maman Urgence', emergencyContactPhone: '0699999999' } })

    const response = await fetch(`${inject('baseUrl')}/api/sessions/${session.id}/registrations/export`, {
      headers: { cookie: `limbus_token=${tokenFor(alice)}` }
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('attachment; filename="inscriptions-session-')
    const csv = await response.text()
    expect(csv).toContain('Nom;Email;Téléphone;Statut')
    expect(csv).toContain(`${participant.name};${registration.email};0612345678;Confirmée`)
    expect(csv).not.toContain('Arachides')
    expect(csv).not.toContain('Urgence')
    expect(csv).not.toContain('0699999999')
  })
})
