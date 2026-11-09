// US-183 : sessions de la personne sur sa fiche (SPEC-007, R1c)
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf } from './api'
import { createTestPrisma } from './db'
import type { SessionStatus } from '~/generated/prisma/enums'

const world = inject('world')
const { alice, bob } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

type Sessions = ApiResponse<'/api/participants/:id/sessions'>

describe('sessions de la fiche', () => {
  it('liste ses rôles et personnages dans mes jeux, par date, sans les sessions d’une autre équipe', async () => {
    const key = `sessions-fiche-${++counter}`
    const mine = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const other = await prisma.game.create({ data: { title: `Autre ${key}`, slug: `autre-${key}`, description: '', ownerId: bob.id } })
    const participant = await prisma.participant.create({
      data: { name: `Zoé ${key}`, slug: `zoe-${key}`, gameLinks: { create: [{ gameId: mine.id }, { gameId: other.id }] } }
    })
    const session = (gameId: string, name: string, date: Date | null, status: SessionStatus = 'scheduled') =>
      prisma.session.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId, date, status } })
    const [later, past, undated, bobs] = await Promise.all([
      session(mine.id, 'Printemps', new Date('2099-04-01T09:00:00Z')),
      session(mine.id, 'Passée', new Date('2020-04-01T09:00:00Z'), 'cancelled'),
      session(mine.id, 'Sansdate', null),
      session(other.id, 'Bob', new Date('2099-05-01T09:00:00Z'))
    ])
    const character = await prisma.character.create({ data: { name: `Aélis ${key}`, slug: `aelis-${key}`, gameId: mine.id } })
    await prisma.sessionParticipant.createMany({
      data: [
        { sessionId: later!.id, participantId: participant.id, role: 'participant' },
        { sessionId: past!.id, participantId: participant.id, role: 'npc' },
        { sessionId: undated!.id, participantId: participant.id, role: 'kitchen' },
        { sessionId: bobs!.id, participantId: participant.id, role: 'participant' }
      ]
    })
    await prisma.sessionAssignment.create({ data: { sessionId: later!.id, characterId: character.id, participantId: participant.id } })

    const response = await api(alice, 'GET', `/api/participants/${participant.id}/sessions`)
    expect(response.status).toBe(200)
    const sessions = bodyOf<Sessions>(response)
    expect(sessions.map((row) => row.id)).toEqual([past!.id, later!.id, undated!.id])
    expect(sessions[1]).toMatchObject({ slug: later!.slug, gameId: mine.id, roles: ['participant'], characters: [character.name] })
    expect(sessions[0]).toMatchObject({ status: 'cancelled', roles: ['npc'], characters: [] })

    // Témoin : Bob voit la sienne
    const forBob = bodyOf<Sessions>(await api(bob, 'GET', `/api/participants/${participant.id}/sessions`))
    expect(forBob.map((row) => row.id)).toEqual([bobs!.id])
  })
})
