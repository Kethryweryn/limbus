// US-187 : public d'un document par rôles et sélection avancée (ADR-0072, SPEC-006 R7)
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, invalidMessages } from './api'
import { createTestPrisma } from './db'
import type { CharacterType } from '~/generated/prisma/enums'
import { withFicheValues } from '../fiche'

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
  const key = `public-document-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { slug: `session-${key}`, gameId: game.id } })
  const person = (name: string) => withFicheValues(prisma.participant.create({ data: { slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id , name: `${name} ${key}` } } } }), { name: `${name} ${key}` })
  const [pj, orga, npc, cook, member] = await Promise.all(['Pj', 'Orga', 'Pnj', 'Cuisine', 'Membre'].map(person))
  const faction = await prisma.faction.create({ data: { name: `Guilde ${key}`, slug: `guilde-${key}`, gameId: game.id } })
  const character = (name: string, type: CharacterType, factionId?: string) => prisma.character.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, type, gameId: game.id, ...(factionId ? { factionLinks: { create: { factionId } } } : {}) }
  })
  const [pjCharacter, pnjCharacter, memberCharacter] = await Promise.all([character('Heros', 'pj'), character('Garde', 'pnj'), character('Marchand', 'pj', faction.id)])
  await prisma.sessionAssignment.createMany({
    data: [
      { gameId: session.gameId, sessionId: session.id, characterId: pjCharacter.id, participantId: pj!.id },
      { gameId: session.gameId, sessionId: session.id, characterId: pnjCharacter.id, participantId: orga!.id },
      { gameId: session.gameId, sessionId: session.id, characterId: memberCharacter.id, participantId: member!.id }
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

  // US-193 : une page d'avant ADR-0072 envoie l'ancien public ; elle est refusée plutôt qu'enregistrée sans public
  it('refuse une écriture d’avant, avec l’ancien public ou le champ « Personnage »', async () => {
    const { key, game, pjCharacter } = await sessionWithEveryone()
    for (const legacy of [{ audience: 'everyone' }, { characterId: pjCharacter.id }]) {
      const refused = await api(alice, 'POST', '/api/documents', { title: `Ancien ${key}`, content: 'Texte', gameId: game.id, ...legacy })
      expect(refused.status).toBe(400)
      expect(invalidMessages(refused)).toEqual(['Cette page est d’une ancienne version : rechargez-la avant d’enregistrer.'])
    }
    expect(await prisma.document.count({ where: { title: `Ancien ${key}` } })).toBe(0)
  })

  it('refuse un rôle inconnu', async () => {
    const { key, game } = await sessionWithEveryone()
    expect((await api(alice, 'POST', '/api/documents', { title: `Inconnu ${key}`, content: 'Texte', gameId: game.id, audiences: ['everyone'] })).status).toBe(400)
  })
})
