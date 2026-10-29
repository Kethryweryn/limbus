// EPIC-015 : fiches rattachées au compte (US-070), espace « Je participe » (US-071), réponse depuis le compte (US-072),
// espaces du sélecteur (US-073)
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const world = inject('world')
const { alice, bob } = world.users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

const key = () => `participe-${++counter}`
const account = (name: string, data: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${name}@example.test`, name, password: 'non-utilise', ...data } })

// Un jeu d'Alice, une session avec un tarif, et une fiche à l'adresse donnée, inscrite et castée dans la session
async function aliceGameWith(email: string) {
  const k = key()
  const game = await prisma.game.create({ data: { title: `Jeu ${k}`, slug: `jeu-${k}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${k}`, slug: `session-${k}`, gameId: game.id, paymentLinkUrl: 'https://paiement.example.test' } })
  await prisma.sessionTariff.create({ data: { sessionId: session.id, name: 'Plein tarif', amountCents: 8000, defaultRole: 'pj' } })
  const character = await prisma.character.create({ data: { name: `Secret ${k}`, slug: `secret-${k}`, gameId: game.id } })
  const participant = await prisma.participant.create({ data: { name: `Joueuse ${k}`, slug: `joueuse-${k}`, email, gameLinks: { create: { gameId: game.id, notes: 'Note de l’équipe' } } } })
  await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
  await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id } })
  return { game, session, character, participant }
}

describe('rattachement des fiches (US-070)', () => {
  it('une fiche créée ou modifiée suit le compte confirmé de son adresse', async () => {
    const user = await account(key())
    const game = await prisma.game.create({ data: { title: `Jeu ${key()}`, slug: `jeu-${key()}`, description: '', ownerId: alice.id } })
    const created = await api(alice, 'POST', '/api/participants', { name: 'Rattachée', email: user.email.toUpperCase(), gameIds: [game.id] })
    expect(created.status).toBe(200)
    const id = (created.body as { id: string }).id
    expect((await prisma.participant.findUniqueOrThrow({ where: { id } })).userId).toBe(user.id)

    expect((await api(alice, 'PUT', `/api/participants/${id}`, { name: 'Rattachée', email: 'personne@example.test', gameIds: [game.id] })).status).toBe(200)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id } })).userId).toBeNull()
  })

  it('un compte non confirmé ne reçoit pas de fiche ; sa confirmation les rattache', async () => {
    const email = `${key()}@example.test`
    const { participant } = await aliceGameWith(email)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).userId).toBeNull()

    const sent = smtp.received.length
    await api(null, 'POST', '/api/auth/signup', { name: 'Joueuse', email, password: 'mot-de-passe-solide' }, { headers: { 'x-forwarded-for': `10.15.0.${counter}` } })
    const token = smtp.received.slice(sent).find((message) => message.to.includes(email))!.text.match(/\/acces\/confirmer\/([\w-]+)/)![1]
    expect((await api(null, 'POST', '/api/auth/confirm', { token })).status).toBe(200)
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).userId).toBe(user.id)
  })
})

describe('espace « Je participe » (US-071)', () => {
  it('montre ses jeux, sessions et paiements, sans personnage, notes ni autres personnes', async () => {
    const user = await account(key())
    const { game, session, participant } = await aliceGameWith(user.email)
    await prisma.participant.update({ where: { id: participant.id }, data: { userId: user.id } })
    // Une autre personne dans la même session
    const other = await prisma.participant.create({ data: { name: 'Autre personne', slug: `autre-${key()}`, email: 'autre@example.test', gameLinks: { create: { gameId: game.id } } } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: other.id, role: 'participant' } })

    const response = await api(user, 'GET', '/api/me/participations')
    expect(response.status).toBe(200)
    const body = response.body as Array<{ game: { id: string }, sessions: Array<{ id: string, roles: string[], payment: { dueCents: number, remainingCents: number, paymentLinkUrl: string } }> }>
    const entry = body.find((item) => item.game.id === game.id)!
    expect(entry.sessions).toHaveLength(1)
    expect(entry.sessions[0]).toMatchObject({ id: session.id, roles: ['participant'], payment: { dueCents: 8000, remainingCents: 8000, paymentLinkUrl: 'https://paiement.example.test' } })
    const text = JSON.stringify(body)
    expect(text).not.toContain('Secret')
    expect(text).not.toContain('Note de l’équipe')
    expect(text).not.toContain('Autre personne')
  })

  it('un compte sans fiche n’a rien ; le RIB n’est servi qu’à une fiche qui doit payer', async () => {
    const stranger = await account(key())
    expect((await api(stranger, 'GET', '/api/me/participations')).body).toEqual([])
    const user = await account(key())
    const { session, participant } = await aliceGameWith(user.email)
    await prisma.participant.update({ where: { id: participant.id }, data: { userId: user.id } })
    // RIB externe : pas de fichier à servir, mais la route ne le révèle pas à un autre compte
    expect((await api(stranger, 'GET', `/api/me/sessions/${session.id}/rib`)).status).toBe(404)
  })
})

describe('répondre depuis son compte (US-072)', () => {
  async function invited() {
    const user = await account(key())
    const k = key()
    const game = await prisma.game.create({ data: { title: `Jeu ${k}`, slug: `jeu-${k}`, description: '', ownerId: bob.id } })
    const participant = await prisma.participant.create({ data: { name: 'Camille Invitée', slug: `camille-${k}`, email: user.email, userId: user.id, gameLinks: { create: { gameId: game.id } } } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, name: `Période ${k}`, publicId: `periode-${k}`, state: 'open' } })
    const registration = await prisma.registration.create({
      data: { periodId: period.id, participantId: participant.id, status: 'invited', source: 'invitation', email: user.email, responseDueAt: new Date(Date.now() + 86_400_000) }
    })
    return { user, registration }
  }

  it('accepte, modifie puis se désiste ; une autre personne ne voit pas l’inscription', async () => {
    const { user, registration } = await invited()
    const listed = (await api(user, 'GET', '/api/me/participations')).body as Array<{ registrations: Array<{ id: string, canAccept: boolean }> }>
    expect(listed.flatMap((item) => item.registrations).find((item) => item.id === registration.id)).toMatchObject({ canAccept: true })

    const stranger = await account(key())
    expect((await api(stranger, 'GET', `/api/me/registrations/${registration.id}`)).status).toBe(404)
    expect((await api(stranger, 'POST', `/api/me/registrations/${registration.id}/decline`)).status).toBe(404)

    const answers = { email: user.email, firstName: 'Camille', lastName: 'Invitée', phone: '0600000000', emergencyContactName: 'Proche', emergencyContactPhone: '0611111111', charterAccepted: true }
    const accepted = await api(user, 'PUT', `/api/me/registrations/${registration.id}`, answers)
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200)
    expect(accepted.body).toMatchObject({ status: 'confirmed', canWithdraw: true })

    expect((await api(user, 'POST', `/api/me/registrations/${registration.id}/withdraw`)).body).toMatchObject({ status: 'withdrawn' })
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).withdrawnAt).not.toBeNull()
  })

  it('décline une invitation', async () => {
    const { user, registration } = await invited()
    expect((await api(user, 'POST', `/api/me/registrations/${registration.id}/decline`)).body).toMatchObject({ status: 'withdrawn' })
  })
})

describe('espaces du sélecteur (US-073)', () => {
  it('dit si le compte organise et s’il participe', async () => {
    const user = await account(key())
    expect((await api(user, 'GET', '/api/auth/me')).body).toMatchObject({ spaces: { organize: false, participate: false } })
    const { participant } = await aliceGameWith(user.email)
    await prisma.participant.update({ where: { id: participant.id }, data: { userId: user.id } })
    expect((await api(user, 'GET', '/api/auth/me')).body).toMatchObject({ spaces: { organize: false, participate: true } })
    expect((await api(alice, 'GET', '/api/auth/me')).body).toMatchObject({ spaces: { organize: true } })
  })
})
