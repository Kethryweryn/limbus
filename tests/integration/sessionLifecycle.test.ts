// EPIC-004 : écarts de SPEC-004 (casting, versions, visibilité, cycle de vie d'une session)
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

// Un jeu d'Alice avec une session, deux PJ, un PNJ et deux personnes liées au jeu
async function aliceSession(options: { singlePjPerParticipant?: boolean } = {}) {
  const key = `cycle-${++counter}`
  const game = await prisma.game.create({
    data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, singlePjPerParticipant: options.singlePjPerParticipant ?? true }
  })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const character = (name: string, type: 'pj' | 'pnj') => prisma.character.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id, type } })
  const [aube, brume, garde] = await Promise.all([character('Aube', 'pj'), character('Brume', 'pj'), character('Garde', 'pnj')])
  const person = (name: string) => prisma.participant.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
  })
  const [lea, noe] = await Promise.all([person('Lea'), person('Noe')])
  return { key, game, session, aube, brume, garde, lea, noe }
}

function castBody(s: Awaited<ReturnType<typeof aliceSession>>, assignments: Array<{ characterId: string, participantId: string }>, participants: Array<{ participantId: string, role: string }> = []) {
  return { name: s.session.name, gameId: s.game.id, status: 'scheduled', participants, assignments }
}

