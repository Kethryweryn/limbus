// US-008 : fiche allergies de la session (SPEC-001, R14, R15)
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api, tokenFor } from './api'
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

// Une session d'Alice avec ses inscriptions (confirmées, désistée, invitée), un cuisinier et un PNJ
async function sessionWithRegistrations() {
  const key = `allergies-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const period = await prisma.registrationPeriod.create({
    data: { name: `Période ${key}`, gameId: game.id, publicId: `pub-${key}`, state: 'open', sessions: { create: { sessionId: session.id, seats: 5 } } }
  })
  const person = (name: string) => prisma.participant.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
  })
  const [zoe, ines, leo, hugo, cook, npc] = await Promise.all(['Zoe', 'Ines', 'Leo', 'Hugo', 'Cuisine', 'Pnj'].map(person))
  const registration = (participant: { id: string, email: string | null }, status: string, dietary: string | null) => prisma.registration.create({
    data: {
      periodId: period.id,
      sessionId: session.id,
      participantId: participant.id,
      status,
      source: 'invitation',
      email: participant.email!,
      dietary,
      phone: '0612345678',
      emergencyContactName: 'Contact Urgence',
      emergencyContactPhone: '0699999999'
    }
  })
  await Promise.all([
    registration(zoe!, 'confirmed', 'Gluten'),
    registration(ines!, 'confirmed', null),
    registration(leo!, 'withdrawn', 'Arachides'),
    registration(hugo!, 'invited', 'Lactose')
  ])
  await prisma.sessionParticipant.createMany({
    data: [
      { sessionId: session.id, participantId: cook!.id, role: 'kitchen' },
      { sessionId: session.id, participantId: npc!.id, role: 'npc' },
      { sessionId: session.id, participantId: zoe!.id, role: 'participant' }
    ]
  })
  return { session, zoe: zoe!, ines: ines!, cook: cook!, npc: npc! }
}

describe('fiche allergies', () => {
  it('ne liste que les personnes confirmées qui ont déclaré quelque chose, sans contact', async () => {
    const { session, zoe } = await sessionWithRegistrations()
    const response = await api(alice, 'GET', `/api/sessions/${session.id}/allergies`)
    expect(response.status).toBe(200)
    // À table : Zoé et Inès (confirmées, Zoé aussi au cast), la cuisine et le PNJ
    expect(response.body).toMatchObject({ confirmedCount: 2, eaterCount: 4, people: [{ name: zoe.name, dietary: 'Gluten' }] })
    expect((response.body as any).people).toHaveLength(1)
    const json = JSON.stringify(response.body)
    expect(json).not.toContain('0612345678')
    expect(json).not.toContain('Urgence')
    expect(json).not.toContain('Arachides')
    expect(json).not.toContain('Lactose')
  })

  it('se télécharge en PDF, sans mise en cache', async () => {
    const { session } = await sessionWithRegistrations()
    const response = await fetch(`${inject('baseUrl')}/api/sessions/${session.id}/allergies/pdf`, { headers: { cookie: `limbus_token=${tokenFor(alice)}` } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('s’envoie à l’équipe cuisine seulement, avec le PDF en pièce jointe', async () => {
    const { session, zoe, cook, npc } = await sessionWithRegistrations()
    const before = smtp.received.length

    const response = await api(alice, 'POST', `/api/sessions/${session.id}/allergies/send`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toEqual({ sentCount: 1, failures: [] })

    const sent = smtp.received.slice(before)
    expect(sent.map((message) => message.to)).toEqual([[cook.email]])
    expect(sent[0]!.raw).toContain('application/pdf')
    expect(sent[0]!.text).toContain('données de santé')
    expect(sent.some((message) => message.to.includes(zoe.email!) || message.to.includes(npc.email!))).toBe(false)
  })

  it('refuse l’envoi sans équipe cuisine', async () => {
    const { session, cook } = await sessionWithRegistrations()
    await prisma.sessionParticipant.deleteMany({ where: { sessionId: session.id, participantId: cook.id } })
    const response = await api(alice, 'POST', `/api/sessions/${session.id}/allergies/send`)
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.body)).toContain('pas d’équipe cuisine')
  })

  it('refuse l’envoi quand l’équipe cuisine n’a pas d’email', async () => {
    const { session, cook } = await sessionWithRegistrations()
    await prisma.participant.update({ where: { id: cook.id }, data: { email: null } })
    const response = await api(alice, 'POST', `/api/sessions/${session.id}/allergies/send`)
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.body)).toContain('équipe cuisine')
  })
})
