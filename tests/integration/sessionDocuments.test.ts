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
    const [first, second] = await Promise.all(['Heraut', 'Espion'].map((name) =>
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

  it('envoie une fiche de personnage une seule fois, et pas au renvoi', async () => {
    const key = 'envoi-fiches'
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
    const participant = await prisma.participant.create({
      data: { name: `Léo ${key}`, slug: `leo-${key}`, email: `leo-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
    })
    const character = await prisma.character.create({
      data: { name: `Héraut ${key}`, slug: `heraut-${key}`, gameId: game.id, background: 'Histoire', sheetReadyToSend: true }
    })
    await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id } })
    const mailsTo = () => smtp.received.filter((received) => received.to.includes(participant.email!)).length

    const response = await api(alice, 'POST', `/api/sessions/${session.id}/documents/send-character-sheets`, {})
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ sentCount: 1 })
    expect(mailsTo()).toBe(1)

    const again = await api(alice, 'POST', `/api/sessions/${session.id}/documents/send-character-sheets`, {})
    expect(again.body).toMatchObject({ sentCount: 0 })
    expect(mailsTo()).toBe(1)
  })

  it('continue après un échec et liste les personnes qui n’ont rien reçu (US-029)', async () => {
    const key = 'envoi-echec'
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
    const people = await Promise.all([['Ana', 'refuse-ana'], ['Bea', 'bea']].map(([name, local]) => prisma.participant.create({
      data: { name: `${name} ${key}`, slug: `${local}-${key}`, email: `${local}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
    })))
    for (const [index, participant] of people.entries()) {
      const character = await prisma.character.create({
        data: { name: `Rôle ${index} ${key}`, slug: `role-${index}-${key}`, gameId: game.id, background: 'Histoire', sheetReadyToSend: true }
      })
      await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id } })
    }

    const response = await api(alice, 'POST', `/api/sessions/${session.id}/documents/send-character-sheets`, {})
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toEqual({ sentCount: 1, failures: [people[0]!.name] })
    expect(smtp.received.some((received) => received.to.includes(people[1]!.email!))).toBe(true)
    expect(await prisma.sessionDocumentDelivery.count({ where: { sessionId: session.id } })).toBe(1)

    // Seule la personne refusée reste à envoyer : rien ne part, l'envoi est en erreur
    expect((await api(alice, 'POST', `/api/sessions/${session.id}/documents/send-character-sheets`, {})).status).toBe(502)
  })
})
