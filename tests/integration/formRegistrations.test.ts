// Le questionnaire public du vivier (US-084, US-085, US-163, R2, R7), et la page publique (US-086)
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, tokenFor, type WithField } from './api'
import { createTestPrisma } from './db'
import { triggerPurge } from './purge'
import { personalLinkToken, startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const { alice, bob } = inject('world').users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0
const DAY = 24 * 60 * 60 * 1000

type PublicPeriod = ApiResponse<'/api/public/periods/:publicId'>
type PersonalRegistration = WithField<ApiResponse<'/api/public/registrations/:token'>, 'answers'>
type PublicGame = WithField<ApiResponse<'/api/public/games/:slug'>, 'upcomingSessions'>

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
  if (cookieUser) headers.cookie = `__Host-limbus_token=${tokenFor(cookieUser)}`
  const response = await fetch(`${inject('baseUrl')}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await response.text()
  let parsed: unknown = text
  try { parsed = JSON.parse(text) } catch { /* texte brut */ }
  return { status: response.status, body: parsed }
}

const standardFields = {
  lastName: { asked: true, required: false },
  firstName: { asked: true, required: true },
  facebookName: { asked: false, required: false },
  phone: { asked: true, required: false },
  // Toujours demandés (US-181)
  emergencyContact: { asked: true, required: true },
  dietary: { asked: true, required: false }
}

// Un jeu d'Alice avec deux sessions et un formulaire enregistré
async function aliceGame(options: { notifyTeam?: boolean } = {}) {
  const key = `formulaire-public-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, noteIntention: 'Jeu de cape et d’épée.' } })
  const sessions = await Promise.all([1, 2].map((index) => prisma.session.create({
    data: { name: `Session ${index} ${key}`, slug: `session-${index}-${key}`, gameId: game.id, date: new Date(Date.now() + (10 + index) * DAY) }
  })))
  expect((await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields, affinities: { wantWith: { asked: true, required: false } } })).status).toBe(200)
  const created = await api(alice, 'POST', '/api/registration-periods', { gameId: game.id, state: 'open', notifyTeam: options.notifyTeam ?? false })
  expect(created.status, JSON.stringify(created.body)).toBe(200)
  const period = created.body as { id: string, publicId: string }
  for (const session of sessions) {
    expect((await api(alice, 'PUT', `/api/registration-periods/${period.id}/sessions/${session.id}`, { open: true })).status).toBe(200)
  }
  return { key, game, sessions, period }
}

