// US-176 (R20, R31 de SPEC-018) : un joueur entre dans une session par le vivier ; l'équipe s'ajoute à la main
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, errorMessage } from './api'
import { createTestPrisma } from './db'
import { addPerson, createPool, lineOf, type Pool } from './pool'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

type Line = { characterId: string, participantId?: string | null, reservedRegistrationId?: string | null }
type Member = { participantId: string, role: string }
type SavedSession = ApiResponse<'/api/sessions/:id', 'put'>

async function castPool(options: Parameters<typeof createPool>[2] = {}) {
  const pool = await createPool(prisma, alice.id, { key: 'cast', sessions: 1, seats: 2, ...options })
  const characters = await prisma.character.findMany({ where: { gameId: pool.game.id }, orderBy: { name: 'asc' } })
  return { ...pool, session: pool.sessions[0]!, characters }
}

// Une personne du jeu, hors du vivier
async function outsider(pool: Pool, name: string) {
  const slug = `${name.toLowerCase()}-${++counter}-${pool.key}`
  return await prisma.participant.create({ data: { name, slug, email: `${slug}@example.test`, gameLinks: { create: { gameId: pool.game.id } } } })
}

async function saveCast(pool: Pool, sessionId: string, assignments: Line[], participants: Member[] = []) {
  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } })
  return await api(alice, 'PUT', `/api/sessions/${sessionId}`, { name: session.name, gameId: pool.game.id, participants, assignments }, { headers: { 'if-unmodified-since': session.updatedAt.toISOString() } })
}

const rows = (sessionId: string) => prisma.sessionParticipant.findMany({ where: { sessionId }, select: { participantId: true, role: true } })
const castLine = (sessionId: string, characterId: string) => prisma.sessionAssignment.findUnique({ where: { sessionId_characterId: { sessionId, characterId } }, select: { participantId: true, reservedRegistrationId: true } })

describe('joueur hors du vivier (R31)', () => {
  it('refuse une personne hors du vivier, comme personnage comme joueuse, et à la création d’une session', async () => {
    const pool = await castPool()
    const zoe = await outsider(pool, 'Zoé')

    const onCharacter = await saveCast(pool, pool.session.id, [{ characterId: pool.characters[0]!.id, participantId: zoe.id }])
    expect(onCharacter.status).toBe(400)
    expect(errorMessage(onCharacter)).toContain('Zoé n’est pas dans le vivier')
    expect(errorMessage(onCharacter)).not.toContain('cuisine')

    const inTeam = await saveCast(pool, pool.session.id, [], [{ participantId: zoe.id, role: 'participant' }])
    expect(inTeam.status).toBe(400)
    expect(errorMessage(inTeam)).toContain('Zoé n’est pas dans le vivier')

    const created = await api(alice, 'POST', '/api/sessions', { name: 'Avec un joueur', gameId: pool.game.id, participants: [{ participantId: zoe.id, role: 'participant' }] })
    expect(created.status).toBe(400)
    expect(await rows(pool.session.id)).toEqual([])
  })

  it('refuse une personne invitée sans réponse, ou sortie du vivier', async () => {
    const pool = await castPool()
    const invited = await addPerson(prisma, pool, 'Invitée', [], { status: 'invited' })
    const left = await addPerson(prisma, pool, 'Sortie', [], { status: 'withdrawn' })
    for (const { participantId } of [invited, left]) {
      const result = await saveCast(pool, pool.session.id, [{ characterId: pool.characters[0]!.id, participantId }])
      expect(result.status).toBe(400)
      expect(errorMessage(result)).toContain('n’est pas dans le vivier')
    }
  })

  it('refuse une personne du vivier sans place, posée directement : elle est d’abord retenue', async () => {
    const pool = await castPool()
    const lea = await addPerson(prisma, pool, 'Léa', [pool.session.id])
    const result = await saveCast(pool, pool.session.id, [{ characterId: pool.characters[0]!.id, participantId: lea.participantId }])
    expect(result.status).toBe(400)
    expect(errorMessage(result)).toContain('retenez cette personne')
    expect((await lineOf(prisma, lea.id, pool.session.id))?.status).toBe('preregistered')
  })

  it('accepte une personne inscrite à la session, et garde un joueur déjà là, même sans réponse au questionnaire', async () => {
    const pool = await castPool()
    const inscribed = await addPerson(prisma, pool, 'Inscrite')
    await prisma.registrationSession.create({ data: { registrationId: inscribed.id, sessionId: pool.session.id, status: 'confirmed' } })
    const former = await outsider(pool, 'Ancienne')
    await prisma.sessionParticipant.create({ data: { sessionId: pool.session.id, participantId: former.id, role: 'participant' } })

    const result = await saveCast(pool, pool.session.id, [
      { characterId: pool.characters[0]!.id, participantId: inscribed.participantId },
      { characterId: pool.characters[1]!.id, participantId: former.id }
    ], [{ participantId: former.id, role: 'participant' }])
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    expect(await rows(pool.session.id)).toEqual(expect.arrayContaining([
      { participantId: inscribed.participantId, role: 'participant' },
      { participantId: former.id, role: 'participant' }
    ]))
  })

  it('la cuisine ne tient pas un PJ sans passer par le vivier ; une orga, si', async () => {
    const pool = await castPool()
    const cook = await outsider(pool, 'Cuisine')
    const organizer = await outsider(pool, 'Orga')
    const characterId = pool.characters[0]!.id

    const refused = await saveCast(pool, pool.session.id, [{ characterId, participantId: cook.id }], [{ participantId: cook.id, role: 'kitchen' }])
    expect(refused.status).toBe(400)
    expect(errorMessage(refused)).toContain('Cuisine n’est pas dans le vivier')

    const accepted = await saveCast(pool, pool.session.id, [{ characterId, participantId: organizer.id }], [{ participantId: organizer.id, role: 'organizer' }])
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200)
    expect(await rows(pool.session.id)).toEqual([{ participantId: organizer.id, role: 'organizer' }])
  })

  it('ajoute à la main un PNJ, la cuisine et une orga, et un PNJ peut reprendre un personnage de joueur', async () => {
    const pool = await castPool()
    const npc = await outsider(pool, 'Pnj')
    const cook = await outsider(pool, 'Cuisine')
    const organizer = await outsider(pool, 'Orga')
    const team = [{ participantId: npc.id, role: 'npc' }, { participantId: cook.id, role: 'kitchen' }, { participantId: organizer.id, role: 'organizer' }]

    const result = await saveCast(pool, pool.session.id, [{ characterId: pool.characters[0]!.id, participantId: npc.id }], team)
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    expect(await rows(pool.session.id)).toEqual(expect.arrayContaining(team))
    expect(await rows(pool.session.id)).toHaveLength(3)
    expect(await castLine(pool.session.id, pool.characters[0]!.id)).toEqual({ participantId: npc.id, reservedRegistrationId: null })
    // Sans statut de parcours
    expect(await prisma.registration.count({ where: { participantId: { in: [npc.id, cook.id, organizer.id] } } })).toBe(0)
  })
})

