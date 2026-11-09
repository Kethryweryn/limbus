// EPIC-047 (R9 à R13, R15, R29, ADR-0070) : demander au vivier, répondre d'un clic, relancer, liens qui restent valables
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, errorMessage } from './api'
import { createTestPrisma } from './db'
import { addPerson, createPool, lineOf, type Pool } from './pool'
import { personalLinkToken, startTestSmtp } from './smtp'
import type { RegistrationSessionStatus } from '~/generated/prisma/enums'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

type RequestResult = ApiResponse<'/api/registration-periods/:id/sessions/:sessionId/availability-request', 'post'>
type Exposed = { sessions: Array<{ sessionId: string, status: string }>, availabilityEffect?: string }

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const request = (pool: Pool, sessionId: string, body: { registrationIds?: string[] } = {}) => api(alice, 'POST', `/api/registration-periods/${pool.period.id}/sessions/${sessionId}/availability-request`, body)
const emailsTo = (registration: { email: string }) => smtp.received.filter((email) => email.to.includes(registration.email))
const overviewOf = async (pool: Pool, sessionId: string) => bodyOf<ApiResponse<'/api/registration-periods/:id/selection'>>(await api(alice, 'GET', `/api/registration-periods/${pool.period.id}/selection`)).sessions.find((session) => session.id === sessionId)!

// Lien personnel posé directement : le test connaît le jeton
async function linkOf(registrationId: string) {
  const token = `${'t'.repeat(40)}${String(++counter).padStart(3, '0')}`
  await prisma.registrationLink.create({ data: { registrationId, tokenHash: sha256(token) } })
  return token
}

