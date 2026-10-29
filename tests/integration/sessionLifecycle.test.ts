// EPIC-004 : écarts de SPEC-004 (casting, versions, visibilité, cycle de vie d'une session)
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

// Un jeu d'Alice avec une session, deux PJ, un PNJ et deux personnes liées au jeu
async function aliceSession(options: { singlePjPerParticipant?: boolean } = {}) {
  const key = `cycle-${++counter}`
  const game = await prisma.game.create({
    data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, singlePjPerParticipant: options.singlePjPerParticipant ?? true }
  })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const character = (name: string, type: 'pj' | 'pnj') => prisma.character.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id, type } })
  const [aube, brume, garde] = await Promise.all([character('Aube', 'pj'), character('Brume', 'pj'), character('Garde', 'pnj')])
  const person = (name: string) => prisma.participant.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
  })
  const [lea, noe] = await Promise.all([person('Lea'), person('Noe')])
  return { key, game, session, aube, brume, garde, lea, noe }
}

function castBody(s: Awaited<ReturnType<typeof aliceSession>>, assignments: Array<{ characterId: string, participantId: string }>, participants: Array<{ participantId: string, role: string }> = []) {
  return { name: s.session.name, gameId: s.game.id, status: 'scheduled', participants, assignments }
}

describe('un seul PJ par participant (US-017)', () => {
  it('refuse deux PJ au même participant quand le jeu le demande', async () => {
    const s = await aliceSession()
    const response = await api(alice, 'PUT', `/api/sessions/${s.session.id}`, castBody(s, [
      { characterId: s.aube.id, participantId: s.lea.id },
      { characterId: s.brume.id, participantId: s.lea.id }
    ]))
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.body)).toContain(s.lea.name)
  })

  it('accepte plusieurs PJ dans un jeu en plusieurs actes, et plusieurs PNJ partout (témoins)', async () => {
    const actes = await aliceSession({ singlePjPerParticipant: false })
    expect((await api(alice, 'PUT', `/api/sessions/${actes.session.id}`, castBody(actes, [
      { characterId: actes.aube.id, participantId: actes.lea.id },
      { characterId: actes.brume.id, participantId: actes.lea.id }
    ]))).status).toBe(200)

    const s = await aliceSession()
    const pnj2 = await prisma.character.create({ data: { name: `Garde 2 ${s.key}`, slug: `garde-2-${s.key}`, gameId: s.game.id, type: 'pnj' } })
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}`, castBody(s, [
      { characterId: s.aube.id, participantId: s.lea.id },
      { characterId: s.garde.id, participantId: s.noe.id },
      { characterId: pnj2.id, participantId: s.noe.id }
    ], [{ participantId: s.noe.id, role: 'npc' }]))).status).toBe(200)
  })

  it('se règle sur la fiche du jeu', async () => {
    const s = await aliceSession()
    expect((await api(alice, 'PUT', `/api/games/${s.game.id}`, { singlePjPerParticipant: false })).status).toBe(200)
    expect(await prisma.game.findUniqueOrThrow({ where: { id: s.game.id }, select: { singlePjPerParticipant: true } })).toEqual({ singlePjPerParticipant: false })
  })
})
