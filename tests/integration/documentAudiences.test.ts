// US-187 : public d'un document par rôles et sélection avancée (ADR-0072, SPEC-006 R7)
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

type SessionDocuments = ApiResponse<'/api/sessions/:id/documents'>

// Une session avec chaque sorte de personne : PJ, organisatrice qui tient un PNJ, PNJ de l'équipe, cuisine, et une
// joueuse d'un groupe
async function sessionWithEveryone() {
  const key = `public-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const person = (name: string) => prisma.participant.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } } })
  const [pj, orga, npc, cook, member] = await Promise.all(['Pj', 'Orga', 'Pnj', 'Cuisine', 'Membre'].map(person))
  const faction = await prisma.faction.create({ data: { name: `Guilde ${key}`, slug: `guilde-${key}`, gameId: game.id } })
  const character = (name: string, type: string, factionId?: string) => prisma.character.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, type, gameId: game.id, ...(factionId ? { factions: { connect: { id: factionId } } } : {}) }
  })
  const [pjCharacter, pnjCharacter, memberCharacter] = await Promise.all([character('Heros', 'pj'), character('Garde', 'pnj'), character('Marchand', 'pj', faction.id)])
  await prisma.sessionAssignment.createMany({
    data: [
      { sessionId: session.id, characterId: pjCharacter.id, participantId: pj!.id },
      { sessionId: session.id, characterId: pnjCharacter.id, participantId: orga!.id },
      { sessionId: session.id, characterId: memberCharacter.id, participantId: member!.id }
    ]
  })
  await prisma.sessionParticipant.createMany({
    data: [
      { sessionId: session.id, participantId: orga!.id, role: 'organizer' },
      { sessionId: session.id, participantId: npc!.id, role: 'npc' },
      { sessionId: session.id, participantId: cook!.id, role: 'kitchen' }
    ]
  })
  return { key, game, session, faction, pjCharacter, people: { pj: pj!, orga: orga!, npc: npc!, cook: cook!, member: member! } }
}

async function recipientsOf(sessionId: string, title: string) {
  const body = bodyOf<SessionDocuments>(await api(alice, 'GET', `/api/sessions/${sessionId}/documents`))
  return body.documents.find((document) => document.title === title)!.recipients.map((recipient) => recipient.participant.name).sort()
}

describe('public d’un document', () => {
  it('écrit à chaque rôle coché : PNJ par leur rôle ou leur personnage PNJ, PJ par leur personnage PJ', async () => {
    const { key, game, session, people } = await sessionWithEveryone()
    const create = (title: string, audiences: string[]) => api(alice, 'POST', '/api/documents', { title, content: 'Texte', gameId: game.id, audiences })
    expect((await create(`PNJ ${key}`, ['npcs'])).status).toBe(200)
    await create(`PJ ${key}`, ['pjs'])
    await create(`Orga et cuisine ${key}`, ['organizers', 'kitchen'])
    await create(`Tous ${key}`, ['organizers', 'npcs', 'kitchen', 'pjs'])

    expect(await recipientsOf(session.id, `PNJ ${key}`)).toEqual([people.npc.name, people.orga.name].sort())
    expect(await recipientsOf(session.id, `PJ ${key}`)).toEqual([people.member.name, people.pj.name].sort())
    expect(await recipientsOf(session.id, `Orga et cuisine ${key}`)).toEqual([people.cook.name, people.orga.name].sort())
    // Tout le monde : chacun une seule fois, même l'organisatrice qui tient aussi un PNJ
    expect(await recipientsOf(session.id, `Tous ${key}`)).toEqual(Object.values(people).map((person) => person.name).sort())
  })

  it('ajoute la sélection avancée aux rôles, et la garde seule sans rôle', async () => {
    const { key, game, session, faction, pjCharacter, people } = await sessionWithEveryone()
    await api(alice, 'POST', '/api/documents', { title: `Cuisine et héros ${key}`, content: 'Texte', gameId: game.id, audiences: ['kitchen'], characterIds: [pjCharacter.id] })
    await api(alice, 'POST', '/api/documents', { title: `Guilde ${key}`, content: 'Texte', gameId: game.id, factionIds: [faction.id] })

    expect(await recipientsOf(session.id, `Cuisine et héros ${key}`)).toEqual([people.cook.name, people.pj.name].sort())
    expect(await recipientsOf(session.id, `Guilde ${key}`)).toEqual([people.member.name])
  })

  it('convertit une écriture d’avant : ancien public et champ « Personnage »', async () => {
    const { key, game, pjCharacter } = await sessionWithEveryone()
    const response = await api(alice, 'POST', '/api/documents', { title: `Ancien ${key}`, content: 'Texte', gameId: game.id, audience: 'everyone', characterId: pjCharacter.id })
    expect(response.status).toBe(200)
    const saved = await prisma.document.findFirstOrThrow({ where: { title: `Ancien ${key}` }, select: { audiences: true, audience: true, characterId: true, characters: { select: { id: true } } } })
    expect([...saved.audiences].sort()).toEqual(['kitchen', 'npcs', 'organizers', 'pjs'])
    // L'ancien public reste écrit pour le build en service pendant un déploiement ; le champ unique ne l'est plus
    expect(saved).toMatchObject({ audience: 'everyone', characterId: null, characters: [{ id: pjCharacter.id }] })
  })

  it('un document écrit par le build d’avant (sans rôles) garde ses destinataires', async () => {
    const { key, game, session, people } = await sessionWithEveryone()
    await prisma.document.create({ data: { title: `Ancien build ${key}`, slug: `ancien-build-${key}`, content: 'Texte', gameId: game.id, audience: 'kitchen' } })
    expect(await recipientsOf(session.id, `Ancien build ${key}`)).toEqual([people.cook.name])
  })

  it('refuse un rôle inconnu', async () => {
    const { key, game } = await sessionWithEveryone()
    expect((await api(alice, 'POST', '/api/documents', { title: `Inconnu ${key}`, content: 'Texte', gameId: game.id, audiences: ['everyone'] })).status).toBe(400)
  })
})
