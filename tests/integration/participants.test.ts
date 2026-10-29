// EPIC-007 : retrait d'un jeu et fiches toujours liées à un jeu
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

// Une personne liée à deux jeux d'Alice, avec une session dans chacun
async function personInTwoGames() {
  const key = `retrait-${++counter}`
  const games = await Promise.all(['Un', 'Deux'].map((name) =>
    prisma.game.create({ data: { title: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, description: '', ownerId: alice.id } })
  ))
  const participant = await prisma.participant.create({
    data: { name: `Léa ${key}`, slug: `lea-${key}`, email: `lea-${key}@example.test`, gameLinks: { create: games.map((game) => ({ gameId: game.id })) } }
  })
  const sessions = []
  for (const game of games) {
    const character = await prisma.character.create({ data: { name: `Rôle ${game.slug}`, slug: `role-${game.slug}`, gameId: game.id } })
    const session = await prisma.session.create({ data: { name: `Session ${game.slug}`, slug: `session-${game.slug}`, gameId: game.id } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
    await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id } })
    await prisma.sessionAttendance.create({ data: { sessionId: session.id, participantId: participant.id, responseDueAt: new Date(Date.now() + 86_400_000) } })
    const period = await prisma.registrationPeriod.create({ data: { name: `Inscriptions ${game.slug}`, gameId: game.id, publicId: `periode-${game.slug}` } })
    await prisma.registration.create({
      data: { periodId: period.id, sessionId: session.id, participantId: participant.id, status: 'confirmed', source: 'invitation', email: participant.email! }
    })
    sessions.push(session)
  }
  const update = (gameIds: string[]) => api(alice, 'PUT', `/api/participants/${participant.id}`, { name: participant.name, gameIds })
  return { games, participant, sessions, update }
}

describe('retrait d’un jeu (US-035)', () => {
  it('retire la personne des sessions du jeu et marque ses inscriptions « retirée », sans toucher l’autre jeu', async () => {
    const p = await personInTwoGames()
    await prisma.sessionPayment.create({ data: { sessionId: p.sessions[0]!.id, participantId: p.participant.id, paidAt: new Date() } })

    const response = await p.update([p.games[1]!.id])
    expect(response.status, JSON.stringify(response.body)).toBe(200)

    const removed = { sessionId: p.sessions[0]!.id, participantId: p.participant.id }
    expect(await prisma.sessionParticipant.count({ where: removed })).toBe(0)
    expect(await prisma.sessionAssignment.count({ where: removed })).toBe(0)
    expect(await prisma.sessionAssignment.count({ where: { sessionId: p.sessions[0]!.id } })).toBe(1)
    expect(await prisma.sessionAttendance.count({ where: removed })).toBe(0)
    const registration = await prisma.registration.findFirstOrThrow({ where: removed })
    expect(registration).toMatchObject({ status: 'withdrawn', withdrawnById: alice.id })
    // Le paiement reste, à traiter à part
    expect(await prisma.sessionPayment.count({ where: removed })).toBe(1)

    const kept = { sessionId: p.sessions[1]!.id, participantId: p.participant.id }
    expect(await prisma.sessionParticipant.count({ where: kept })).toBe(1)
    expect(await prisma.sessionAssignment.count({ where: kept })).toBe(1)
    expect((await prisma.registration.findFirstOrThrow({ where: kept })).status).toBe('confirmed')
  })
})

describe('une fiche a toujours un jeu (US-036)', () => {
  it('refuse une création sans jeu', async () => {
    expect((await api(alice, 'POST', '/api/participants', { name: 'Sans jeu' })).status).toBe(400)
  })

  it('retirer le dernier jeu supprime la fiche, mais pas si un jeu d’une autre équipe la garde', async () => {
    const p = await personInTwoGames()
    expect((await p.update([p.games[0]!.id])).status).toBe(200)
    const last = await p.update([])
    expect(last.status, JSON.stringify(last.body)).toBe(200)
    expect(last.body).toEqual({ deleted: true })
    expect(await prisma.participant.count({ where: { id: p.participant.id } })).toBe(0)

    // Une fiche liée aussi au jeu de Bob : Alice retire son dernier jeu, la fiche reste
    const shared = await personInTwoGames()
    await prisma.participantGame.create({ data: { participantId: shared.participant.id, gameId: world.b.game.id } })
    const response = await shared.update([])
    expect(response.status).toBe(200)
    expect(response.body).not.toEqual({ deleted: true })
    expect(await prisma.participant.count({ where: { id: shared.participant.id } })).toBe(1)
  })
})