describe('un seul PJ par participant (US-017)', () => {
  it('refuse deux PJ au même participant quand le jeu le demande', async () => {
    const s = await aliceSession()
    const response = await api(alice, 'PUT', `/api/sessions/${s.session.id}`, castBody(s, [
      { characterId: s.aube.id, participantId: s.lea.id },
      { characterId: s.brume.id, participantId: s.lea.id }
    ]))
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.body)).toContain(s.lea.name)
  })

  it('accepte plusieurs PJ dans un jeu en plusieurs actes, et plusieurs PNJ partout (témoins)', async () => {
    const actes = await aliceSession({ singlePjPerParticipant: false })
    expect((await api(alice, 'PUT', `/api/sessions/${actes.session.id}`, castBody(actes, [
      { characterId: actes.aube.id, participantId: actes.lea.id },
      { characterId: actes.brume.id, participantId: actes.lea.id }
    ]))).status).toBe(200)

    const s = await aliceSession()
    const pnj2 = await prisma.character.create({ data: { name: `Garde 2 ${s.key}`, slug: `garde-2-${s.key}`, gameId: s.game.id, type: 'pnj' } })
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}`, castBody(s, [
      { characterId: s.aube.id, participantId: s.lea.id },
      { characterId: s.garde.id, participantId: s.noe.id },
      { characterId: pnj2.id, participantId: s.noe.id }
    ], [{ participantId: s.noe.id, role: 'npc' }]))).status).toBe(200)
  })

  it('se règle sur la fiche du jeu', async () => {
    const s = await aliceSession()
    expect((await api(alice, 'PUT', `/api/games/${s.game.id}`, { singlePjPerParticipant: false })).status).toBe(200)
    expect(await prisma.game.findUniqueOrThrow({ where: { id: s.game.id }, select: { singlePjPerParticipant: true } })).toEqual({ singlePjPerParticipant: false })
  })
})

describe('modifications simultanées d’une session (US-018)', () => {
  const since = (date: Date | string) => ({ headers: { 'if-unmodified-since': new Date(date).toISOString() } })

  it('refuse le second enregistrement fait sur la même version', async () => {
    const s = await aliceSession()
    const read = await prisma.session.findUniqueOrThrow({ where: { id: s.session.id } })
    const body = castBody(s, [{ characterId: s.aube.id, participantId: s.lea.id }])

    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}`, body, since(read.updatedAt))).status).toBe(200)
    const second = await api(alice, 'PUT', `/api/sessions/${s.session.id}`, { ...body, assignments: [] }, since(read.updatedAt))
    expect(second.status).toBe(409)
    expect(JSON.stringify(second.body)).not.toContain('hors ligne')

    const timeline = await api(alice, 'PUT', `/api/sessions/${s.session.id}/timeline`, { assignments: [] }, since(read.updatedAt))
    expect(timeline.status).toBe(409)
  })

  it('déroulé puis casting avec la version renvoyée (témoin)', async () => {
    const s = await aliceSession()
    const read = await prisma.session.findUniqueOrThrow({ where: { id: s.session.id } })
    const timeline = await api(alice, 'PUT', `/api/sessions/${s.session.id}/timeline`, { assignments: [] }, since(read.updatedAt))
    expect(timeline.status).toBe(200)
    const { updatedAt } = timeline.body as { updatedAt: string }
    expect(new Date(updatedAt).getTime()).toBeGreaterThan(read.updatedAt.getTime())

    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}`, castBody(s, [{ characterId: s.aube.id, participantId: s.lea.id }]), since(updatedAt))).status).toBe(200)
  })
})

describe('visibilité d’une session sur la page publique (US-019)', () => {
  it('n’est pas visible par défaut, et la case est enregistrée', async () => {
    const s = await aliceSession()
    const created = await api(alice, 'POST', '/api/sessions', { name: `Nouvelle ${s.key}`, gameId: s.game.id })
    expect(created.status).toBe(200)
    const id = (created.body as { id: string }).id
    expect(await prisma.session.findUniqueOrThrow({ where: { id }, select: { published: true } })).toEqual({ published: false })

    const body = { name: `Nouvelle ${s.key}`, gameId: s.game.id, status: 'scheduled' }
    expect((await api(alice, 'PUT', `/api/sessions/${id}`, { ...body, published: true })).status).toBe(200)
    expect(await prisma.session.findUniqueOrThrow({ where: { id }, select: { published: true } })).toEqual({ published: true })

    // Une modification qui ne porte pas le champ ne change pas la visibilité
    expect((await api(alice, 'PUT', `/api/sessions/${id}`, body)).status).toBe(200)
    expect(await prisma.session.findUniqueOrThrow({ where: { id }, select: { published: true } })).toEqual({ published: true })
  })
})

describe('statuts d’une session (US-020)', () => {
  it('une session terminée n’est plus la prochaine session ; repassée « Prévue », elle y revient', async () => {
    const s = await aliceSession()
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    await prisma.session.update({ where: { id: s.session.id }, data: { date: future } })
    const nextOf = async () => {
      const games = (await api(alice, 'GET', '/api/games')).body as Array<{ id: string, nextScheduledSession: { id: string } | null }>
      return games.find((item) => item.id === s.game.id)!.nextScheduledSession?.id ?? null
    }
    expect(await nextOf()).toBe(s.session.id)

    const body = { name: s.session.name, gameId: s.game.id, date: future.toISOString() }
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}`, { ...body, status: 'completed' })).status).toBe(200)
    expect(await nextOf()).toBeNull()

    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}`, { ...body, status: 'scheduled' })).status).toBe(200)
    expect(await nextOf()).toBe(s.session.id)
  })
})

describe('supprimer une session oriente vers l’annulation (US-021)', () => {
  it('refuse avec un paiement reçu ou une inscription, accepte sinon', async () => {
    const paid = await aliceSession()
    await prisma.sessionPayment.create({ data: { sessionId: paid.session.id, participantId: paid.lea.id, paidAt: new Date() } })
    const refused = await api(alice, 'DELETE', `/api/sessions/${paid.session.id}`)
    expect(refused.status).toBe(409)
    expect(JSON.stringify(refused.body)).toContain('Annulez-la ou reportez-la')

    const registered = await aliceSession()
    const period = await prisma.registrationPeriod.create({ data: { gameId: registered.game.id, name: `Période ${registered.key}`, publicId: `periode-${registered.key}` } })
    await prisma.registration.create({ data: { periodId: period.id, participantId: registered.lea.id, sessionId: registered.session.id, status: 'confirmed', source: 'invitation', email: 'lea@example.test' } })
    expect((await api(alice, 'DELETE', `/api/sessions/${registered.session.id}`)).status).toBe(409)

    // Témoin : un paiement envoyé mais pas reçu n'empêche pas la suppression
    const free = await aliceSession()
    await prisma.sessionPayment.create({ data: { sessionId: free.session.id, participantId: free.lea.id, paymentEmailSentAt: new Date() } })
    expect((await api(alice, 'DELETE', `/api/sessions/${free.session.id}`)).status).toBe(200)
  })
})
