// US-024 : confirmation de présence à une session reportée (ADR-0029)
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp, type ReceivedEmail } from './smtp'

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

const presenceToken = (email: ReceivedEmail) => email.text.match(/\/presence\/([\w-]+)/)?.[1]
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

// Une session reportée : Léa (PJ), Noé (PNJ et orga), Sam (cuisine, sans email)
async function postponedSession() {
  const key = `presence-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const old = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const person = (name: string, email: boolean) => prisma.participant.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: email ? `${name.toLowerCase()}-${key}@example.test` : null, gameLinks: { create: { gameId: game.id } } }
  })
  const [lea, noe, sam] = await Promise.all([person('Lea', true), person('Noe', true), person('Sam', false)])
  const aube = await prisma.character.create({ data: { name: `Aube ${key}`, slug: `aube-${key}`, gameId: game.id, type: 'pj' } })
  await prisma.sessionParticipant.createMany({
    data: [
      { sessionId: old.id, participantId: lea.id, role: 'participant' },
      { sessionId: old.id, participantId: noe.id, role: 'npc' },
      { sessionId: old.id, participantId: noe.id, role: 'organizer' },
      { sessionId: old.id, participantId: sam.id, role: 'kitchen' }
    ]
  })
  await prisma.sessionAssignment.create({ data: { sessionId: old.id, characterId: aube.id, participantId: lea.id } })
  const postponed = await api(alice, 'POST', `/api/sessions/${old.id}/postpone`, { name: `Report ${key}` })
  const session = postponed.body as { id: string }
  return { key, game, old, session, lea, noe, sam, aube }
}

async function sendRequests(s: Awaited<ReturnType<typeof postponedSession>>) {
  const before = smtp.received.length
  const response = await api(alice, 'POST', `/api/sessions/${s.session.id}/attendance/send`, { responseDueAt: inDays(7) })
  const emails = smtp.received.slice(before)
  const tokenOf = (email: string | null) => presenceToken(emails.find((message) => message.to.includes(email!))!)!
  return { response, emails, tokenOf }
}

describe('demandes de confirmation de présence (US-024)', () => {
  it('écrit à toute l’équipe, une fois par personne, et suit les réponses par le lien', async () => {
    const s = await postponedSession()
    const { response, emails, tokenOf } = await sendRequests(s)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ sentCount: 2, withoutEmail: [s.sam.name], failures: [] })
    expect(emails.map((email) => email.to[0]).sort()).toEqual([s.lea.email, s.noe.email].sort())
    expect(await prisma.sessionAttendance.count({ where: { sessionId: s.session.id } })).toBe(3)
    const leaToken = tokenOf(s.lea.email)

    // Déjà sollicités : un second envoi ne réécrit à personne
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/attendance/send`, { responseDueAt: inDays(7) })).body).toMatchObject({ sentCount: 0 })

    // La personne lit la session et répond, puis change d'avis ; elle ne voit rien des autres
    const read = await api(null, 'GET', `/api/public/attendance/${leaToken}`)
    expect(read.status).toBe(200)
    expect(read.body).toMatchObject({ sessionName: `Report ${s.key}`, status: 'pending', canAnswer: true })
    expect(JSON.stringify(read.body)).not.toContain(s.noe.name)
    expect((await api(null, 'POST', `/api/public/attendance/${leaToken}`, { answer: 'confirmed' })).body).toMatchObject({ status: 'confirmed' })
    expect((await api(null, 'POST', `/api/public/attendance/${leaToken}`, { answer: 'declined' })).body).toMatchObject({ status: 'declined' })

    const follow = (await api(alice, 'GET', `/api/sessions/${s.session.id}/attendance`)).body as { rows: Array<{ participant: { id: string }, displayStatus: string, canRelease: boolean }> }
    expect(follow.rows.find((row) => row.participant.id === s.lea.id)).toMatchObject({ displayStatus: 'declined', canRelease: true })

    // Un jeton inconnu répond comme un jeton invalidé
    expect((await api(null, 'GET', `/api/public/attendance/${'x'.repeat(43)}`)).status).toBe(404)
  })

  it('refuse la demande pour une session qui n’est pas un report', async () => {
    const s = await postponedSession()
    expect((await api(alice, 'POST', `/api/sessions/${s.old.id}/attendance/send`, { responseDueAt: inDays(7) })).status).toBe(409)
  })

  it('signale le délai dépassé, prolonge, relance, renvoie un lien et libère la place', async () => {
    const s = await postponedSession()
    const { tokenOf } = await sendRequests(s)
    const firstToken = tokenOf(s.noe.email)
    const path = (action: string) => `/api/sessions/${s.session.id}/attendance/${s.noe.id}/${action}`
    const follow = async () => ((await api(alice, 'GET', `/api/sessions/${s.session.id}/attendance`)).body as { rows: Array<{ participant: { id: string }, displayStatus: string, status: string }> })
      .rows.find((row) => row.participant.id === s.noe.id)!

    // Délai dépassé : signalé à la lecture, rien ne change tout seul
    await prisma.sessionAttendance.update({
      where: { sessionId_participantId: { sessionId: s.session.id, participantId: s.noe.id } },
      data: { responseDueAt: new Date(Date.now() - 1000) }
    })
    expect(await follow()).toMatchObject({ displayStatus: 'overdue', status: 'pending' })

    expect((await api(alice, 'POST', path('extend'), { responseDueAt: inDays(3) })).status).toBe(200)
    expect(await follow()).toMatchObject({ displayStatus: 'pending' })
    expect((await api(alice, 'POST', path('release'))).status).toBe(409)

    // Relance : un rappel sans lien
    const reminded = smtp.received.length
    expect((await api(alice, 'POST', path('remind'))).status).toBe(200)
    expect(smtp.received.slice(reminded).map((email) => presenceToken(email))).toEqual([undefined])

    // Nouveau lien : l'ancien cesse de fonctionner
    const resent = smtp.received.length
    expect((await api(alice, 'POST', path('resend'))).status).toBe(200)
    const newToken = presenceToken(smtp.received[resent]!)!
    expect((await api(null, 'GET', `/api/public/attendance/${firstToken}`)).status).toBe(404)
    expect((await api(null, 'POST', `/api/public/attendance/${newToken}`, { answer: 'declined' })).status).toBe(200)

    // Libérer la place : Noé quitte l'équipe, son lien ne marche plus
    expect((await api(alice, 'POST', path('release'))).status).toBe(200)
    expect(await prisma.sessionParticipant.count({ where: { sessionId: s.session.id, participantId: s.noe.id } })).toBe(0)
    expect((await api(null, 'GET', `/api/public/attendance/${newToken}`)).status).toBe(404)
    expect(await follow()).toMatchObject({ displayStatus: 'released' })

    // Export : la demande de présence fait partie des données de la personne
    const exported = (await api(alice, 'GET', `/api/participants/${s.noe.id}/export`)).body as { attendances: Array<{ status: string }> }
    expect(exported.attendances).toEqual([expect.objectContaining({ status: 'released' })])
  })

  it('libérer la place retire la personne du casting (témoin : les autres restent)', async () => {
    const s = await postponedSession()
    const { tokenOf } = await sendRequests(s)
    await api(null, 'POST', `/api/public/attendance/${tokenOf(s.lea.email)}`, { answer: 'declined' })
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/attendance/${s.lea.id}/release`)).status).toBe(200)

    expect(await prisma.sessionAssignment.findFirstOrThrow({ where: { sessionId: s.session.id, characterId: s.aube.id } })).toMatchObject({ participantId: null })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: s.session.id, participantId: s.noe.id } })).toBe(2)
  })
})
