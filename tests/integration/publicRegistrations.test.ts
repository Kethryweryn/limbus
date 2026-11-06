// Répondre à une invitation, modifier ses réponses, ses disponibilités, annuler ou quitter le vivier (SPEC-018, R4, R5, R7, R14, R19, R29)
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, errorMessage, invalidPaths } from './api'
import { createTestPrisma } from './db'
import { addPerson, createPool, lineOf } from './pool'
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

// Chaque test parle depuis sa propre IP (le proxy local de confiance relaie X-Forwarded-For) :
// la limite de débit par IP ne mélange pas les tests
async function publicApi(method: string, path: string, body?: unknown, ip = `10.4.0.${counter}`) {
  const headers: Record<string, string> = { 'x-forwarded-for': ip }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${inject('baseUrl')}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  let parsed: unknown = text
  try { parsed = JSON.parse(text) } catch { /* texte brut */ }
  return { status: response.status, body: parsed, headers: response.headers }
}

// Une invitation d'Alice, avec un jeton connu du test
async function invitation(options: { periodState?: string, responseDueAt?: Date, sessionDate?: Date, seats?: number } = {}) {
  const key = `reponse-${++counter}`
  const game = await prisma.game.create({
    data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, noteIntention: `Note d’intention ${key}` }
  })
  const location = await prisma.location.create({ data: { name: 'Château', slug: `chateau-${key}`, address: '1 rue du Donjon', gameId: game.id } })
  const session = await prisma.session.create({
    data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, locationId: location.id, date: options.sessionDate ?? new Date('2099-03-10T09:00:00Z') }
  })
  await prisma.character.createMany({
    data: Array.from({ length: options.seats ?? 5 }, (_, index) => ({ name: `PJ ${index}`, slug: `pj-${index}-${key}`, gameId: game.id, type: 'pj' }))
  })
  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: game.id,
      publicId: `pub-${key}`,
      state: options.periodState ?? 'open',
      sessions: { create: { sessionId: session.id } }
    }
  })
  const participant = await prisma.participant.create({
    data: { name: `Camille ${key}`, slug: `camille-${key}`, email: `camille-${key}@example.test`, phone: '0100000000', gameLinks: { create: { gameId: game.id } } }
  })
  const token = randomBytes(32).toString('base64url')
  const registration = await prisma.registration.create({
    data: {
      periodId: period.id,
      invitedSessionId: session.id,
      participantId: participant.id,
      status: 'invited',
      source: 'invitation',
      invitedById: alice.id,
      email: participant.email!,
      links: { create: { tokenHash: sha256(token) } },
      responseDueAt: options.responseDueAt ?? new Date(Date.now() + 7 * 86_400_000)
    }
  })
  return { key, game, session, period, participant, registration, token, path: `/api/public/registrations/${token}` }
}

function answers(extra: Record<string, unknown> = {}) {
  return {
    email: 'Camille.Perso@Example.test',
    firstName: 'Camille',
    lastName: 'Martin',
    phone: '0612345678',
    emergencyContactName: 'Dominique',
    emergencyContactPhone: '0698765432',
    dietary: 'Arachides',
    healthConsent: true,
    charterAccepted: true,
    ...extra
  }
}

