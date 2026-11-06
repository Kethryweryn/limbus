// US-161 : le statut d'une personne, session par session (SPEC-018, R8, R17, R18, R20, R24, R28, R30)
import { createHash, randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, errorMessage } from './api'
import { createTestPrisma } from './db'
import { addPerson, createPool, lineOf } from './pool'
import { personalLinkToken, startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0
const DAY = 24 * 60 * 60 * 1000

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

// Chaque appel public part d'une IP à lui : la limite de débit ne mélange pas les tests
async function publicApi(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'x-forwarded-for': `10.30.${Math.floor(++counter / 250)}.${counter % 250}` }
  if (body) headers['content-type'] = 'application/json'
  const response = await fetch(`${inject('baseUrl')}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: response.status, body: await response.json().catch(() => null) as unknown }
}

type Selection = ApiResponse<'/api/registration-periods/:id/selection'>
type Announcement = ApiResponse<'/api/registration-periods/:id/announce', 'post'>

const select = (registrationId: string, action: string, sessionId: string) =>
  api(alice, 'POST', `/api/registrations/${registrationId}/selection`, { action, sessionId })
const line = (registrationId: string, sessionId: string) => lineOf(prisma, registrationId, sessionId)
const announce = (periodId: string) => api(alice, 'POST', `/api/registration-periods/${periodId}/announce`)
const emailsTo = (registration: { email: string }) => smtp.received.filter((email) => email.to.includes(registration.email))

describe('une personne, session par session (R17)', () => {
  it('retenue pour une session, elle reste pré-inscrite pour l’autre', async () => {
    const pool = await createPool(prisma, alice.id, { seats: 2 })
    const both = pool.sessions.map((session) => session.id)
    const lou = await addPerson(prisma, pool, 'Lou', both)

    expect((await select(lou.id, 'retain', both[0]!)).status).toBe(200)
    expect(await line(lou.id, both[0]!)).toMatchObject({ status: 'retained', retainedById: alice.id, responseDueAt: null })
    expect(await line(lou.id, both[1]!)).toMatchObject({ status: 'preregistered' })
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: lou.id } })).toMatchObject({ status: 'received' })
  })

  it('une session pleine refuse, et dit de créer un personnage ; créer un personnage ajoute la place (R8)', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 1 })
    const session = pool.sessions[0]!
    const lou = await addPerson(prisma, pool, 'Lou', [session.id])
    const max = await addPerson(prisma, pool, 'Max', [session.id])
    expect((await select(lou.id, 'retain', session.id)).status).toBe(200)

    const full = await select(max.id, 'retain', session.id)
    expect(full.status).toBe(409)
    expect(errorMessage(full)).toContain('créez un personnage')
    expect(await line(max.id, session.id)).toMatchObject({ status: 'preregistered' })

    await prisma.character.create({ data: { name: 'PJ de plus', slug: `pj-plus-${pool.key}`, gameId: pool.game.id, type: 'pj' } })
    expect((await select(max.id, 'retain', session.id)).status).toBe(200)
  })

  it('supprimer un personnage ne retire personne : la session est en surnombre', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    for (const name of ['Lou', 'Max']) await select((await addPerson(prisma, pool, name, [session.id])).id, 'retain', session.id)
    const character = await prisma.character.findFirstOrThrow({ where: { gameId: pool.game.id } })
    await prisma.character.delete({ where: { id: character.id } })

    const overview = bodyOf<Selection>(await api(alice, 'GET', `/api/registration-periods/${pool.period.id}/selection`))
    expect(overview.sessions[0]).toMatchObject({ seats: 1, taken: 2 })
    expect(await prisma.registrationSession.count({ where: { sessionId: session.id, status: 'retained' } })).toBe(2)
  })

  it('une personne du vivier sans réponse, ou qui a répondu non, peut être ajoutée à la main (R20)', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const silent = await addPerson(prisma, pool, 'Silencieuse')
    const refusing = await addPerson(prisma, pool, 'Refus')
    await prisma.registrationSession.create({ data: { registrationId: refusing.id, sessionId: session.id, status: 'unavailable', answer: 'unavailable' } })

    expect((await select(silent.id, 'retain', session.id)).status).toBe(200)
    expect(await line(silent.id, session.id)).toMatchObject({ status: 'retained', answer: null })
    expect((await select(refusing.id, 'retain', session.id)).status).toBe(200)
    expect(await line(refusing.id, session.id)).toMatchObject({ status: 'retained', answer: 'unavailable' })

    // Retirée du cast sans annonce, chacune revient à sa dernière réponse
    expect((await select(silent.id, 'reset', session.id)).status).toBe(200)
    expect(await line(silent.id, session.id)).toBeNull()
    expect((await select(refusing.id, 'reset', session.id)).status).toBe(200)
    expect(await line(refusing.id, session.id)).toMatchObject({ status: 'unavailable' })
  })

  it('une invitée sans réponse, ou sortie du vivier, ne se caste pas (R4, R5)', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const invited = await addPerson(prisma, pool, 'Invitée', [], { status: 'invited', respondedAt: null })
    const left = await addPerson(prisma, pool, 'Sortie', [], { status: 'withdrawn' })
    for (const registration of [invited, left]) {
      const refused = await select(registration.id, 'retain', session.id)
      expect(refused.status).toBe(409)
      expect(errorMessage(refused)).toContain('pas dans le vivier')
    }
  })

  it('un rejoueur exclu se retient quand même à la main, et reste signalé (R24)', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 1, replayPolicy: 'excluded' })
    const session = pool.sessions[0]!
    const lou = await addPerson(prisma, pool, 'Lou', [session.id])
    const past = await prisma.session.create({ data: { name: 'Passée', slug: `passee-${pool.key}`, gameId: pool.game.id, status: 'completed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: past.id, participantId: lou.participantId, role: 'participant' } })

    const overview = bodyOf<Selection>(await api(alice, 'GET', `/api/registration-periods/${pool.period.id}/selection`))
    expect(overview.replayerParticipantIds).toEqual([lou.participantId])
    expect((await select(lou.id, 'retain', session.id)).status).toBe(200)
    // Une session terminée n'est plus à caster
    expect(overview.sessions.map((row) => row.id)).toEqual([session.id])
  })

  it('une session d’un autre jeu est refusée ; une inscrite passe par l’annulation', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 2 })
    const other = await createPool(prisma, alice.id)
    const session = pool.sessions[0]!
    const lou = await addPerson(prisma, pool, 'Lou', [session.id])
    expect((await select(lou.id, 'retain', other.sessions[0]!.id)).status).toBe(400)

    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lou.id, sessionId: session.id } }, data: { status: 'confirmed' } })
    expect((await select(lou.id, 'reset', session.id)).status).toBe(409)
  })

  it('met en liste d’attente, réordonne, et retenir la sort de la file de cette session seulement', async () => {
    const pool = await createPool(prisma, alice.id, { seats: 1 })
    const both = pool.sessions.map((session) => session.id)
    const lou = await addPerson(prisma, pool, 'Lou', both)
    const max = await addPerson(prisma, pool, 'Max', both)

    for (const registration of [lou, max]) expect((await select(registration.id, 'waitlist', both[0]!)).status).toBe(200)
    expect((await select(lou.id, 'waitlist', both[1]!)).status).toBe(200)
    expect(await line(lou.id, both[0]!)).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 })
    expect(await line(max.id, both[0]!)).toMatchObject({ status: 'waitlisted', waitlistPosition: 2 })

    const reorder = (registrationIds: string[]) => api(alice, 'PUT', `/api/registration-periods/${pool.period.id}/waitlist`, { sessionId: both[0], registrationIds })
    expect((await reorder([max.id])).status).toBe(409)
    expect((await reorder([max.id, lou.id])).status).toBe(200)
    expect(await line(max.id, both[0]!)).toMatchObject({ waitlistPosition: 1 })

    expect((await select(lou.id, 'retain', both[1]!)).status).toBe(200)
    expect(await line(lou.id, both[0]!)).toMatchObject({ status: 'waitlisted' })

    // Sortie de la file, elle revient à sa réponse
    expect((await select(max.id, 'unwaitlist', both[0]!)).status).toBe(200)
    expect(await line(max.id, both[0]!)).toMatchObject({ status: 'preregistered', waitlistPosition: null })
    expect((await select(max.id, 'unwaitlist', both[0]!)).status).toBe(400)
  })
})

describe('annoncer (US-088) et confirmer sa place (R18)', () => {
  it('annonce chaque décision une fois ; confirmer inscrit à cette session seulement et crée le participant', async () => {
    const pool = await createPool(prisma, alice.id, { seats: 1 })
    const [first, second] = pool.sessions as [typeof pool.sessions[number], typeof pool.sessions[number]]
    const lou = await addPerson(prisma, pool, 'Lou', [first.id, second.id])
    const max = await addPerson(prisma, pool, 'Max', [first.id])
    await select(lou.id, 'retain', first.id)
    await select(max.id, 'waitlist', first.id)

    expect((await announce(pool.period.id)).status).toBe(200)
    const louEmail = emailsTo(lou)[0]!
    expect(louEmail.text).toContain('est retenue pour la session')
    expect(emailsTo(max)[0]!.text).toContain('liste d’attente')

    // Un lien de plus, l'ancien reste valable (ADR-0070) ; l'échéance part de l'annonce
    expect(await prisma.registrationLink.count({ where: { registrationId: lou.id } })).toBe(2)
    const announced = await line(lou.id, first.id)
    expect(announced).toMatchObject({ announcedStatus: 'retained' })
    expect(announced!.responseDueAt!.getTime()).toBeGreaterThan(Date.now() + 6 * DAY)

    // Une seconde annonce n'envoie rien
    expect(bodyOf<Announcement>(await announce(pool.period.id)).announcedCount).toBe(0)

    const token = personalLinkToken(louEmail)!
    const view = await publicApi('GET', `/api/public/registrations/${token}`)
    expect(view.body).toMatchObject({ status: 'received', sessions: expect.arrayContaining([expect.objectContaining({ sessionId: first.id, status: 'retained', canConfirmPlace: true })]) })

    const confirmed = await publicApi('POST', `/api/public/registrations/${token}/accept`, { sessionId: first.id })
    expect(confirmed.status).toBe(200)
    expect(await line(lou.id, first.id)).toMatchObject({ status: 'confirmed' })
    expect(await line(lou.id, second.id)).toMatchObject({ status: 'preregistered' })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: first.id, participantId: lou.participantId, role: 'participant' } })).toBe(1)
    expect(await prisma.sessionParticipant.count({ where: { sessionId: second.id, participantId: lou.participantId } })).toBe(0)
    expect((await publicApi('POST', `/api/public/registrations/${token}/accept`, { sessionId: first.id })).status).toBe(409)
  })

  it('une décision pas encore annoncée ne se voit pas, et ne se confirme pas (R28)', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 1 })
    const session = pool.sessions[0]!
    const lou = await addPerson(prisma, pool, 'Lou', [session.id])
    await select(lou.id, 'waitlist', session.id)
    await announce(pool.period.id)
    const token = personalLinkToken(emailsTo(lou).at(-1)!)!

    // Retenue après l'annonce : elle voit toujours la liste d'attente
    await select(lou.id, 'retain', session.id)
    const view = await publicApi('GET', `/api/public/registrations/${token}`)
    expect(view.body).toMatchObject({ sessions: [expect.objectContaining({ status: 'waitlisted', canConfirmPlace: false })] })
    expect((await publicApi('POST', `/api/public/registrations/${token}/accept`, { sessionId: session.id })).status).toBe(409)
  })

  it('un échec d’envoi laisse la décision à annoncer, et ne crée pas de lien', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 1 })
    const session = pool.sessions[0]!
    const lou = await addPerson(prisma, pool, 'Lou', [session.id])
    await prisma.registration.update({ where: { id: lou.id }, data: { email: `refuse-${lou.email}` } })
    await select(lou.id, 'retain', session.id)
    expect(bodyOf<Announcement>(await announce(pool.period.id)).failures).toHaveLength(1)
    expect(await line(lou.id, session.id)).toMatchObject({ announcedStatus: null })
    expect(await prisma.registrationLink.count({ where: { registrationId: lou.id } })).toBe(1)
  })

  it('délai dépassé : l’équipe prolonge ou libère, puis retient la suivante de la file', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 1 })
    const sessionId = pool.sessions[0]!.id
    const lou = await addPerson(prisma, pool, 'Lou', [sessionId])
    const max = await addPerson(prisma, pool, 'Max', [sessionId])
    await select(lou.id, 'retain', sessionId)
    await select(max.id, 'waitlist', sessionId)
    await announce(pool.period.id)
    const key = { registrationId_sessionId: { registrationId: lou.id, sessionId } }
    await prisma.registrationSession.update({ where: key, data: { responseDueAt: new Date(Date.now() - DAY) } })

    const extended = await api(alice, 'POST', `/api/registrations/${lou.id}/extend`, { sessionId, responseDueAt: new Date(Date.now() + 3 * DAY).toISOString() })
    expect(extended.status, JSON.stringify(extended.body)).toBe(200)
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/remind`, { sessionId })).status).toBe(200)
    expect(smtp.received.at(-1)!.text).toContain('Place retenue')
    expect((await line(lou.id, sessionId))!.lastRemindedAt).not.toBeNull()

    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/release`, { sessionId })).status).toBe(200)
    expect(await line(lou.id, sessionId)).toMatchObject({ status: 'cancelled', cancelledById: alice.id })
    // Elle reste dans le vivier
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: lou.id } })).toMatchObject({ status: 'received' })
    expect((await select(max.id, 'retain', sessionId)).status).toBe(200)
    expect(await line(max.id, sessionId)).toMatchObject({ status: 'retained', announcedStatus: 'waitlisted' })
  })

  it('une décision non annoncée ne se relance pas, ne se prolonge pas, ne se libère pas', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 1 })
    const sessionId = pool.sessions[0]!.id
    const lou = await addPerson(prisma, pool, 'Lou', [sessionId])
    await select(lou.id, 'retain', sessionId)
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/remind`, { sessionId })).status).toBe(409)
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/release`, { sessionId })).status).toBe(409)
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/extend`, { sessionId, responseDueAt: new Date(Date.now() + DAY).toISOString() })).status).toBe(409)
  })

  it('revenir à la place déjà annoncée garde son échéance', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 1 })
    const sessionId = pool.sessions[0]!.id
    const lou = await addPerson(prisma, pool, 'Lou', [sessionId])
    await select(lou.id, 'retain', sessionId)
    await announce(pool.period.id)
    const { responseDueAt } = (await line(lou.id, sessionId))!
    await select(lou.id, 'waitlist', sessionId)
    await select(lou.id, 'retain', sessionId)
    expect(await line(lou.id, sessionId)).toMatchObject({ status: 'retained', responseDueAt })
  })
})

