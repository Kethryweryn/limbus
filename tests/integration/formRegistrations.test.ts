// EPIC-020 : période en mode formulaire (US-083), formulaire public (US-084), confirmation de l'email (US-085),
// page publique (US-086)
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api, tokenFor } from './api'
import { createTestPrisma } from './db'
import { personalLinkToken, startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const { alice, bob } = inject('world').users
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
async function publicApi(method: string, path: string, body?: unknown, cookieUser?: { id: string }) {
  const headers: Record<string, string> = { 'x-forwarded-for': `10.20.${Math.floor(++counter / 250)}.${counter % 250}` }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (cookieUser) headers.cookie = `limbus_token=${tokenFor(cookieUser)}`
  const response = await fetch(`${inject('baseUrl')}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await response.text()
  let parsed: unknown = text
  try { parsed = JSON.parse(text) } catch { /* texte brut */ }
  return { status: response.status, body: parsed as any }
}

const standardFields = {
  lastName: { asked: true, required: false },
  firstName: { asked: true, required: true },
  facebookName: { asked: false, required: false },
  phone: { asked: true, required: false },
  emergencyContact: { asked: false, required: false },
  dietary: { asked: false, required: false }
}

// Un jeu d'Alice avec deux sessions et un formulaire enregistré
async function aliceGame(options: { notifyTeam?: boolean } = {}) {
  const key = `formulaire-public-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, noteIntention: 'Jeu de cape et d’épée.' } })
  const sessions = await Promise.all([1, 2].map((index) => prisma.session.create({
    data: { name: `Session ${index} ${key}`, slug: `session-${index}-${key}`, gameId: game.id, date: new Date(Date.now() + (10 + index) * DAY) }
  })))
  expect((await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields, affinities: { wantWith: { asked: true, required: false } } })).status).toBe(200)
  const created = await api(alice, 'POST', '/api/registration-periods', {
    name: `Période ${key}`, gameId: game.id, entryMode: 'form', state: 'open', notifyTeam: options.notifyTeam ?? false,
    sessions: sessions.map((session) => ({ sessionId: session.id, seats: 4 }))
  })
  expect(created.status, JSON.stringify(created.body)).toBe(200)
  return { key, game, sessions, period: created.body as { id: string, publicId: string } }
}

const answers = (email: string, sessionIds: string[], extra: Record<string, unknown> = {}) => ({
  email, firstName: 'Lou', lastName: 'Dupont', phone: '0600000000', charterAccepted: true,
  availableSessionIds: sessionIds, affinities: { wantWith: ['Léa'] }, ...extra
})

// Envoi du formulaire puis confirmation par le lien reçu
async function registerAndConfirm(publicId: string, body: Record<string, unknown>) {
  const sent = smtp.received.length
  const response = await publicApi('POST', `/api/public/periods/${publicId}`, body)
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  const email = smtp.received.slice(sent).find((message) => message.to.includes(String(body.email).toLowerCase()))!
  const token = personalLinkToken(email)!
  const confirmed = await publicApi('POST', `/api/public/registrations/${token}/confirm`)
  return { token, confirmed }
}

describe('période en mode formulaire et inscription permanente (US-083)', () => {
  it('une inscription permanente n’a pas de sessions, et un jeu n’en a qu’une ouverte', async () => {
    const { game } = await aliceGame()
    const permanent = { name: 'Toute l’année', gameId: game.id, entryMode: 'form', scope: 'game', state: 'open' }
    const first = await api(alice, 'POST', '/api/registration-periods', permanent)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body).toMatchObject({ scope: 'game', closesAt: null, sessions: [] })
    expect((await api(alice, 'POST', '/api/registration-periods', permanent)).status).toBe(409)
    expect((await api(alice, 'POST', '/api/registration-periods', { ...permanent, state: 'draft', entryMode: 'invitation' })).status).toBe(400)
    expect(DENIED_OR_NOT_FOUND).toContain((await api(bob, 'POST', '/api/registration-periods', { ...permanent, state: 'draft' })).status)
  })

  it('on n’invite pas dans une période en mode formulaire', async () => {
    const { period, sessions } = await aliceGame()
    const participant = await prisma.participant.findFirst({ where: { gameLinks: { some: {} } }, select: { id: true } })
    const invited = await api(alice, 'POST', `/api/registration-periods/${period.id}/invitations`, { sessionId: sessions[0]!.id, participantIds: participant ? [participant.id] : [] })
    expect([400, 409]).toContain(invited.status)
  })
})