const answers = (email: string, sessionIds: string[], extra: Record<string, unknown> = {}) => ({
  email, firstName: 'Lou', lastName: 'Dupont', phone: '0600000000', emergencyContactName: 'Paul Secours', emergencyContactPhone: '0699999999', charterAccepted: true,
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

const DENIED_OR_NOT_FOUND = [403, 404]

describe('formulaire public (US-084)', () => {
  it('montre le jeu, les sessions ouvertes et le formulaire ; brouillon : lien inconnu ; fermé : inscriptions closes (R2)', async () => {
    const { game, sessions, period } = await aliceGame()
    const read = await publicApi('GET', `/api/public/periods/${period.publicId}`)
    expect(read.status).toBe(200)
    expect(read.body).toMatchObject({ state: 'open', game: { title: game.title }, account: null })
    expect(bodyOf<PublicPeriod>(read).sessions.map((session) => session.id)).toEqual(sessions.map((session) => session.id))
    expect(JSON.stringify(read.body)).not.toContain(alice.id)

    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { state: 'draft' } })
    expect((await publicApi('GET', `/api/public/periods/${period.publicId}`)).status).toBe(404)
    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { state: 'closed' } })
    expect(bodyOf<PublicPeriod>(await publicApi('GET', `/api/public/periods/${period.publicId}`)).state).toBe('closed')
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

  it('accepte sans disponibilité (R7), refuse une session inconnue ; le champ piège ne crée rien', async () => {
    const { key, sessions, period } = await aliceGame()
    const none = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`a-${key}@example.test`, []))
    expect(none.status, JSON.stringify(none.body)).toBe(200)
    expect((await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`b-${key}@example.test`, ['inconnue']))).status).toBe(400)

    const trapped = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`robot-${key}@example.test`, [sessions[0]!.id], { website: 'http://spam.example' }))
    expect(trapped.body).toEqual({ received: false, emailSent: true })
    expect(await prisma.registrationRequest.count({ where: { email: `robot-${key}@example.test` } })).toBe(0)
  })

  it('une session annulée, passée ou pas ouverte n’est pas proposée', async () => {
    const { key, sessions, period } = await aliceGame()
    await prisma.session.update({ where: { id: sessions[1]!.id }, data: { status: 'cancelled' } })
    await prisma.session.create({ data: { name: `Pas ouverte ${key}`, slug: `pas-ouverte-${key}`, gameId: sessions[0]!.gameId, date: new Date(Date.now() + 30 * DAY) } })
    const read = await publicApi('GET', `/api/public/periods/${period.publicId}`)
    expect(bodyOf<PublicPeriod>(read).sessions.map((session) => session.id)).toEqual([sessions[0]!.id])
    expect((await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`annulee-${key}@example.test`, [sessions[1]!.id]))).status).toBe(400)
  })

  it('une personne connectée est inscrite aussitôt, avec l’adresse de son compte', async () => {
    const { key, sessions, period } = await aliceGame()
    const user = await prisma.user.create({ data: { email: `connectee-${key}@example.test`, name: 'Camille Connectée', password: 'non-utilise', phone: '0611111111' } })
    const read = await publicApi('GET', `/api/public/periods/${period.publicId}`, undefined, user)
    expect(bodyOf<PublicPeriod>(read).account).toMatchObject({ email: user.email, firstName: 'Camille', phone: '0611111111' })

    const sent = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers('autre@example.test', [sessions[1]!.id], { phone: '0622222222' }), user)
    expect(sent.body).toEqual({ received: true, emailSent: false })
    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id }, select: { status: true, email: true, participant: { select: { userId: true } }, sessionLines: { select: { sessionId: true, status: true, answer: true } } } })
    expect(registration).toMatchObject({ status: 'received', email: user.email, participant: { userId: user.id }, sessionLines: [{ sessionId: sessions[1]!.id, status: 'preregistered', answer: 'available' }] })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBe('0622222222')
    expect(await prisma.registrationRequest.count({ where: { periodId: period.id } })).toBe(0)

    // Déjà dans le vivier : une seule ligne, qui prend les nouvelles réponses, et une place acquise ne bouge pas
    await prisma.registrationSession.updateMany({ where: { sessionId: sessions[1]!.id }, data: { status: 'confirmed' } })
    const again = await publicApi('POST', `/api/public/periods/${period.publicId}`, answers('autre@example.test', [sessions[0]!.id, sessions[1]!.id], { phone: '0633333333' }), user)
    expect(again.body).toEqual({ received: true, emailSent: false })
    expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(1)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBe('0633333333')
    expect(await prisma.registrationSession.findMany({ where: { sessionId: { in: sessions.map((session) => session.id) } }, select: { sessionId: true, status: true }, orderBy: { status: 'asc' } }))
      .toEqual([{ sessionId: sessions[1]!.id, status: 'confirmed' }, { sessionId: sessions[0]!.id, status: 'preregistered' }])
  })
})

