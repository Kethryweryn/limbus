// Envoi des documents d'une session : un seul email par participant et par document (revue d'architecture R-07)
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let smtp: Awaited<ReturnType<typeof startTestSmtp>>

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

describe('envoi des documents d’une session', () => {
  it('écrit une seule fois à un participant qui joue deux personnages visés, et pas au renvoi', async () => {
    const key = 'envoi-documents'
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
    const participant = await prisma.participant.create({
      data: { name: `Zoé ${key}`, slug: `zoe-${key}`, email: `zoe-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
    })
    const [first, second] = await Promise.all(['Héraut', 'Espion'].map((name) =>
      prisma.character.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id } })
    ))
    await prisma.sessionAssignment.createMany({
      data: [first!, second!].map((character) => ({ sessionId: session.id, characterId: character.id, participantId: participant.id }))
    })
    const document = await prisma.document.create({
      data: {
        title: `Lettre ${key}`, slug: `lettre-${key}`, gameId: game.id, content: 'Contenu', readyToSend: true,
        characters: { connect: [{ id: first!.id }, { id: second!.id }] }
      }
    })
    const mailsTo = () => smtp.received.filter((received) => received.to.includes(participant.email!)).length

    const response = await api(alice, 'POST', `/api/sessions/${session.id}/documents/send`, { documentIds: [document.id] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ sentCount: 1 })
    expect(mailsTo()).toBe(1)
    expect(await prisma.sessionDocumentDelivery.count({ where: { sessionId: session.id, documentId: document.id } })).toBe(1)

    // Renvoi : le document est déjà parti, rien n'est renvoyé
    const again = await api(alice, 'POST', `/api/sessions/${session.id}/documents/send`, { documentIds: [document.id] })
    expect(again.body).toMatchObject({ sentCount: 0 })
    expect(mailsTo()).toBe(1)
  })
})