describe('consulter son invitation', () => {
  it('montre le jeu, la session, la note d’intention et le formulaire prérempli', async () => {
    const { key, path, game, session } = await invitation()

    const response = await publicApi('GET', path)

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({
      status: 'invited',
      game: { title: game.title, noteIntention: game.noteIntention },
      invitedSession: { name: session.name, location: { name: 'Château', address: '1 rue du Donjon' } },
      availability: { sessions: [{ id: session.id, name: session.name }] },
      sessions: [],
      poolState: 'open',
      overdue: false,
      canAccept: true,
      canDecline: true,
      canEdit: false,
      definition: { standardFields: { phone: { asked: true, required: true } } },
      answers: { email: `camille-${key}@example.test`, firstName: 'Camille', lastName: key, phone: null }
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('ne montre rien des autres personnes du vivier', async () => {
    const { path, period, session, game } = await invitation()
    const other = await prisma.participant.create({
      data: { name: 'Autre Inscrite', slug: `autre-inscrite-${counter}`, email: 'autre-inscrite@example.test', gameLinks: { create: { gameId: game.id } } }
    })
    await prisma.registration.create({
      data: { periodId: period.id, participantId: other.id, status: 'received', source: 'invitation', email: other.email!, phone: '0699999999', sessionLines: { create: { sessionId: session.id, status: 'confirmed' } } }
    })

    const response = await publicApi('GET', path)
    expect(response.status).toBe(200)
    const body = JSON.stringify(response.body)
    expect(body).not.toContain('Autre Inscrite')
    expect(body).not.toContain('autre-inscrite@example.test')
    expect(body).not.toContain('tokenHash')
  })

  it('la page du lien n’envoie pas de Referer et n’est pas mise en cache', async () => {
    const { token } = await invitation()
    const response = await fetch(`${inject('baseUrl')}/inscription/${token}`)
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('répondre à une invitation (R4)', () => {
  it('fait entrer dans le vivier, enregistre les réponses et envoie la confirmation', async () => {
    const { path, token, registration, participant, session, game } = await invitation()

    const response = await publicApi('PUT', path, answers())

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ status: 'received', canAccept: false, canEdit: true, canLeave: true, emailSent: true })

    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, include: { formVersion: true } })
    expect(saved).toMatchObject({
      status: 'received',
      invitedSessionId: null,
      email: 'camille.perso@example.test',
      lastName: 'Martin',
      phone: '0612345678',
      emergencyContactName: 'Dominique',
      dietary: 'Arachides'
    })
    expect(saved.respondedAt).not.toBeNull()
    expect(saved.charterAcceptedAt).not.toBeNull()
    expect(saved.healthConsentAt).not.toBeNull()
    // Sans formulaire enregistré, la définition par défaut devient la version 1, gardée par l'inscription
    expect(saved.formVersion?.number).toBe(1)

    // Elle n'a pas dit être disponible pour la session : ni statut, ni participation
    expect(await prisma.registrationSession.count({ where: { registrationId: registration.id } })).toBe(0)
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)
    // L'email du formulaire fait foi et remonte sur la fiche ; le reste reste sur l'inscription
    expect(await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).toMatchObject({ email: 'camille.perso@example.test', phone: '0100000000' })

    const email = smtp.to('camille.perso@example.test')[0]!
    expect(email.text).toContain(game.title)
    expect(personalLinkToken(email)).toBe(token)
    expect(email.text).not.toContain('Arachides')
  })

  it('disponible pour la session de l’invitation : elle y est inscrite', async () => {
    const { path, registration, participant, session } = await invitation()
    const response = await publicApi('PUT', path, answers({ availableSessionIds: [session.id] }))
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'confirmed', answer: 'available' })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id, role: 'participant' } })).toBe(1)
    expect(response.body).toMatchObject({ sessions: [expect.objectContaining({ sessionId: session.id, status: 'confirmed' })] })
  })

  it('session complète à sa réponse : elle reste pré-inscrite, et l’équipe reçoit un email', async () => {
    const { path, registration, participant, session, game } = await invitation({ seats: 0 })
    const sentBefore = smtp.received.length
    const response = await publicApi('PUT', path, answers({ availableSessionIds: [session.id] }))
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'preregistered' })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)
    await expect.poll(() => smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))?.text, { timeout: 10_000 })
      .toContain(`${participant.name} a répondu à votre invitation`)
    expect(smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))!.text).toContain(game.title)
  })

  it('session passée ou annulée à sa réponse : elle entre simplement dans le vivier', async () => {
    const past = await invitation({ sessionDate: new Date('2020-01-01T09:00:00Z') })
    expect((await publicApi('GET', past.path)).body).toMatchObject({ availability: null })
    const refused = await publicApi('PUT', past.path, answers({ availableSessionIds: [past.session.id] }))
    expect(refused.status).toBe(400)
    expect((await publicApi('PUT', past.path, answers())).status).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: past.registration.id } })).toMatchObject({ status: 'received', invitedSessionId: null })
    expect(await prisma.registrationSession.count({ where: { registrationId: past.registration.id } })).toBe(0)

    const cancelled = await invitation()
    await prisma.session.update({ where: { id: cancelled.session.id }, data: { status: 'cancelled' } })
    expect((await publicApi('GET', cancelled.path)).body).toMatchObject({ availability: null })
  })

  it('refuse un formulaire incomplet, sans rien enregistrer', async () => {
    const { path, registration } = await invitation()

    const response = await publicApi('PUT', path, answers({ phone: '', charterAccepted: false }))

    expect(response.status).toBe(400)
    expect(invalidPaths(response).sort()).toEqual(['charterAccepted', 'phone'])
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: 'invited', phone: null })
  })

  it('exige le consentement santé quand des allergies sont déclarées (R14)', async () => {
    const { path } = await invitation()
    const response = await publicApi('PUT', path, answers({ healthConsent: false }))
    expect(response.status).toBe(400)
    expect(invalidPaths(response)[0]).toBe('healthConsent')
  })

  it('reste possible après l’échéance, qui est signalée', async () => {
    const { path } = await invitation({ responseDueAt: new Date(Date.now() - 86_400_000) })

    expect((await publicApi('GET', path)).body).toMatchObject({ overdue: true, canAccept: true })
    expect((await publicApi('PUT', path, answers())).status).toBe(200)
  })

  it('reste possible vivier fermé, pour une personne invitée', async () => {
    const { path } = await invitation({ periodState: 'closed' })
    const response = await publicApi('PUT', path, answers())
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'received', canEdit: true })
  })
})