async function publicApi(method: string, path: string, body?: unknown) {
  const response = await fetch(`${inject('baseUrl')}${path}`, {
    method,
    headers: { 'x-forwarded-for': `10.47.0.${counter % 250}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return { status: response.status, body: await response.json().catch(() => null) as Exposed & { message?: string } }
}

const answer = (token: string, sessionId: string, available: boolean) => publicApi('POST', `/api/public/registrations/${token}/availability`, { sessionId, available })

describe('demander au vivier (US-166, R9, R10)', () => {
  it('écrit seulement aux personnes du vivier sans réponse ni place, et note la date', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'demande', sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const silent = await addPerson(prisma, pool, 'Silence')
    const answered = await addPerson(prisma, pool, 'Reponse', [session.id])
    const invited = await addPerson(prisma, pool, 'Invitee', [], { status: 'invited' })
    const left = await addPerson(prisma, pool, 'Sortie', [], { status: 'withdrawn' })

    const result = await request(pool, session.id)
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    expect(bodyOf<RequestResult>(result)).toEqual({ sentCount: 1, failures: [] })
    expect(emailsTo(silent)).toHaveLength(1)
    for (const person of [answered, invited, left]) expect(emailsTo(person)).toHaveLength(0)
    expect((await overviewOf(pool, session.id)).lastRequestedAt).not.toBeNull()

    const { text } = emailsTo(silent)[0]!
    expect(text).toContain('pré-inscrit')
    expect(text).toContain('ne garantit pas de place')
    expect(text).toContain(`session=${session.id}&reponse=disponible`)
    expect(text).toContain(`session=${session.id}&reponse=indisponible`)
    // Le lien de l'email marche, et rien n'est écrit tant que la personne n'a pas confirmé
    expect((await publicApi('GET', `/api/public/registrations/${personalLinkToken(emailsTo(silent)[0]!)}`)).status).toBe(200)
    expect(await lineOf(prisma, silent.id, session.id)).toBeNull()
  })

  it('n’écrit pas à une personne déjà dans l’équipe de la session, sauf la cuisine', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'equipe', sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const npc = await addPerson(prisma, pool, 'Pnj')
    const player = await addPerson(prisma, pool, 'Joueuse')
    const cook = await addPerson(prisma, pool, 'Cuisine')
    await prisma.sessionParticipant.createMany({ data: [
      { sessionId: session.id, participantId: npc.participantId, role: 'npc' },
      { sessionId: session.id, participantId: player.participantId, role: 'participant' },
      { sessionId: session.id, participantId: cook.participantId, role: 'kitchen' }
    ] })
    expect((await overviewOf(pool, session.id)).askableCount).toBe(1)
    expect(bodyOf<RequestResult>(await request(pool, session.id)).sentCount).toBe(1)
    expect(emailsTo(npc)).toHaveLength(0)
    expect(emailsTo(player)).toHaveLength(0)
    expect(emailsTo(cook)).toHaveLength(1)
  })

  it('n’écrit pas à une rejoueuse exclue, seulement si le vivier l’exclut (R24)', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'rejoueuse', sessions: 1, seats: 2, replayPolicy: 'excluded' })
    const session = pool.sessions[0]!
    const replayer = await addPerson(prisma, pool, 'Rejoueuse')
    const fresh = await addPerson(prisma, pool, 'Nouvelle')
    const past = await prisma.session.create({ data: { name: `Passée ${pool.key}`, slug: `passee-${pool.key}`, gameId: pool.game.id, status: 'completed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: past.id, participantId: replayer.participantId, role: 'participant' } })

    expect((await overviewOf(pool, session.id)).askableCount).toBe(1)
    expect(bodyOf<RequestResult>(await request(pool, session.id)).sentCount).toBe(1)
    expect(emailsTo(replayer)).toHaveLength(0)
    expect(emailsTo(fresh)).toHaveLength(1)
  })

  it('refuse une session pas ouverte', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'fermee', sessions: 1, seats: 1, open: false })
    await addPerson(prisma, pool, 'Lou')
    const result = await request(pool, pool.sessions[0]!.id)
    expect(result.status).toBe(409)
    expect(errorMessage(result)).toContain('Ouvrez d’abord')
  })

  it('signale un échec par personne, et réessayer n’écrit qu’à elle', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'echec', sessions: 1, seats: 1 })
    const session = pool.sessions[0]!
    const fine = await addPerson(prisma, pool, 'Recoit')
    const failing = await addPerson(prisma, pool, 'Echoue')
    await prisma.registration.update({ where: { id: failing.id }, data: { email: `refuse-${failing.email}` } })

    const first = bodyOf<RequestResult>(await request(pool, session.id))
    expect(first.sentCount).toBe(1)
    expect(first.failures).toEqual([expect.objectContaining({ registrationId: failing.id, participantName: 'Echoue' })])
    // Son seul lien reste celui d'avant : un email qui n'est pas parti n'en crée pas
    expect(await prisma.registrationLink.count({ where: { registrationId: failing.id } })).toBe(1)

    await prisma.registration.update({ where: { id: failing.id }, data: { email: failing.email } })
    expect(bodyOf<RequestResult>(await request(pool, session.id, { registrationIds: [failing.id] })).sentCount).toBe(1)
    expect(emailsTo(fine)).toHaveLength(1)
    expect(emailsTo(failing)).toHaveLength(1)
  })
})

describe('relancer (US-168, R12)', () => {
  it('écrit seulement à celles qui n’ont pas répondu, et compte les réponses', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'relance', sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const lea = await addPerson(prisma, pool, 'Lea')
    const max = await addPerson(prisma, pool, 'Max')
    await request(pool, session.id)
    const before = (await overviewOf(pool, session.id)).lastRequestedAt
    expect(await overviewOf(pool, session.id)).toMatchObject({ askableCount: 2, answeredCount: 0 })

    expect((await answer(personalLinkToken(emailsTo(lea)[0]!)!, session.id, true)).status).toBe(200)
    expect(await overviewOf(pool, session.id)).toMatchObject({ askableCount: 1, answeredCount: 1 })

    expect(bodyOf<RequestResult>(await request(pool, session.id)).sentCount).toBe(1)
    expect(emailsTo(lea)).toHaveLength(1)
    expect(emailsTo(max)).toHaveLength(2)
    expect(emailsTo(max)[1]!.raw).toContain('Rappel')
    expect((await overviewOf(pool, session.id)).lastRequestedAt).not.toBe(before)
  })
})

describe('répondre d’un clic (US-167, R11, R29)', () => {
  async function person(status?: RegistrationSessionStatus, line: Record<string, unknown> = {}) {
    const pool = await createPool(prisma, alice.id, { key: 'clic', sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const registration = await addPerson(prisma, pool, 'Lou')
    if (status) await prisma.registrationSession.create({ data: { registrationId: registration.id, sessionId: session.id, status, ...line } })
    return { pool, session, registration, token: await linkOf(registration.id) }
  }

  it('« Disponible » pré-inscrit, « Pas disponible » note le refus, et l’on peut changer', async () => {
    const { session, registration, token } = await person()
    expect((await answer(token, session.id, true)).body.availabilityEffect).toBe('changed')
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'preregistered', answer: 'available' })
    expect((await answer(token, session.id, false)).status).toBe(200)
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'unavailable', answer: 'unavailable' })
    expect((await answer(token, session.id, true)).status).toBe(200)
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'preregistered' })
  })

  it('« Disponible » ne change rien à une personne en attente, et une décision non annoncée reste invisible', async () => {
    const { session, registration, token } = await person('retained', { answer: 'available' })
    const { body } = await answer(token, session.id, true)
    expect(body.availabilityEffect).toBe('none')
    expect(body.sessions.find((line) => line.sessionId === session.id)?.status).toBe('preregistered')
    expect((await lineOf(prisma, registration.id, session.id))?.status).toBe('retained')
  })

  it('en attente, « Pas disponible » la sort de la file', async () => {
    const { session, registration, token } = await person('waitlisted', { waitlistPosition: 1, answer: 'available', announcedStatus: 'waitlisted' })
    expect((await answer(token, session.id, false)).status).toBe(200)
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'unavailable', waitlistPosition: null })
  })

  it('retenue sans annonce, « Pas disponible » libère le personnage, sans le lui dire', async () => {
    const { pool, session, registration, token } = await person('retained', { answer: 'available' })
    const character = await prisma.character.findFirstOrThrow({ where: { gameId: pool.game.id } })
    const row = await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, reservedRegistrationId: registration.id } })
    const { body } = await answer(token, session.id, false)
    expect(body.availabilityEffect).toBe('removed')
    expect(body.sessions.find((line) => line.sessionId === session.id)?.status).toBe('unavailable')
    expect(await lineOf(prisma, registration.id, session.id)).toMatchObject({ status: 'unavailable', retainedById: null })
    expect((await prisma.sessionAssignment.findUniqueOrThrow({ where: { id: row.id } })).reservedRegistrationId).toBeNull()
  })

  it('une place annoncée ou confirmée ne change pas', async () => {
    for (const status of ['retained', 'confirmed'] as const) {
      const { session, registration, token } = await person(status, { answer: 'available', announcedStatus: 'retained' })
      expect((await answer(token, session.id, false)).body.availabilityEffect).toBe('kept')
      expect((await lineOf(prisma, registration.id, session.id))?.status).toBe(status)
    }
  })

  it('refuse un lien inconnu, et une session refermée sans réponse de sa part', async () => {
    const { pool, session, token } = await person()
    expect((await answer('x'.repeat(43), session.id, true)).status).toBe(404)
    await prisma.registrationPeriodSession.update({ where: { sessionId: session.id }, data: { open: false } })
    expect((await answer(token, session.id, true)).status).toBe(409)
    expect((await overviewOf(pool, session.id)).answeredCount).toBe(0)
  })

  it('une session refermée accepte encore « Pas disponible » d’une personne pré-inscrite, pas son retour', async () => {
    const { session, registration, token } = await person('preregistered', { answer: 'available' })
    await prisma.registrationPeriodSession.update({ where: { sessionId: session.id }, data: { open: false } })
    expect((await answer(token, session.id, false)).status).toBe(200)
    expect((await lineOf(prisma, registration.id, session.id))?.status).toBe('unavailable')
    expect((await answer(token, session.id, true)).status).toBe(409)
  })
})

describe('liens durables (US-169, R13, ADR-0070)', () => {
  it('un email ancien marche encore après un nouvel envoi ; un nouveau lien à la demande les invalide', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'liens', sessions: 2, seats: 2 })
    const lou = await addPerson(prisma, pool, 'Lou')
    await request(pool, pool.sessions[0]!.id)
    await request(pool, pool.sessions[1]!.id)
    const [first, second] = emailsTo(lou).map(personalLinkToken)
    expect(first).not.toBe(second)
    for (const token of [first, second]) expect((await publicApi('GET', `/api/public/registrations/${token}`)).status).toBe(200)

    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/resend`, {})).status).toBe(200)
    const renewed = personalLinkToken(emailsTo(lou).at(-1)!)
    for (const token of [first, second]) expect((await publicApi('GET', `/api/public/registrations/${token}`)).status).toBe(404)
    expect((await publicApi('GET', `/api/public/registrations/${renewed}`)).status).toBe(200)
  })

  it('quitter le vivier et effacer la fiche effacent les liens', async () => {
    const pool = await createPool(prisma, alice.id, { key: 'sortie', sessions: 1, seats: 1 })
    const left = await addPerson(prisma, pool, 'Sort')
    const token = await linkOf(left.id)
    expect((await publicApi('POST', `/api/public/registrations/${token}/withdraw`)).status).toBe(200)
    expect(await prisma.registrationLink.count({ where: { registrationId: left.id } })).toBe(0)

    const erased = await addPerson(prisma, pool, 'Efface')
    await linkOf(erased.id)
    expect((await api(alice, 'DELETE', `/api/participants/${erased.participantId}`)).status).toBe(200)
    expect(await prisma.registrationLink.count({ where: { registrationId: erased.id } })).toBe(0)
  })
})