describe('remboursement et report (R30)', () => {
  // Une personne inscrite à une session, avec un paiement reçu
  async function paidPerson() {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 2 })
    const session = pool.sessions[0]!
    const lou = await addPerson(prisma, pool, 'Lou', [session.id])
    await prisma.registrationSession.update({
      where: { registrationId_sessionId: { registrationId: lou.id, sessionId: session.id } },
      data: { status: 'confirmed', confirmedAt: new Date(), announcedStatus: 'retained' }
    })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: lou.participantId, role: 'participant' } })
    await prisma.sessionPayment.create({ data: { sessionId: session.id, participantId: lou.participantId, paidAt: new Date() } })
    return { pool, session, lou }
  }
  const refund = (sessionId: string, participantId: string, refundStatus: string | null) =>
    api(alice, 'PUT', `/api/sessions/${sessionId}/payments/${participantId}/refund`, { status: refundStatus })

  it('à rembourser, sa place passe à « annulation » ; retirer la marque ne la lui rend pas', async () => {
    const { session, lou } = await paidPerson()
    await prisma.session.update({ where: { id: session.id }, data: { status: 'cancelled' } })
    const marked = await refund(session.id, lou.participantId, 'to_refund')
    expect(marked.status, JSON.stringify(marked.body)).toBe(200)
    expect(await line(lou.id, session.id)).toMatchObject({ status: 'cancelled' })
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: lou.id } })).toMatchObject({ status: 'received' })

    expect((await refund(session.id, lou.participantId, null)).status).toBe(200)
    expect(await line(lou.id, session.id)).toMatchObject({ status: 'cancelled' })
  })

  it('un report : castées et inscrites transférées, pré-inscrites et attente non reprises', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 3 })
    const session = pool.sessions[0]!
    const confirmed = await addPerson(prisma, pool, 'Inscrite', [session.id])
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: confirmed.id, sessionId: session.id } }, data: { status: 'confirmed', confirmedAt: new Date(), announcedStatus: 'retained' } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: confirmed.participantId, role: 'participant' } })
    const retained = await addPerson(prisma, pool, 'Castée', [session.id])
    await select(retained.id, 'retain', session.id)
    const preregistered = await addPerson(prisma, pool, 'Pré', [session.id])
    const waiting = await addPerson(prisma, pool, 'Attente', [session.id])
    await select(waiting.id, 'waitlist', session.id)

    const postponed = await api(alice, 'POST', `/api/sessions/${session.id}/postpone`, { name: `Report ${pool.key}`, date: new Date(Date.now() + 50 * DAY).toISOString() })
    expect(postponed.status, JSON.stringify(postponed.body)).toBe(200)
    const created = await prisma.session.findFirstOrThrow({ where: { name: `Report ${pool.key}` } })

    expect(await line(confirmed.id, session.id)).toMatchObject({ status: 'transferred' })
    expect(await line(confirmed.id, created.id)).toMatchObject({ status: 'confirmed' })
    expect(await line(retained.id, session.id)).toMatchObject({ status: 'transferred' })
    expect(await line(retained.id, created.id)).toMatchObject({ status: 'retained' })
    expect(await line(preregistered.id, created.id)).toBeNull()
    expect(await line(waiting.id, created.id)).toBeNull()
    // La nouvelle session n'est pas ouverte d'elle-même
    expect(await prisma.registrationPeriodSession.findUniqueOrThrow({ where: { sessionId: created.id } })).toMatchObject({ open: false })
  })

  it('transférée, répondre qu’elle ne vient pas la met en annulation sur les deux ; revenir sur sa réponse les lui rend', async () => {
    const { pool, session, lou } = await paidPerson()
    expect((await api(alice, 'POST', `/api/sessions/${session.id}/postpone`, { name: `Report ${pool.key}`, date: new Date(Date.now() + 50 * DAY).toISOString() })).status).toBe(200)
    const created = await prisma.session.findFirstOrThrow({ where: { name: `Report ${pool.key}` } })
    const token = randomBytes(32).toString('base64url')
    await prisma.sessionAttendance.create({ data: { sessionId: created.id, participantId: lou.participantId, responseDueAt: new Date(Date.now() + 7 * DAY), tokenHash: createHash('sha256').update(token).digest('hex') } })

    expect((await publicApi('POST', `/api/public/attendance/${token}`, { answer: 'declined' })).status).toBe(200)
    expect(await line(lou.id, session.id)).toMatchObject({ status: 'cancelled' })
    expect(await line(lou.id, created.id)).toMatchObject({ status: 'cancelled' })

    expect((await publicApi('POST', `/api/public/attendance/${token}`, { answer: 'confirmed' })).status).toBe(200)
    expect(await line(lou.id, session.id)).toMatchObject({ status: 'transferred' })
    expect(await line(lou.id, created.id)).toMatchObject({ status: 'confirmed' })
  })

  it('transférée, « je viens » ne rend ni une annulation qu’elle a faite, ni une place marquée à rembourser', async () => {
    const { pool, session, lou } = await paidPerson()
    expect((await api(alice, 'POST', `/api/sessions/${session.id}/postpone`, { name: `Report ${pool.key}`, date: new Date(Date.now() + 50 * DAY).toISOString() })).status).toBe(200)
    const created = await prisma.session.findFirstOrThrow({ where: { name: `Report ${pool.key}` } })
    const token = randomBytes(32).toString('base64url')
    await prisma.sessionAttendance.create({ data: { sessionId: created.id, participantId: lou.participantId, responseDueAt: new Date(Date.now() + 7 * DAY), tokenHash: createHash('sha256').update(token).digest('hex') } })
    const attend = (answer: string) => publicApi('POST', `/api/public/attendance/${token}`, { answer })

    // Refus, puis remboursement, puis « je viens » : la marque ne se défait pas
    expect((await attend('declined')).status).toBe(200)
    expect((await refund(session.id, lou.participantId, 'to_refund')).status).toBe(200)
    expect((await attend('confirmed')).status).toBe(200)
    expect(await line(lou.id, session.id)).toMatchObject({ status: 'cancelled' })
    expect(await line(lou.id, created.id)).toMatchObject({ status: 'cancelled' })
  })

  it('annulée par son lien, puis « je ne viens pas » et « je viens » : son annulation reste', async () => {
    const { pool, session, lou } = await paidPerson()
    expect((await api(alice, 'POST', `/api/sessions/${session.id}/postpone`, { name: `Report ${pool.key}`, date: new Date(Date.now() + 50 * DAY).toISOString() })).status).toBe(200)
    const created = await prisma.session.findFirstOrThrow({ where: { name: `Report ${pool.key}` } })
    const token = randomBytes(32).toString('base64url')
    await prisma.sessionAttendance.create({ data: { sessionId: created.id, participantId: lou.participantId, responseDueAt: new Date(Date.now() + 7 * DAY), tokenHash: createHash('sha256').update(token).digest('hex') } })
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lou.id, sessionId: created.id } }, data: { status: 'cancelled', cancelledAt: new Date() } })
    await prisma.sessionParticipant.deleteMany({ where: { sessionId: created.id, participantId: lou.participantId } })

    expect((await publicApi('POST', `/api/public/attendance/${token}`, { answer: 'declined' })).status).toBe(200)
    expect((await publicApi('POST', `/api/public/attendance/${token}`, { answer: 'confirmed' })).status).toBe(200)
    expect(await line(lou.id, created.id)).toMatchObject({ status: 'cancelled' })
  })

  it('transférée, la rembourser ensuite la désinscrit aussi du report', async () => {
    const { pool, session, lou } = await paidPerson()
    const postponed = await api(alice, 'POST', `/api/sessions/${session.id}/postpone`, { name: `Report ${pool.key}`, date: new Date(Date.now() + 50 * DAY).toISOString() })
    expect(postponed.status).toBe(200)
    const created = await prisma.session.findFirstOrThrow({ where: { name: `Report ${pool.key}` } })

    expect((await refund(session.id, lou.participantId, 'to_refund')).status).toBe(200)
    expect(await line(lou.id, session.id)).toMatchObject({ status: 'cancelled' })
    expect(await line(lou.id, created.id)).toMatchObject({ status: 'cancelled' })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: created.id, participantId: lou.participantId, role: 'participant' } })).toBe(0)
  })
})