describe('modifier ses réponses (R14)', () => {
  it('à tout moment, même vivier fermé, sur la dernière version du formulaire (R15)', async () => {
    const { path, period, registration, game } = await invitation()
    expect((await publicApi('PUT', path, answers())).status).toBe(200)

    // L'organisatrice retire ensuite le téléphone du formulaire : il n'est plus exigé
    const standardFields = { lastName: { asked: true, required: true }, firstName: { asked: true, required: true }, facebookName: { asked: false, required: false }, phone: { asked: false, required: false }, emergencyContact: { asked: true, required: true }, dietary: { asked: true, required: false } }
    expect((await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields })).status).toBe(200)
    const changed = await publicApi('PUT', path, answers({ phone: '', dietary: '', healthConsent: false }))
    expect(changed.status, JSON.stringify(changed.body)).toBe(200)
    expect(changed.body).toMatchObject({ status: 'received', emailSent: null, keptSessions: [] })
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, include: { formVersion: true } })
    expect(saved).toMatchObject({ dietary: null, healthConsentAt: null })
    expect(saved.formVersion?.number).toBe(2)

    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { state: 'closed' } })
    expect((await publicApi('GET', path)).body).toMatchObject({ status: 'received', canEdit: true })
    expect((await publicApi('PUT', path, answers({ phone: '0622222222' }))).status).toBe(200)
  })
})

describe('réponses modifiées (US-173, R16)', () => {
  async function person(status?: string) {
    const pool = await createPool(prisma, alice.id, { key: 'modif', sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const token = randomBytes(32).toString('base64url')
    const lou = await addPerson(prisma, pool, 'Lou', [], { links: { create: { tokenHash: sha256(token) } }, firstName: 'Lou', lastName: 'Dupont', phone: '0600000000', emergencyContactName: 'Maman', emergencyContactPhone: '0600000001', charterAcceptedAt: new Date() })
    if (status) await prisma.registrationSession.create({ data: { registrationId: lou.id, sessionId: session.id, status, answer: 'available', announcedStatus: 'retained' } })
    counter++
    return { pool, session, lou, path: `/api/public/registrations/${token}` }
  }
  const emailsAboutChange = () => smtp.received.filter((email) => email.text.includes('a modifié ses réponses'))

  it('castée : le repère apparaît et l’équipe est prévenue, sans recopier les réponses ; marqué comme lu, il disparaît', async () => {
    const { session, lou, path } = await person('retained')
    const before = emailsAboutChange().length
    expect((await publicApi('PUT', path, answers({ phone: '0699999999' }))).status).toBe(200)
    await expect.poll(() => emailsAboutChange().length).toBeGreaterThan(before)
    const email = emailsAboutChange().at(-1)!
    expect(email.text).toContain(session.name)
    expect(email.text).not.toContain('0699999999')
    expect((await lineOf(prisma, lou.id, session.id))?.answersChangedAt).not.toBeNull()

    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/answers-read`, { sessionId: session.id })).status).toBe(200)
    expect((await lineOf(prisma, lou.id, session.id))?.answersChangedAt).toBeNull()
  })

  it('inscrite aussi ; un enregistrement sans changement ne déclenche rien', async () => {
    const { session, lou, path } = await person('confirmed')
    expect((await publicApi('PUT', path, answers())).status).toBe(200)
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lou.id, sessionId: session.id } }, data: { answersChangedAt: null } })
    expect((await publicApi('PUT', path, answers())).status).toBe(200)
    expect((await lineOf(prisma, lou.id, session.id))?.answersChangedAt).toBeNull()
    expect((await publicApi('PUT', path, answers({ phone: '0688888888' }))).status).toBe(200)
    expect((await lineOf(prisma, lou.id, session.id))?.answersChangedAt).not.toBeNull()
  })

  it('changer seulement ses disponibilités ne déclenche rien, et une nouvelle retenue efface un vieux repère', async () => {
    const { pool, session, lou, path } = await person('confirmed')
    expect((await publicApi('PUT', path, answers())).status).toBe(200)
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lou.id, sessionId: session.id } }, data: { answersChangedAt: null } })
    const other = await prisma.session.create({ data: { name: `Autre ${pool.key}`, slug: `autre-${pool.key}`, gameId: pool.game.id, date: new Date(Date.now() + 40 * 86_400_000) } })
    await prisma.registrationPeriodSession.create({ data: { periodId: pool.period.id, sessionId: other.id, open: true } })
    expect((await publicApi('PUT', path, answers({ availableSessionIds: [other.id] }))).status).toBe(200)
    expect((await lineOf(prisma, lou.id, session.id))?.answersChangedAt).toBeNull()

    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lou.id, sessionId: other.id } }, data: { answersChangedAt: new Date() } })
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/selection`, { action: 'retain', sessionId: other.id })).status).toBe(200)
    expect((await lineOf(prisma, lou.id, other.id))?.answersChangedAt).toBeNull()
  })

  it('une réponse à une question retirée du questionnaire n’est pas un changement (R15)', async () => {
    const { session, lou, path } = await person('confirmed')
    expect((await publicApi('PUT', path, answers())).status).toBe(200)
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lou.id, sessionId: session.id } }, data: { answersChangedAt: null } })
    await prisma.registration.update({ where: { id: lou.id }, data: { questionAnswers: { 'question-retiree': 'Ancienne réponse' } } })
    expect((await publicApi('PUT', path, answers())).status).toBe(200)
    expect((await lineOf(prisma, lou.id, session.id))?.answersChangedAt).toBeNull()
  })

  it('pré-inscrite, en attente ou simplement intéressée : rien ne se déclenche ; une session passée non plus', async () => {
    for (const status of ['preregistered', 'waitlisted']) {
      const { session, lou, path } = await person(status)
      expect((await publicApi('PUT', path, answers({ phone: '0677777777' }))).status).toBe(200)
      expect((await lineOf(prisma, lou.id, session.id))?.answersChangedAt).toBeNull()
    }
    const { session, lou, path } = await person('confirmed')
    await prisma.session.update({ where: { id: session.id }, data: { date: new Date(Date.now() - 30 * 86_400_000) } })
    expect((await publicApi('PUT', path, answers({ phone: '0677777778' }))).status).toBe(200)
    expect((await lineOf(prisma, lou.id, session.id))?.answersChangedAt).toBeNull()
  })
})