describe('choisir une personne du vivier dans le cast (R20)', () => {
  it('la retient et lui réserve le personnage, sans la faire entrer dans la session ; « pas disponible » aussi', async () => {
    const pool = await castPool()
    const lea = await addPerson(prisma, pool, 'Léa', [pool.session.id])
    const max = await addPerson(prisma, pool, 'Max')
    await prisma.registrationSession.create({ data: { registrationId: max.id, sessionId: pool.session.id, status: 'unavailable', answer: 'unavailable' } })

    const result = await saveCast(pool, pool.session.id, [
      { characterId: pool.characters[0]!.id, reservedRegistrationId: lea.id },
      { characterId: pool.characters[1]!.id, reservedRegistrationId: max.id }
    ])
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    expect(await lineOf(prisma, lea.id, pool.session.id)).toMatchObject({ status: 'retained', retainedById: alice.id, announcedStatus: null })
    expect(await lineOf(prisma, max.id, pool.session.id)).toMatchObject({ status: 'retained', answer: 'unavailable' })
    expect(await castLine(pool.session.id, pool.characters[0]!.id)).toEqual({ participantId: null, reservedRegistrationId: lea.id })
    expect(await rows(pool.session.id)).toEqual([])
    expect(bodyOf<SavedSession>(result).retainedRegistrations.map((registration) => registration.id).sort()).toEqual([lea.id, max.id].sort())
    expect(bodyOf<SavedSession>(result).poolRegistrations).toEqual([])
  })

  it('n’écrit rien si la session n’a pas assez de places', async () => {
    const pool = await castPool({ seats: 2 })
    const first = await addPerson(prisma, pool, 'Première', [pool.session.id])
    const second = await addPerson(prisma, pool, 'Deuxième', [pool.session.id])
    const taken = await addPerson(prisma, pool, 'Déjà là')
    await prisma.registrationSession.create({ data: { registrationId: taken.id, sessionId: pool.session.id, status: 'retained' } })

    const result = await saveCast(pool, pool.session.id, [
      { characterId: pool.characters[0]!.id, reservedRegistrationId: first.id },
      { characterId: pool.characters[1]!.id, reservedRegistrationId: second.id }
    ])
    expect(result.status).toBe(409)
    expect(errorMessage(result)).toContain('est complète')
    expect((await lineOf(prisma, first.id, pool.session.id))?.status).toBe('preregistered')
    expect((await lineOf(prisma, second.id, pool.session.id))?.status).toBe('preregistered')
    expect(await castLine(pool.session.id, pool.characters[0]!.id)).toBeNull()
  })

  it('suit le mode de la session : au hasard, on tire d’abord', async () => {
    const pool = await castPool({ selection: { selectionMode: 'random' } })
    const lea = await addPerson(prisma, pool, 'Léa', [pool.session.id])
    const result = await saveCast(pool, pool.session.id, [{ characterId: pool.characters[0]!.id, reservedRegistrationId: lea.id }])
    expect(result.status).toBe(409)
    expect(errorMessage(result)).toContain('au hasard')
  })

  it('une réservation devenue caduque ne retient personne de nouveau', async () => {
    const pool = await castPool()
    const lea = await addPerson(prisma, pool, 'Léa', [pool.session.id])
    const characterId = pool.characters[0]!.id
    await saveCast(pool, pool.session.id, [{ characterId, reservedRegistrationId: lea.id }])
    // Sortie de la sélection pendant que le formulaire restait ouvert : il renvoie la même réservation
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lea.id, sessionId: pool.session.id } }, data: { status: 'preregistered', retainedById: null } })

    const result = await saveCast(pool, pool.session.id, [{ characterId, reservedRegistrationId: lea.id }])
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    expect((await lineOf(prisma, lea.id, pool.session.id))?.status).toBe('preregistered')
    expect(await castLine(pool.session.id, characterId)).toEqual({ participantId: null, reservedRegistrationId: null })
  })

  it('liste le vivier avec le statut de chacun, sans l’équipe ni les places prises, et signale qui a déjà joué', async () => {
    const pool = await castPool({ replayPolicy: 'flagged' })
    const preregistered = await addPerson(prisma, pool, 'Anna', [pool.session.id])
    const interested = await addPerson(prisma, pool, 'Bea')
    const seated = await addPerson(prisma, pool, 'Cora')
    await prisma.registrationSession.create({ data: { registrationId: seated.id, sessionId: pool.session.id, status: 'retained' } })
    const inTeam = await addPerson(prisma, pool, 'Dora')
    await prisma.sessionParticipant.create({ data: { sessionId: pool.session.id, participantId: inTeam.participantId, role: 'npc' } })
    await addPerson(prisma, pool, 'Sortie', [], { status: 'withdrawn' })
    // A annulé : plus proposée tant qu'elle ne s'y redit pas disponible (R19)
    const gone = await addPerson(prisma, pool, 'Élise')
    await prisma.registrationSession.create({ data: { registrationId: gone.id, sessionId: pool.session.id, status: 'cancelled', answer: 'available' } })
    // En cuisine, elle peut encore être choisie comme joueuse
    const cook = await addPerson(prisma, pool, 'Fanny')
    await prisma.sessionParticipant.create({ data: { sessionId: pool.session.id, participantId: cook.participantId, role: 'kitchen' } })
    const past = await prisma.session.create({ data: { name: `Passée ${pool.key}`, slug: `passee-${pool.key}`, gameId: pool.game.id, status: 'completed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: past.id, participantId: interested.participantId, role: 'participant' } })

    const read = await api(alice, 'GET', `/api/sessions/${pool.session.id}`)
    const body = bodyOf<ApiResponse<'/api/sessions/:id'>>(read)
    expect(body.poolState).toBe('open')
    expect(body.poolRegistrations).toEqual([
      { id: preregistered.id, name: 'Anna', status: 'preregistered', replayer: false },
      { id: interested.id, name: 'Bea', status: 'received', replayer: true },
      { id: cook.id, name: 'Fanny', status: 'received', replayer: false }
    ])
  })

  it('ne propose personne sur une session qui n’est plus prévue, et dit quand un vivier est fermé ou absent', async () => {
    const pool = await castPool({ state: 'closed' })
    await addPerson(prisma, pool, 'Anna', [pool.session.id])
    const read = async (id: string) => bodyOf<ApiResponse<'/api/sessions/:id'>>(await api(alice, 'GET', `/api/sessions/${id}`))
    expect(await read(pool.session.id)).toMatchObject({ poolState: 'closed', poolRegistrations: [expect.objectContaining({ name: 'Anna' })] })

    await prisma.session.update({ where: { id: pool.session.id }, data: { status: 'completed' } })
    expect((await read(pool.session.id)).poolRegistrations).toEqual([])

    const bare = await prisma.game.create({ data: { title: `Sans vivier ${pool.key}`, slug: `sans-vivier-${pool.key}`, description: '', ownerId: alice.id } })
    const lone = await prisma.session.create({ data: { name: `Seule ${pool.key}`, slug: `seule-${pool.key}`, gameId: bare.id } })
    expect(await read(lone.id)).toMatchObject({ poolState: null, poolRegistrations: [] })
  })

  it('l’assistant de casting compte une personne choisie dans le formulaire, pas encore enregistrée', async () => {
    const pool = await castPool()
    const lea = await addPerson(prisma, pool, 'Léa', [pool.session.id])
    const characterId = pool.characters[0]!.id
    const result = await api(alice, 'POST', `/api/sessions/${pool.session.id}/casting-assistant`, { assignments: [{ characterId, reservedRegistrationId: lea.id, locked: true }] })
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    const body = bodyOf<ApiResponse<'/api/sessions/:id/casting-assistant', 'post'>>(result)
    expect(body.proposal.find((line) => line.characterId === characterId)).toMatchObject({ playerId: lea.participantId, reservedRegistrationId: lea.id, locked: true })
    expect((await lineOf(prisma, lea.id, pool.session.id))?.status).toBe('preregistered')
  })
})
