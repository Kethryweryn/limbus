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

describe('reporter une session (US-022)', () => {
  async function withCast() {
    const s = await aliceSession()
    const photoUrl = `/api/uploads/session-assignment-photos/report-${s.key}.png`
    await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename: `report-${s.key}.png`, url: photoUrl, gameId: s.game.id, sessionId: s.session.id } })
    await prisma.sessionParticipant.createMany({ data: [{ sessionId: s.session.id, participantId: s.lea.id, role: 'participant' }, { sessionId: s.session.id, participantId: s.noe.id, role: 'npc' }] })
    await prisma.sessionAssignment.createMany({
      data: [
        { sessionId: s.session.id, characterId: s.aube.id, participantId: s.lea.id, photoUrl, notes: 'Arrive tard' },
        { sessionId: s.session.id, characterId: s.garde.id, participantId: s.noe.id }
      ]
    })
    return { ...s, photoUrl }
  }

  it('recopie l’équipe et le casting sur une nouvelle session, et lie les deux', async () => {
    const s = await withCast()
    const response = await api(alice, 'POST', `/api/sessions/${s.session.id}/postpone`, { name: `Report ${s.key}`, date: '2027-03-01T10:00:00.000Z' })
    expect(response.status).toBe(200)
    const created = response.body as { id: string }

    const old = await prisma.session.findUniqueOrThrow({ where: { id: s.session.id } })
    expect(old).toMatchObject({ status: 'postponed', postponedToSessionId: created.id })
    const copy = await prisma.session.findUniqueOrThrow({ where: { id: created.id }, include: { participants: true, assignments: true } })
    expect(copy).toMatchObject({ gameId: s.game.id, status: 'scheduled' })
    expect(copy.participants.map((p) => [p.participantId, p.role]).sort()).toEqual([[s.lea.id, 'participant'], [s.noe.id, 'npc']].sort())
    expect(copy.assignments.find((a) => a.characterId === s.aube.id)).toMatchObject({ participantId: s.lea.id, photoUrl: s.photoUrl, notes: 'Arrive tard' })

    // La photo survit à la suppression de l'ancienne session
    expect((await api(alice, 'DELETE', `/api/sessions/${s.session.id}`)).status).toBe(200)
    expect(await prisma.uploadedFile.findUnique({ where: { url: s.photoUrl } })).not.toBeNull()
  })

  it('refuse de reporter une session déjà reportée', async () => {
    const s = await withCast()
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/postpone`, { name: `Report ${s.key}` })).status).toBe(200)
    expect((await api(alice, 'POST', `/api/sessions/${s.session.id}/postpone`, { name: `Encore ${s.key}` })).status).toBe(409)
  })
})

describe('remboursements d’une session annulée ou reportée (US-023)', () => {
  it('suit à rembourser et remboursé, et reporte un paiement sur la nouvelle session', async () => {
    const s = await aliceSession()
    await prisma.sessionParticipant.createMany({ data: [{ sessionId: s.session.id, participantId: s.lea.id, role: 'participant' }, { sessionId: s.session.id, participantId: s.noe.id, role: 'participant' }] })
    const paidAt = new Date('2026-09-01T10:00:00.000Z')
    await prisma.sessionPayment.createMany({ data: [{ sessionId: s.session.id, participantId: s.lea.id, paidAt }, { sessionId: s.session.id, participantId: s.noe.id, paidAt }] })
    const refund = (participantId: string, status: string | null) => api(alice, 'PUT', `/api/sessions/${s.session.id}/payments/${participantId}/refund`, { status })

    // Session prévue : rien à rembourser
    expect((await refund(s.lea.id, 'to_refund')).status).toBe(409)

    const postponed = await api(alice, 'POST', `/api/sessions/${s.session.id}/postpone`, { name: `Report ${s.key}` })
    const target = (postponed.body as { id: string }).id

    expect((await refund(s.lea.id, 'refunded')).status).toBe(200)
    expect(await prisma.sessionPayment.findUniqueOrThrow({ where: { sessionId_participantId: { sessionId: s.session.id, participantId: s.lea.id } } }))
      .toMatchObject({ refundStatus: 'refunded', refundedAt: expect.any(Date) })

    expect((await refund(s.noe.id, 'carried_over')).status).toBe(200)
    expect(await prisma.sessionPayment.findUniqueOrThrow({ where: { sessionId_participantId: { sessionId: target, participantId: s.noe.id } } }))
      .toMatchObject({ paidAt })

    const dashboard = (await api(alice, 'GET', `/api/sessions/${s.session.id}/payments`)).body as { refunds: Array<{ refundStatus: string }> }
    expect(dashboard.refunds.map((item) => item.refundStatus).sort()).toEqual(['carried_over', 'refunded'])

    // Export : le choix de remboursement fait partie des données de la personne
    const exported = (await api(alice, 'GET', `/api/participants/${s.lea.id}/export`)).body as { payments: Array<{ refundStatus: string | null }> }
    expect(exported.payments.map((item) => item.refundStatus)).toContain('refunded')
  })

  it('refuse le report d’un paiement sans session de report, ou pour quelqu’un qui n’a pas payé', async () => {
    const s = await aliceSession()
    await prisma.sessionParticipant.create({ data: { sessionId: s.session.id, participantId: s.lea.id, role: 'participant' } })
    await prisma.sessionPayment.create({ data: { sessionId: s.session.id, participantId: s.lea.id, paidAt: new Date() } })
    await prisma.session.update({ where: { id: s.session.id }, data: { status: 'cancelled' } })
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}/payments/${s.lea.id}/refund`, { status: 'carried_over' })).status).toBe(400)
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}/payments/${s.noe.id}/refund`, { status: 'to_refund' })).status).toBe(400)
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}/payments/${s.lea.id}/refund`, { status: 'to_refund' })).status).toBe(200)
  })
})

describe('les réglages de paiement ne changent pas la version (US-018, ADR-0028)', () => {
  it('enregistrer le lien de paiement puis le casting avec la version lue passe', async () => {
    const s = await aliceSession()
    const read = await prisma.session.findUniqueOrThrow({ where: { id: s.session.id } })
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}/payments/settings`, { paymentLinkUrl: 'https://paiement.example.test' })).status).toBe(200)
    expect((await prisma.session.findUniqueOrThrow({ where: { id: s.session.id } })).updatedAt.getTime()).toBe(read.updatedAt.getTime())

    const since = { headers: { 'if-unmodified-since': read.updatedAt.toISOString() } }
    expect((await api(alice, 'PUT', `/api/sessions/${s.session.id}`, castBody(s, [{ characterId: s.aube.id, participantId: s.lea.id }]), since)).status).toBe(200)
  })
})