describe('parcours complet (US-174, R18)', () => {
  async function inscribed() {
    const pool = await createPool(prisma, alice.id, { key: 'valide', sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const token = randomBytes(32).toString('base64url')
    const lou = await addPerson(prisma, pool, 'Lou', [], { links: { create: { tokenHash: sha256(token) } } })
    await prisma.registrationSession.create({ data: { registrationId: lou.id, sessionId: session.id, status: 'confirmed', confirmedAt: new Date(), announcedStatus: 'retained' } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: lou.participantId, role: 'participant' } })
    counter++
    const seenByPerson = async () => (bodyOf<{ sessions: Array<{ status: string, validated: boolean }> }>(await publicApi('GET', `/api/public/registrations/${token}`))).sessions[0]
    const seenByTeam = async () => {
      const periods = bodyOf<ApiResponse<'/api/registration-periods'>>(await api(alice, 'GET', `/api/registration-periods?gameId=${pool.game.id}`))
      return periods[0]!.registrations.find((registration) => registration.id === lou.id)!.sessionLines[0]
    }
    return { pool, session, lou, seenByPerson, seenByTeam, path: `/api/public/registrations/${token}` }
  }

  it('se valide au paiement pour la personne comme pour l’équipe, et redevient inscrite sans lui', async () => {
    const { session, lou, seenByPerson, seenByTeam } = await inscribed()
    expect(await seenByPerson()).toMatchObject({ status: 'confirmed', validated: false })
    expect(await seenByTeam()).toMatchObject({ status: 'confirmed', validated: false })

    const paid = await prisma.sessionPayment.create({ data: { sessionId: session.id, participantId: lou.participantId, paidAt: new Date() } })
    expect(await seenByPerson()).toMatchObject({ validated: true })
    expect(await seenByTeam()).toMatchObject({ validated: true })

    await prisma.sessionPayment.delete({ where: { id: paid.id } })
    expect(await seenByPerson()).toMatchObject({ validated: false })
  })

  it('à tarifs : le premier versement valide, et aucun tarif pour elle valide dès la confirmation', async () => {
    const { session, lou, seenByPerson } = await inscribed()
    const tariff = await prisma.sessionTariff.create({ data: { sessionId: session.id, name: 'Joueur', amountCents: 5000, defaultRole: 'pj' } })
    expect(await seenByPerson()).toMatchObject({ validated: false })
    const payment = await prisma.sessionPayment.create({ data: { sessionId: session.id, participantId: lou.participantId, tariffId: tariff.id } })
    await prisma.sessionPaymentInstalment.create({ data: { paymentId: payment.id, amountCents: 1000, receivedAt: new Date() } })
    expect(await seenByPerson()).toMatchObject({ validated: true })

    await prisma.sessionPaymentInstalment.deleteMany({ where: { paymentId: payment.id } })
    expect(await seenByPerson()).toMatchObject({ validated: false })
    await prisma.sessionPayment.update({ where: { id: payment.id }, data: { tariffId: null } })
    await prisma.sessionTariff.update({ where: { id: tariff.id }, data: { defaultRole: 'kitchen' } })
    expect(await seenByPerson()).toMatchObject({ validated: true })
  })

  it('retirée de l’équipe sans avoir payé, elle n’est pas validée', async () => {
    const { session, lou, seenByPerson } = await inscribed()
    await prisma.sessionTariff.create({ data: { sessionId: session.id, name: 'Joueur', amountCents: 5000, defaultRole: 'pj' } })
    await prisma.sessionParticipant.deleteMany({ where: { sessionId: session.id, participantId: lou.participantId } })
    expect(await seenByPerson()).toMatchObject({ status: 'confirmed', validated: false })
  })

  it('reportée : l’ancienne session est transférée, et le paiement reporté valide sur la nouvelle', async () => {
    const { session, lou, path, pool } = await inscribed()
    await prisma.sessionPayment.create({ data: { sessionId: session.id, participantId: lou.participantId, paidAt: new Date() } })
    const postponed = await api(alice, 'POST', `/api/sessions/${session.id}/postpone`, { name: `Report ${pool.key}`, date: new Date(Date.now() + 60 * 86_400_000).toISOString() })
    expect(postponed.status, JSON.stringify(postponed.body)).toBe(200)
    const created = (postponed.body as { id: string }).id
    const carried = await api(alice, 'PUT', `/api/sessions/${session.id}/payments/${lou.participantId}/refund`, { status: 'carried_over' })
    expect(carried.status, JSON.stringify(carried.body)).toBe(200)

    const lines = bodyOf<{ sessions: Array<{ sessionId: string, status: string, validated: boolean }> }>(await publicApi('GET', path))
    expect(lines.sessions.find((line) => line.sessionId === session.id)).toMatchObject({ status: 'transferred', validated: false })
    expect(lines.sessions.find((line) => line.sessionId === created)).toMatchObject({ status: 'confirmed', validated: true })
  })

  it('une décision pas confirmée n’est jamais validée', async () => {
    const { session, lou, seenByPerson } = await inscribed()
    await prisma.sessionPayment.create({ data: { sessionId: session.id, participantId: lou.participantId, paidAt: new Date() } })
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lou.id, sessionId: session.id } }, data: { status: 'retained', confirmedAt: null } })
    expect(await seenByPerson()).toMatchObject({ status: 'retained', validated: false })
  })
})

