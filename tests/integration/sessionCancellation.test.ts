// US-025 : email d'annulation proposé à l'équipe, relu et envoyé à la main
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

async function sessionWithTeam(status: string) {
  const key = `annulation-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, status } })
  const person = (name: string, email: boolean) => prisma.participant.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: email ? `${name.toLowerCase()}-${key}@example.test` : null, gameLinks: { create: { gameId: game.id } } }
  })
  const [lea, noe, sam] = await Promise.all([person('Lea', true), person('Noe', true), person('Sam', false)])
  await prisma.sessionParticipant.createMany({
    data: [
      { sessionId: session.id, participantId: lea.id, role: 'participant' },
      { sessionId: session.id, participantId: noe.id, role: 'organizer' },
      { sessionId: session.id, participantId: noe.id, role: 'npc' },
      { sessionId: session.id, participantId: sam.id, role: 'kitchen' }
    ]
  })
  return { key, session, lea, noe, sam }
}

const message = { subject: 'Session annulée', text: 'La session est annulée, désolés.' }

describe('email d’annulation (US-025)', () => {
  it('part une fois à chaque personne de l’équipe qui a un email, avec le texte relu', async () => {
    const s = await sessionWithTeam('cancelled')
    const before = smtp.received.length
    const response = await api(alice, 'POST', `/api/sessions/${s.session.id}/cancellation-email`, message)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ sentCount: 2, withoutEmail: [s.sam.name], failures: [] })

    const sent = smtp.received.slice(before)
    expect(sent.map((email) => email.to[0]).sort()).toEqual([s.lea.email, s.noe.email].sort())
    expect(sent[0]!.text).toContain('La session est annulée, désolés.')
  })

  it('refuse une session qui n’est pas annulée', async () => {
    const s = await sessionWithTeam('scheduled')
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/cancellation-email`, message)).status).toBe(409)
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/cancellation-email/test`, { ...message, emails: ['orga@example.test'] })).status).toBe(409)
  })

  it('envoie un test aux adresses choisies, sans écrire à l’équipe', async () => {
    const s = await sessionWithTeam('cancelled')
    const before = smtp.received.length
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/cancellation-email/test`, { ...message, emails: ['orga@example.test'] })).status).toBe(200)
    expect(smtp.received.slice(before).map((email) => email.to)).toEqual([['orga@example.test']])
  })
})
