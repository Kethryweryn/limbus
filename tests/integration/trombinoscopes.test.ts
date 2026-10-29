// EPIC-005 : écarts des trombinoscopes
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

async function castSession() {
  const key = `trombi-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const character = (name: string) => prisma.character.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id } })
  const [viewer, other] = await Promise.all([character('Lea'), character('Noe')])
  const participant = await prisma.participant.create({
    data: { name: `Joueur ${key}`, slug: `joueur-${key}`, gameLinks: { create: { gameId: game.id } } }
  })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const assignment = await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: viewer.id, participantId: participant.id } })
  return { game, viewer, other, participant, session, assignment }
}

describe('jamais dans son propre trombinoscope (US-027)', () => {
  it('la configuration ne liste pas le personnage lui-même, et ignore son entrée à l’enregistrement', async () => {
    const s = await castSession()
    const config = await api(alice, 'GET', `/api/characters/${s.viewer.id}/trombinoscope`)
    expect(config.status).toBe(200)
    expect(config.body.characters.map((item: { id: string }) => item.id)).toEqual([s.other.id])

    const saved = await api(alice, 'PUT', `/api/characters/${s.viewer.id}/trombinoscope`, {
      entries: [
        { targetCharacterId: s.viewer.id, included: true, faceKnown: true },
        { targetCharacterId: s.other.id, included: true, faceKnown: false }
      ]
    })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(await prisma.characterTrombinoscopeEntry.findMany({ where: { viewerCharacterId: s.viewer.id }, select: { targetCharacterId: true } }))
      .toEqual([{ targetCharacterId: s.other.id }])
  })

  it('la génération ne l’ajoute pas, même avec un ancien réglage qui l’incluait', async () => {
    const s = await castSession()
    await prisma.characterTrombinoscopeEntry.create({ data: { viewerCharacterId: s.viewer.id, targetCharacterId: s.viewer.id, included: true, faceKnown: true } })
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/trombinoscopes/generate`, {})).status).toBe(200)
    const trombinoscope = await prisma.sessionTrombinoscope.findFirstOrThrow({ where: { sessionId: s.session.id } })
    expect(trombinoscope.contentHtml).toContain(s.other.name)
    expect(trombinoscope.contentHtml).not.toContain(`<h2>${s.viewer.name}</h2>`)
  })
})