describe('disponibilités (R7, R29)', () => {
  // Une personne du vivier avec un lien connu, pré-inscrite pour la première des deux sessions ouvertes
  async function member(options: { seats?: number } = {}) {
    const pool = await createPool(prisma, alice.id, { key: 'dispo', seats: options.seats ?? 2 })
    const [first, second] = pool.sessions as [typeof pool.sessions[number], typeof pool.sessions[number]]
    const token = randomBytes(32).toString('base64url')
    const person = await addPerson(prisma, pool, 'Lou', [first.id], { links: { create: { tokenHash: sha256(token) } }, firstName: 'Lou', lastName: 'Dupont', phone: '0600000000', emergencyContactName: 'D', emergencyContactPhone: '0600000001' })
    counter++
    return { pool, first, second, person, path: `/api/public/registrations/${token}` }
  }
  const save = (path: string, availableSessionIds: string[]) => publicApi('PUT', path, answers({ availableSessionIds }))
  const key = (registrationId: string, sessionId: string) => ({ registrationId_sessionId: { registrationId, sessionId } })

  it('un enregistrement sans ce champ ne change aucune disponibilité', async () => {
    const { first, person, path } = await member()
    expect((await publicApi('PUT', path, answers())).status).toBe(200)
    expect(await lineOf(prisma, person.id, first.id)).toMatchObject({ status: 'preregistered', answer: 'available' })
  })

  it('propose les sessions ouvertes, et aucune n’est obligatoire', async () => {
    const { first, second, person, path } = await member()
    const view = await publicApi('GET', path)
    expect((view.body as { availability: { sessions: Array<{ id: string }> } }).availability.sessions.map((session) => session.id).sort()).toEqual([first.id, second.id].sort())
    expect(view.body).toMatchObject({ answers: { availableSessionIds: [first.id] }, canEdit: true })

    expect((await save(path, [first.id, second.id])).status).toBe(200)
    expect(await lineOf(prisma, person.id, second.id)).toMatchObject({ status: 'preregistered', answer: 'available' })
    expect((await save(path, ['inconnue'])).status).toBe(400)
  })

  it('décocher une pré-inscription vaut « pas disponible » ; une date jamais cochée reste sans réponse', async () => {
    const { first, second, person, path } = await member()
    expect((await save(path, [])).status).toBe(200)
    expect(await lineOf(prisma, person.id, first.id)).toMatchObject({ status: 'unavailable', answer: 'unavailable' })
    expect(await lineOf(prisma, person.id, second.id)).toBeNull()

    // Recocher la rend pré-inscrite
    expect((await save(path, [first.id])).status).toBe(200)
    expect(await lineOf(prisma, person.id, first.id)).toMatchObject({ status: 'preregistered', answer: 'available' })
  })

  it('décocher en attente la sort de la file, sans lui rendre son rang ensuite', async () => {
    const { first, person, path } = await member()
    await prisma.registrationSession.update({ where: key(person.id, first.id), data: { status: 'waitlisted', waitlistPosition: 1 } })
    expect((await save(path, [])).status).toBe(200)
    expect(await lineOf(prisma, person.id, first.id)).toMatchObject({ status: 'unavailable', waitlistPosition: null })
    expect((await save(path, [first.id])).status).toBe(200)
    expect(await lineOf(prisma, person.id, first.id)).toMatchObject({ status: 'preregistered', waitlistPosition: null })
  })

  it('retenue sans annonce : retirée sans l’apprendre, personnage libéré, équipe prévenue', async () => {
    const { pool, first, person, path } = await member()
    expect((await api(alice, 'POST', `/api/registrations/${person.id}/selection`, { action: 'retain', sessionId: first.id })).status).toBe(200)
    const character = await prisma.character.findFirstOrThrow({ where: { gameId: pool.game.id } })
    const assignment = await prisma.sessionAssignment.create({ data: { sessionId: first.id, characterId: character.id, reservedRegistrationId: person.id } })
    const sentBefore = smtp.received.length

    // Avant : elle se voit pré-inscrite
    expect((await publicApi('GET', path)).body).toMatchObject({ sessions: [expect.objectContaining({ status: 'preregistered', canConfirmPlace: false })] })

    const saved = await save(path, [])
    expect(saved.status).toBe(200)
    expect(saved.body).toMatchObject({ keptSessions: [] })
    expect(JSON.stringify(saved.body)).not.toContain('retenue')
    expect(await lineOf(prisma, person.id, first.id)).toMatchObject({ status: 'unavailable', retainedById: null })
    expect(await prisma.sessionAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).toMatchObject({ reservedRegistrationId: null })
    await expect.poll(() => smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))?.text, { timeout: 10_000 })
      .toContain('n’est plus disponible')
  })

  it('retenue et annoncée, ou inscrite : rien ne change, la page renvoie vers l’annulation', async () => {
    const { first, person, path } = await member()
    await prisma.registrationSession.update({ where: key(person.id, first.id), data: { status: 'retained', announcedStatus: 'retained' } })
    const retained = await save(path, [])
    expect(retained.status).toBe(200)
    expect(retained.body).toMatchObject({ keptSessions: [first.name], answers: { availableSessionIds: [first.id] } })
    expect(await lineOf(prisma, person.id, first.id)).toMatchObject({ status: 'retained', answer: 'available' })

    await prisma.registrationSession.update({ where: key(person.id, first.id), data: { status: 'confirmed' } })
    expect((await save(path, [])).body).toMatchObject({ keptSessions: [first.name] })
    expect(await lineOf(prisma, person.id, first.id)).toMatchObject({ status: 'confirmed' })
  })

  it('une réponse « disponible » ne révèle pas une décision non annoncée, et ne la change pas', async () => {
    const { second, person, path } = await member()
    await prisma.registrationSession.create({ data: { registrationId: person.id, sessionId: second.id, status: 'retained', retainedById: alice.id } })
    expect((await publicApi('GET', path)).body).toMatchObject({ answers: { availableSessionIds: expect.not.arrayContaining([second.id]) } })
    expect((await save(path, [second.id])).status).toBe(200)
    expect(await lineOf(prisma, person.id, second.id)).toMatchObject({ status: 'retained', answer: 'available' })
  })
})