describe('`published` retiré des fiches (US-038)', () => {
  it('n’est ni accepté ni renvoyé', async () => {
    const created = await api(alice, 'POST', '/api/participants', { name: 'Sans published', gameIds: [world.a.game.id], published: false })
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    expect(created.body).not.toHaveProperty('published')
    const id = (created.body as { id: string }).id
    expect((await prisma.participant.findUniqueOrThrow({ where: { id } })).published).toBe(true)
    expect((await api(alice, 'GET', `/api/participants/${id}`)).body).not.toHaveProperty('published')
  })
})


// EPIC-014 : une note par jeu (US-069, ADR-0040)
describe('notes propres à chaque jeu (US-069)', () => {
  const { bob } = world.users

  async function sharedPerson() {
    const key = `notes-${++counter}`
    const [aliceGame, bobGame] = await Promise.all([alice, bob].map((owner) =>
      prisma.game.create({ data: { title: `Jeu ${owner.id} ${key}`, slug: `jeu-${owner.id}-${key}`.toLowerCase(), description: '', ownerId: owner.id } })
    ))
    const participant = await prisma.participant.create({
      data: {
        name: `Noé ${key}`,
        slug: `noe-${key}`,
        gameLinks: { create: [{ gameId: aliceGame!.id, notes: 'Note d’Alice' }, { gameId: bobGame!.id, notes: 'Note de Bob' }] }
      }
    })
    return { aliceGame: aliceGame!, bobGame: bobGame!, participant }
  }

  it('chaque équipe ne lit que la note de son jeu', async () => {
    const { aliceGame, bobGame, participant } = await sharedPerson()
    const forAlice = await api(alice, 'GET', `/api/participants/${participant.id}`)
    expect(forAlice.body).toMatchObject({ gameNotes: { [aliceGame.id]: 'Note d’Alice' } })
    expect(JSON.stringify(forAlice.body)).not.toContain('Note de Bob')
    // Témoin : Bob lit la sienne
    expect((await api(bob, 'GET', `/api/participants/${participant.id}`)).body).toMatchObject({ gameNotes: { [bobGame.id]: 'Note de Bob' } })
    const list = await api(alice, 'GET', '/api/participants')
    expect(JSON.stringify(list.body)).not.toContain('Note de Bob')
    const exported = await api(alice, 'GET', `/api/participants/${participant.id}/export`)
    expect(JSON.stringify(exported.body)).toContain('Note d’Alice')
    expect(JSON.stringify(exported.body)).not.toContain('Note de Bob')
  })

  it('modifier sa note ne touche pas celle de l’autre équipe ; écrire la sienne est refusé', async () => {
    const { aliceGame, bobGame, participant } = await sharedPerson()
    const updated = await api(alice, 'PUT', `/api/participants/${participant.id}`, { name: participant.name, gameIds: [aliceGame.id], gameNotes: { [aliceGame.id]: 'Nouvelle note' } })
    expect(updated.status).toBe(200)
    const links = await prisma.participantGame.findMany({ where: { participantId: participant.id }, select: { gameId: true, notes: true } })
    expect(Object.fromEntries(links.map((link) => [link.gameId, link.notes]))).toEqual({ [aliceGame.id]: 'Nouvelle note', [bobGame.id]: 'Note de Bob' })

    const refused = await api(alice, 'PUT', `/api/participants/${participant.id}`, { name: participant.name, gameIds: [aliceGame.id], gameNotes: { [bobGame.id]: 'Intrusion' } })
    expect(refused.status).toBe(403)
    expect((await prisma.participantGame.findFirstOrThrow({ where: { participantId: participant.id, gameId: bobGame.id } })).notes).toBe('Note de Bob')
  })

  it('une fiche créée reçoit la note de chacun de ses jeux', async () => {
    const game = await prisma.game.create({ data: { title: 'Jeu créé', slug: `jeu-cree-${++counter}`, description: '', ownerId: alice.id } })
    const created = await api(alice, 'POST', '/api/participants', { name: `Créée ${counter}`, gameIds: [game.id], gameNotes: { [game.id]: 'Première note' } })
    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({ gameNotes: { [game.id]: 'Première note' } })
    expect(created.body).not.toHaveProperty('notes')
  })
})