describe('confirmer son email et suivre son inscription (US-085)', () => {
  it('la confirmation crée la fiche et l’inscription reçue ; le lien devient le lien personnel', async () => {
    const { key, game, sessions, period } = await aliceGame({ notifyTeam: true })
    const email = `confirme-${key}@example.test`
    const { token, confirmed } = await registerAndConfirm(period.publicId, answers(email, [sessions[0]!.id, sessions[1]!.id]))
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200)
    expect(confirmed.body).toMatchObject({ status: 'received', canEdit: true, canLeave: true })
    expect(bodyOf<PersonalRegistration>(confirmed).answers.availableSessionIds.sort()).toEqual(sessions.map((session) => session.id).sort())

    const participant = await prisma.participant.findFirstOrThrow({ where: { email }, select: { id: true, name: true, gameLinks: { select: { gameId: true } } } })
    expect(participant).toMatchObject({ name: 'Lou Dupont', gameLinks: [{ gameId: game.id }] })
    await expect.poll(() => smtp.received.some((message) => message.to.includes('alice@example.test') && message.text.includes('Lou Dupont'))).toBe(true)

    // Une seconde ouverture ne confirme rien de plus ; le lien personnel marche
    expect((await publicApi('POST', `/api/public/registrations/${token}/confirm`)).status).toBe(404)
    expect(bodyOf<PersonalRegistration>(await publicApi('GET', `/api/public/registrations/${token}`)).status).toBe('received')

    // Modifier ses disponibilités, puis quitter le vivier
    const edited = await publicApi('PUT', `/api/public/registrations/${token}`, answers(email, [sessions[1]!.id]))
    expect(edited.status, JSON.stringify(edited.body)).toBe(200)
    expect(bodyOf<PersonalRegistration>(edited).answers.availableSessionIds).toEqual([sessions[1]!.id])
    expect((await publicApi('POST', `/api/public/registrations/${token}/withdraw`)).status).toBe(200)
    expect((await publicApi('GET', `/api/public/registrations/${token}`)).status).toBe(404)

    // Sortie, elle peut revenir par le formulaire (R5)
    const back = await registerAndConfirm(period.publicId, answers(email, [sessions[0]!.id], { firstName: 'Louise' }))
    expect(back.confirmed.body).toMatchObject({ status: 'received', answers: { firstName: 'Louise' } })
    expect(await prisma.registration.count({ where: { periodId: period.id } })).toBe(1)
  })

  it('l’équipe voit l’inscription reçue et ses disponibilités, pas une autre équipe', async () => {
    const { key, sessions, period } = await aliceGame()
    await registerAndConfirm(period.publicId, answers(`vue-${key}@example.test`, [sessions[1]!.id]))
    const list = await api(alice, 'GET', `/api/registration-periods/${period.id}/registrations`)
    expect(list.body).toEqual([expect.objectContaining({ status: 'received', source: 'form', sessionLines: [expect.objectContaining({ sessionId: sessions[1]!.id, status: 'preregistered' })] })])
    expect(DENIED_OR_NOT_FOUND).toContain((await api(bob, 'GET', `/api/registration-periods/${period.id}/registrations`)).status)
  })

  it('une demande non confirmée sous 7 jours est supprimée', async () => {
    const { key, sessions, period } = await aliceGame()
    await publicApi('POST', `/api/public/periods/${period.publicId}`, answers(`vieille-${key}@example.test`, [sessions[0]!.id]))
    const token = personalLinkToken(smtp.received.at(-1)!)!
    await prisma.registrationRequest.updateMany({ where: { periodId: period.id }, data: { createdAt: new Date(Date.now() - 8 * DAY) } })
    expect((await publicApi('POST', `/api/public/registrations/${token}/confirm`)).status).toBe(404)
    await triggerPurge(prisma)
    expect(await prisma.registrationRequest.count({ where: { periodId: period.id } })).toBe(0)
  })
})

describe('page publique : sessions à venir et lien d’inscription (US-086)', () => {
  it('rien par défaut ; cochés, les sessions visibles et le lien du vivier ouvert', async () => {
    const { game, sessions, period } = await aliceGame()
    await prisma.game.update({ where: { id: game.id }, data: { publicPage: true } })
    const before = await publicApi('GET', `/api/public/games/${game.slug}`)
    expect(before.body).toMatchObject({ upcomingSessions: [], registrationLinks: [] })

    await prisma.session.update({ where: { id: sessions[0]!.id }, data: { published: true } })
    expect((await api(alice, 'PUT', `/api/games/${game.id}`, { publicShowSessions: true, publicShowRegistration: true })).status).toBe(200)
    const after = await publicApi('GET', `/api/public/games/${game.slug}`)
    expect(bodyOf<PublicGame>(after).upcomingSessions).toEqual([expect.objectContaining({ name: sessions[0]!.name })])
    expect(bodyOf<PublicGame>(after).registrationLinks).toEqual([expect.objectContaining({ url: expect.stringContaining(`/i/${period.publicId}`) })])
    expect(JSON.stringify(after.body)).not.toContain(sessions[1]!.name)
  })
})