describe('décliner', () => {
  it('la personne n’entre pas dans le vivier, sans participation de session ; le lien ne permet plus rien', async () => {
    const { path, registration, session, participant, game } = await invitation()

    const response = await publicApi('POST', `${path}/decline`)

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toEqual({ status: 'withdrawn', game: { title: game.title }, withdrawalReason: 'declined' })
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(saved.status).toBe('withdrawn')
    expect(saved.withdrawnAt).not.toBeNull()
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)

    expect((await publicApi('GET', path)).body).toEqual({ status: 'withdrawn', game: { title: game.title }, withdrawalReason: 'declined' })
    expect((await publicApi('PUT', path, answers())).status).toBe(409)
    expect((await publicApi('POST', `${path}/decline`)).status).toBe(409)
  })

  it('n’est plus possible après avoir répondu', async () => {
    const { path } = await invitation()
    await publicApi('PUT', path, answers())
    expect((await publicApi('POST', `${path}/decline`)).status).toBe(409)
  })
})

describe('annuler sa présence à une session (R19)', () => {
  const PHOTOS = join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')

  it('libère la session et les personnages, efface la photo, régénère les trombinoscopes, garde le paiement visible et prévient les orgas ; elle reste dans le vivier', async () => {
    const { path, game, session, participant, registration } = await invitation()
    expect((await publicApi('PUT', path, answers({ availableSessionIds: [session.id] }))).status).toBe(200)

    // L'organisatrice a distribué un personnage avec une photo, un paiement est enregistré
    const character = await prisma.character.create({ data: { name: 'Roméo', slug: `romeo-${counter}`, gameId: game.id } })
    const filename = `photo-desistement-${counter}.png`
    const url = `/api/uploads/session-assignment-photos/${filename}`
    await mkdir(PHOTOS, { recursive: true })
    await writeFile(join(PHOTOS, filename), 'png')
    await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename, url, gameId: game.id, sessionId: session.id } })
    const assignment = await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id, photoUrl: url } })
    await prisma.sessionPayment.create({ data: { sessionId: session.id, participantId: participant.id, paidAt: new Date() } })
    await prisma.sessionTrombinoscope.create({ data: { sessionId: session.id, viewerCharacterId: character.id, participantId: participant.id, fileName: 't.pdf', contentHtml: url } })
    const sentBefore = smtp.received.length

    const response = await publicApi('POST', `${path}/cancel`, { sessionId: session.id })

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ status: 'received', canEdit: true, sessions: [expect.objectContaining({ status: 'cancelled', canCancel: false })] })
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'cancelled', cancelledById: null })
    expect((await lineOf(prisma, registration.id, session.id))!.cancelledAt).not.toBeNull()

    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)
    // Le personnage reste, sans joueur ni photo ; le fichier est effacé
    expect(await prisma.sessionAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).toMatchObject({ participantId: null, photoUrl: null })
    expect(await prisma.uploadedFile.count({ where: { url } })).toBe(0)
    expect(existsSync(join(PHOTOS, filename))).toBe(false)
    // Le paiement reçu est gardé, à traiter à la main, et reste visible dans le tableau des paiements
    expect(await prisma.sessionPayment.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(1)
    const payments = await api(alice, 'GET', `/api/sessions/${session.id}/payments`)
    expect(bodyOf<ApiResponse<'/api/sessions/:id/payments'>>(payments).unassignedPayments).toMatchObject([{ participant: { id: participant.id } }])
    expect(bodyOf<ApiResponse<'/api/sessions/:id/payments'>>(payments).rows).toEqual([])

    // Après la réponse : trombinoscopes régénérés sans elle, puis email aux organisateurs
    await expect.poll(() => smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))?.text, { timeout: 10_000 })
      .toContain(`${participant.name} a annulé sa présence à la session ${session.name}`)
    const notice = smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))!
    expect(notice.text).toContain('trombinoscopes de la session ont été régénérés')
    expect(await prisma.sessionTrombinoscope.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)

    // Une seconde annulation n'a rien à annuler ; elle peut se dire de nouveau disponible si la session est proposée
    expect((await publicApi('POST', `${path}/cancel`, { sessionId: session.id })).status).toBe(409)
    await prisma.registrationPeriodSession.update({ where: { sessionId: session.id }, data: { open: true } })
    expect((await publicApi('GET', path)).body).toMatchObject({ answers: { availableSessionIds: [] } })
    expect((await publicApi('PUT', path, answers({ availableSessionIds: [session.id] }))).status).toBe(200)
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'preregistered', answer: 'available', cancelledAt: null })
  })

  it('une session sans présence n’a rien à annuler, et le refus ne révèle pas une décision non annoncée (R28)', async () => {
    const { path, session, registration } = await invitation()
    await publicApi('PUT', path, answers())
    expect((await publicApi('POST', `${path}/cancel`, { sessionId: session.id })).status).toBe(409)
    await prisma.registrationSession.create({ data: { registrationId: registration.id, sessionId: session.id, status: 'retained', retainedById: alice.id } })
    expect((await publicApi('POST', `${path}/cancel`, { sessionId: session.id })).status).toBe(409)
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'retained' })
  })

  it('une session qui n’est plus à venir ne s’annule pas', async () => {
    const { path, session, registration } = await invitation()
    await publicApi('PUT', path, answers())
    await prisma.registrationSession.create({ data: { registrationId: registration.id, sessionId: session.id, status: 'confirmed', answer: 'available' } })
    await prisma.session.update({ where: { id: session.id }, data: { status: 'completed' } })
    expect((await publicApi('POST', `${path}/cancel`, { sessionId: session.id })).status).toBe(409)
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'confirmed' })
  })
})

