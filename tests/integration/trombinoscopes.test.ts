// EPIC-005 : écarts des trombinoscopes
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let counter = 0
let smtp: Awaited<ReturnType<typeof startTestSmtp>>

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

async function castSession() {
  const key = `trombi-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const character = (name: string) => prisma.character.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id } })
  const [viewer, other] = await Promise.all([character('Lea'), character('Noe')])
  const participant = await prisma.participant.create({
    data: { name: `Joueur ${key}`, slug: `joueur-${key}`, email: `joueur-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
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
    expect((config.body as { characters: Array<{ id: string }> }).characters.map((item) => item.id)).toEqual([s.other.id])

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

describe('trombinoscopes périmés (US-028)', () => {
  const generate = (sessionId: string) => api(alice, 'POST', `/api/sessions/${sessionId}/trombinoscopes/generate`, {})
  const sheet = async (sessionId: string) => {
    const response = await api(alice, 'GET', `/api/sessions/${sessionId}/documents`)
    expect(response.status).toBe(200)
    return (response.body as { characterSheets: Array<{ trombinoscopeOutdated: boolean, trombinoscopeSentAt: string | null }> }).characterSheets[0]!
  }

  it('périmé après un changement de photo ou de réglage, à jour après une nouvelle génération', async () => {
    const s = await castSession()
    expect((await generate(s.session.id)).status).toBe(200)
    expect((await sheet(s.session.id)).trombinoscopeOutdated).toBe(false)

    await prisma.sessionAssignment.create({ data: { sessionId: s.session.id, characterId: s.other.id, photoUrl: '/api/uploads/session-assignment-photos/absente.png' } })
    expect((await sheet(s.session.id)).trombinoscopeOutdated).toBe(true)

    expect((await generate(s.session.id)).status).toBe(200)
    expect((await sheet(s.session.id)).trombinoscopeOutdated).toBe(false)

    await prisma.character.update({ where: { id: s.other.id }, data: { trombinoscopeDisplayName: 'Le Masque' } })
    expect((await sheet(s.session.id)).trombinoscopeOutdated).toBe(true)
    await prisma.character.update({ where: { id: s.other.id }, data: { trombinoscopeDisplayName: null } })
    expect((await sheet(s.session.id)).trombinoscopeOutdated).toBe(false)
  })

  it('refuse l’envoi tant qu’un trombinoscope à envoyer est périmé', async () => {
    const s = await castSession()
    await prisma.character.update({ where: { id: s.viewer.id }, data: { sheetReadyToSend: true } })
    expect((await generate(s.session.id)).status).toBe(200)
    await prisma.character.update({ where: { id: s.other.id }, data: { trombinoscopeNote: 'Nouvelle note' } })

    const before = smtp.received.length
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/documents/send-trombinoscopes`, {})).status).toBe(409)
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/documents/send-character-sheets-and-trombinoscopes`, {})).status).toBe(409)
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/documents/test-character-sheet`, { characterId: s.viewer.id, emails: ['orga@example.test'] })).status).toBe(409)
    expect(smtp.received.length).toBe(before)

    expect((await generate(s.session.id)).status).toBe(200)
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/documents/send-trombinoscopes`, {})).status).toBe(200)
    expect(smtp.received.length).toBe(before + 1)
  })

  it('un trombinoscope déjà envoyé reste signalé périmé, sans bloquer', async () => {
    const s = await castSession()
    expect((await generate(s.session.id)).status).toBe(200)
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/documents/send-trombinoscopes`, {})).status).toBe(200)
    await prisma.character.update({ where: { id: s.other.id }, data: { trombinoscopeFaceHidden: true } })

    const current = await sheet(s.session.id)
    expect(current.trombinoscopeSentAt).not.toBeNull()
    expect(current.trombinoscopeOutdated).toBe(true)
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/documents/send-trombinoscopes`, {})).status).toBe(200)
  })
})
