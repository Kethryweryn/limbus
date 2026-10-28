// US-007 : inscrits confirmés dans le tableau des paiements (SPEC-001, R22, ADR-0021)
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

// Une session d'Alice avec :
// - une joueuse qui a un PJ ;
// - une personne confirmée sans personnage (rôle participant) ;
// - une personne de l'équipe cuisine ;
// - une joueuse qui a un PJ et le rôle participant.
async function sessionWithPeople() {
  const key = `paiements-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const person = (name: string) => prisma.participant.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
  })
  const [player, confirmed, cook, both] = await Promise.all([person('Joueuse'), person('Inscrite'), person('Cuisine'), person('Double')])
  const character = (name: string) => prisma.character.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id, type: 'pj' } })
  const [first, second] = await Promise.all([character('Aube'), character('Brume')])
  await prisma.sessionAssignment.createMany({
    data: [
      { sessionId: session.id, characterId: first.id, participantId: player.id },
      { sessionId: session.id, characterId: second.id, participantId: both.id }
    ]
  })
  await prisma.sessionParticipant.createMany({
    data: [
      { sessionId: session.id, participantId: confirmed.id, role: 'participant' },
      { sessionId: session.id, participantId: cook.id, role: 'kitchen' },
      { sessionId: session.id, participantId: both.id, role: 'participant' }
    ]
  })
  return { session, player, confirmed, cook, both }
}

describe('tableau des paiements', () => {
  it('liste les inscrits confirmés sans personnage, une seule fois chaque personne, sans la cuisine', async () => {
    const { session, player, confirmed, both } = await sessionWithPeople()
    const response = await api(alice, 'GET', `/api/sessions/${session.id}/payments`)
    expect(response.status).toBe(200)
    const rows = (response.body as any).rows as Array<{ participant: { id: string }, character: { name: string } | null }>
    expect(rows.map((row) => row.participant.id)).toEqual([player.id, both.id, confirmed.id])
    expect(rows.find((row) => row.participant.id === confirmed.id)!.character).toBeNull()
  })

  it('une personne confirmée sans personnage reçoit l’email de paiement, sans mention de personnage', async () => {
    const { session, confirmed, cook } = await sessionWithPeople()
    const response = await api(alice, 'POST', `/api/sessions/${session.id}/payments/send`, { participantId: confirmed.id })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ sentCount: 1 })

    const email = smtp.received.filter((message) => message.to.includes(confirmed.email!)).at(-1)!
    expect(email.text).toContain(`régler ta participation à ${session.name}`)
    expect(email.text).not.toMatch(/personnage/i)
    expect(smtp.received.some((message) => message.to.includes(cook.email!))).toBe(false)
  })

  it('le paiement d’une personne sans personnage se valide ; la cuisine reste hors du suivi', async () => {
    const { session, confirmed, cook } = await sessionWithPeople()
    expect((await api(alice, 'PUT', `/api/sessions/${session.id}/payments/${confirmed.id}`, { paid: true })).status).toBe(200)
    expect((await api(alice, 'PUT', `/api/sessions/${session.id}/payments/${cook.id}`, { paid: true })).status).toBe(400)
    const rows = (await api(alice, 'GET', `/api/sessions/${session.id}/payments`)).body as any
    expect(rows.rows.find((row: any) => row.participant.id === confirmed.id).paidAt).toBeTruthy()
  })
})