describe('quitter le vivier (R5)', () => {
  it('annule ses présences à venir, garde les passées, invalide le lien, et prévient l’équipe', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'sortie', sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const past = await prisma.session.create({ data: { name: 'Passée', slug: `passee-${pool.key}`, gameId: pool.game.id, status: 'completed', date: new Date('2020-01-01') } })
    const token = randomBytes(32).toString('base64url')
    const person = await addPerson(prisma, pool, 'Lou', [session.id], { links: { create: { tokenHash: sha256(token) } } })
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: person.id, sessionId: session.id } }, data: { status: 'confirmed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: person.participantId, role: 'participant' } })
    await prisma.registrationSession.create({ data: { registrationId: person.id, sessionId: past.id, status: 'confirmed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: past.id, participantId: person.participantId, role: 'participant' } })
    const sentBefore = smtp.received.length
    counter++

    const path = `/api/public/registrations/${token}`
    const response = await publicApi('POST', `${path}/withdraw`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toEqual({ status: 'withdrawn', game: { title: pool.game.title }, withdrawalReason: 'left' })

    expect(await prisma.registration.findUniqueOrThrow({ where: { id: person.id } })).toMatchObject({ status: 'withdrawn', withdrawnById: null })
    expect(await prisma.registrationLink.count({ where: { registrationId: person.id } })).toBe(0)
    expect(await lineOf(prisma, person.id, session.id)).toMatchObject({ status: 'cancelled' })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: person.participantId } })).toBe(0)
    // La session terminée reste
    expect(await lineOf(prisma, person.id, past.id)).toMatchObject({ status: 'confirmed' })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: past.id, participantId: person.participantId } })).toBe(1)

    // Le lien ne marche plus ; l'équipe voit qu'elle est sortie, et elle est prévenue
    expect((await publicApi('GET', path)).status).toBe(404)
    await expect.poll(() => smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))?.text, { timeout: 10_000 })
      .toContain('a quitté le vivier')
    const list = await api(alice, 'GET', `/api/registration-periods/${pool.period.id}/registrations`)
    expect(list.body).toMatchObject([{ status: 'withdrawn', withdrawnBy: null }])
  })

  it('n’est pas possible sur une invitation sans réponse : elle se décline', async () => {
    const { path, registration } = await invitation()
    expect((await publicApi('POST', `${path}/withdraw`)).status).toBe(409)
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe('invited')
  })
})