const DENIED_OR_NOT_FOUND = [403, 404]

describe('formulaire public (US-084)', () => {
  it('montre le jeu, les sessions et le formulaire ; brouillon et mode invitation répondent comme un lien inconnu', async () => {
    const { game, sessions, period } = await aliceGame()
    const read = await publicApi('GET', `/api/public/periods/${period.publicId}`)
    expect(read.status).toBe(200)
    expect(read.body).toMatchObject({ state: 'open', permanent: false, asksAvailability: true, game: { title: game.title }, account: null })
    expect(read.body.sessions.map((session: { id: string }) => session.id)).toEqual(sessions.map((session) => session.id))
    expect(JSON.stringify(read.body)).not.toContain(alice.id)

    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { state: 'draft' } })
    expect((await publicApi('GET', `/api/public/periods/${period.publicId}`)).status).toBe(404)
    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { state: 'closed' } })
    expect((await publicApi('GET', `/api/public/periods/${period.publicId}`)).body.state).toBe('closed')
    expect((await publicApi('POST', `/api/public/periods/${period.publicId}`, answers('closed@example.test', [sessions[0]!.id]))).status).toBe(409)
  })

  it('crée une demande, sans fiche ni inscription, et répond pareil pour une adresse déjà inscrite', async () => {
    const { key, game, sessions, period } = await aliceGame()
    const email = `lou-${key}@example.test`
    const first = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(email, [sessions[0]!.id]))
    expect(first.body).toEqual({ received: false, emailSent: true })
    expect(await prisma.registrationRequest.count({ where: { periodId: period.id } })).toBe(1)
    expect(await prisma.participant.count({ where: { email } })).toBe(0)
    expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(0)

    const token = personalLinkToken(smtp.received.at(-1)!)!
    expect((await publicApi('POST', `/api/public/registrations/${token}/confirm`)).status).toBe(200)
    const again = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(email, [sessions[1]!.id], { firstName: 'Autre' }))
    expect(again.body).toEqual(first.body)
    // Rien ne change tant que la nouvelle demande n'est pas confirmée
    expect((await prisma.registration.findFirstOrThrow({ where: { periodId: period.id } })).firstName).toBe('Lou')
    expect(game.id).toBeTruthy()
  })

  it('refuse sans disponibilité ou avec une session inconnue ; le champ piège ne crée rien', async () => {
    const { key, sessions, period } = await aliceGame()
    const none = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`a-${key}@example.test`, []))
    expect(none.status).toBe(400)
    expect(JSON.stringify(none.body)).toContain('availableSessionIds')
    expect((await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`b-${key}@example.test`, ['inconnue']))).status).toBe(400)

    const trapped = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`robot-${key}@example.test`, [sessions[0]!.id], { website: 'http://spam.example' }))
    expect(trapped.body).toEqual({ received: false, emailSent: true })
    expect(await prisma.registrationRequest.count({ where: { email: `robot-${key}@example.test` } })).toBe(0)
  })

  it('une personne connectée est inscrite aussitôt, avec l’adresse de son compte', async () => {
    const { key, sessions, period } = await aliceGame()
    const user = await prisma.user.create({ data: { email: `connectee-${key}@example.test`, name: 'Camille Connectée', password: 'non-utilise', phone: '0611111111' } })
    const read = await publicApi('GET', `/api/public/periods/${period.publicId}`, undefined, user)
    expect(read.body.account).toMatchObject({ email: user.email, firstName: 'Camille', phone: '0611111111' })

    const sent = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers('autre@example.test', [sessions[1]!.id], { phone: '0622222222' }), user)
    expect(sent.body).toEqual({ received: true, emailSent: false })
    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id }, select: { status: true, email: true, participant: { select: { userId: true } }, availabilities: { select: { sessionId: true } } } })
    expect(registration).toMatchObject({ status: 'received', email: user.email, participant: { userId: user.id }, availabilities: [{ sessionId: sessions[1]!.id }] })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBe('0622222222')
    expect(await prisma.registrationRequest.count({ where: { periodId: period.id } })).toBe(0)
  })
})