describe('règles issues de la revue de code', () => {
  it('la date de consentement santé est celle du dernier enregistrement (R14)', async () => {
    const { path, registration } = await invitation()
    await publicApi('PUT', path, answers())
    const first = (await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).healthConsentAt!
    await new Promise((resolve) => setTimeout(resolve, 20))

    await publicApi('PUT', path, answers({ dietary: 'Gluten' }))
    const second = (await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).healthConsentAt!
    expect(second.getTime()).toBeGreaterThan(first.getTime())
  })

  it('une réponse invalide ne crée pas de version du formulaire', async () => {
    const { path, game } = await invitation()
    expect((await publicApi('PUT', path, answers({ phone: '' }))).status).toBe(400)
    expect(await prisma.registrationFormVersion.count({ where: { form: { gameId: game.id } } })).toBe(0)
  })

  it('deux premières réponses simultanées partagent la version 1', async () => {
    const first = await invitation()
    const period = await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: first.period.id } })
    const other = await prisma.participant.create({ data: { name: 'Seconde Personne', slug: `seconde-personne-${counter}`, email: `seconde-${counter}@example.test`, gameLinks: { create: { gameId: first.game.id } } } })
    const token = randomBytes(32).toString('base64url')
    await prisma.registration.create({ data: { periodId: period.id, invitedSessionId: first.session.id, participantId: other.id, status: 'invited', source: 'invitation', email: other.email!, links: { create: { tokenHash: sha256(token) } } } })

    const statuses = (await Promise.all([
      publicApi('PUT', first.path, answers()),
      publicApi('PUT', `/api/public/registrations/${token}`, answers({ email: `seconde-${counter}@example.test` }))
    ])).map((response) => response.status)
    expect(statuses).toEqual([200, 200])
    expect(await prisma.registrationFormVersion.count({ where: { form: { gameId: first.game.id } } })).toBe(1)
  })

  it('une invitation libérée faute de réponse le dit à la personne', async () => {
    const { path, registration } = await invitation()
    await prisma.registration.update({ where: { id: registration.id }, data: { status: 'withdrawn', withdrawnAt: new Date(), withdrawnById: alice.id } })
    expect((await publicApi('GET', path)).body).toMatchObject({ status: 'withdrawn', withdrawalReason: 'released' })
  })
})

describe('liens invalides (ADR-0018)', () => {
  it('jeton inconnu, invalidé ou inscription supprimée : même réponse ; un lien n’expire pas (ADR-0070)', async () => {
    const replaced = await invitation()
    await prisma.registrationLink.deleteMany({ where: { registrationId: replaced.registration.id } })
    const deleted = await invitation()
    await prisma.registration.delete({ where: { id: deleted.registration.id } })
    const old = await invitation({ sessionDate: new Date(Date.now() - 31 * 86_400_000) })
    expect((await publicApi('GET', old.path)).status).toBe(200)

    const paths = [
      `/api/public/registrations/${randomBytes(32).toString('base64url')}`,
      '/api/public/registrations/pas-un-jeton',
      replaced.path,
      deleted.path
    ]
    const responses = await Promise.all(paths.map((path) => publicApi('GET', path)))
    for (const response of responses) {
      expect(response.status).toBe(404)
      expect(errorMessage(response)).toBe('Ce lien n’est pas valide.')
    }
    expect((await publicApi('PUT', replaced.path, answers())).status).toBe(404)
    expect((await publicApi('POST', `${deleted.path}/decline`)).status).toBe(404)
  })

  it('le débit est limité par IP', async () => {
    const { path } = await invitation()
    const ip = '10.9.9.9'
    const statuses = []
    for (let attempt = 0; attempt < 61; attempt++) {
      statuses.push((await publicApi('GET', path, undefined, ip)).status)
    }
    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true)
    expect(statuses[60]).toBe(429)
    // Une autre IP n'est pas concernée
    expect((await publicApi('GET', path, undefined, '10.9.9.10')).status).toBe(200)
  })
})