describe('confirmer son email et suivre son inscription (US-085)', () => {
  it('la confirmation crée la fiche et l’inscription reçue ; le lien devient le lien personnel', async () => {
    const { key, game, sessions, period } = await aliceGame({ notifyTeam: true })
    const email = `confirme-${key}@example.test`
    const { token, confirmed } = await registerAndConfirm(period.publicId, answers(email, [sessions[0]!.id, sessions[1]!.id]))
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200)
    expect(confirmed.body).toMatchObject({ status: 'received', canEdit: true, canWithdraw: true })
    expect(confirmed.body.answers.availableSessionIds.sort()).toEqual(sessions.map((session) => session.id).sort())

    const participant = await prisma.participant.findFirstOrThrow({ where: { email }, select: { id: true, name: true, gameLinks: { select: { gameId: true } } } })
    expect(participant).toMatchObject({ name: 'Lou Dupont', gameLinks: [{ gameId: game.id }] })
    expect(smtp.received.some((message) => message.to.includes('alice@example.test') && message.text.includes('Lou Dupont'))).toBe(true)

    // Une seconde ouverture ne confirme rien de plus ; le lien personnel marche
    expect((await publicApi('POST', `/api/public/registrations/${token}/confirm`)).status).toBe(404)
    expect((await publicApi('GET', `/api/public/registrations/${token}`)).body.status).toBe('received')

    // Modifier ses disponibilités, puis retirer son inscription
    const edited = await publicApi('PUT', `/api/public/registrations/${token}`, answers(email, [sessions[1]!.id]))
    expect(edited.status, JSON.stringify(edited.body)).toBe(200)
    expect(edited.body.answers.availableSessionIds).toEqual([sessions[1]!.id])
    expect((await publicApi('POST', `/api/public/registrations/${token}/withdraw`)).status).toBe(200)
    expect((await publicApi('GET', `/api/public/registrations/${token}`)).body).toMatchObject({ status: 'withdrawn', withdrawalReason: 'retracted' })

    // Désistée, elle peut revenir par le formulaire : son inscription repart
    const back = await registerAndConfirm(period.publicId, answers(email, [sessions[0]!.id], { firstName: 'Louise' }))
    expect(back.confirmed.body).toMatchObject({ status: 'received', answers: { firstName: 'Louise' } })
    expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(1)
    expect((await publicApi('GET', `/api/public/registrations/${token}`)).status).toBe(404)
  })

  it('l’équipe voit l’inscription reçue et ses disponibilités, pas une autre équipe', async () => {
    const { key, sessions, period } = await aliceGame()
    await registerAndConfirm(period.publicId, answers(`vue-${key}@example.test`, [sessions[1]!.id]))
    const list = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(list.body).toEqual([expect.objectContaining({ status: 'received', source: 'form', availabilities: [{ sessionId: sessions[1]!.id }] })])
    expect(DENIED_OR_NOT_FOUND).toContain((await api(bob, 'GET', `/api/registration-periods/${period.id}/registrations`)).status)
  })

  it('une demande non confirmée sous 7 jours est supprimée', async () => {
    const { key, sessions, period } = await aliceGame()
    await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`vieille-${key}@example.test`, [sessions[0]!.id]))
    const token = personalLinkToken(smtp.received.at(-1)!)!
    await prisma.registrationRequest.updateMany({ where: { periodId: period.id }, data: { createdAt: new Date(Date.now() - 8 * DAY) } })
    expect((await publicApi('POST', `/api/public/registrations/${token}/confirm`)).status).toBe(404)
    await publicApi('POST', '/api/auth/login', { email: 'personne@example.test', password: 'mauvais' })
    expect(await prisma.registrationRequest.count({ where: { periodId: period.id } })).toBe(0)
  })
})

describe('page publique : sessions à venir et lien d’inscription (US-086)', () => {
  it('rien par défaut ; cochés, les sessions visibles et le lien des périodes ouvertes en mode formulaire', async () => {
    const { game, sessions, period } = await aliceGame()
    await prisma.game.update({ where: { id: game.id }, data: { publicPage: true } })
    const before = await publicApi('GET', `/api/public/games/${game.slug}`)
    expect(before.body).toMatchObject({ upcomingSessions: [], registrationLinks: [] })

    await prisma.session.update({ where: { id: sessions[0]!.id }, data: { published: true } })
    expect((await api(alice, 'PUT', `/api/games/${game.id}`, { publicShowSessions: true, publicShowRegistration: true })).status).toBe(200)
    const after = await publicApi('GET', `/api/public/games/${game.slug}`)
    expect(after.body.upcomingSessions).toEqual([expect.objectContaining({ name: sessions[0]!.name })])
    expect(after.body.registrationLinks).toEqual([expect.objectContaining({ url: expect.stringContaining(`/i/${period.publicId}`) })])
    expect(JSON.stringify(after.body)).not.toContain(sessions[1]!.name)
  })
})
