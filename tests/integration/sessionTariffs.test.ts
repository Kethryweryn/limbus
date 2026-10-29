// EPIC-006 : tarifs d'une session, versements, demandes et relances avec montants (ADR-0032)
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

type Row = { participant: { id: string }, tariff: { id: string } | null, dueCents: number, receivedCents: number, remainingCents: number, state: string, instalments: Array<{ id: string }> }
type Dashboard = { mode: string, rows: Row[], totals: { dueCents: number, receivedCents: number } }

// Une session avec une joueuse (PJ), un PNJ, une orga et une cuisinière
async function team() {
  const key = `tarifs-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const person = (name: string) => prisma.participant.create({
    data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
  })
  const [player, npc, orga, cook] = await Promise.all([person('Joueuse'), person('Pnj'), person('Orga'), person('Cuisine')])
  const character = (name: string, type: string) => prisma.character.create({ data: { name: `${name} ${key}`, slug: `${name.toLowerCase()}-${key}`, gameId: game.id, type } })
  const [hero, guard] = await Promise.all([character('Aube', 'pj'), character('Garde', 'pnj')])
  await prisma.sessionAssignment.createMany({
    data: [
      { sessionId: session.id, characterId: hero.id, participantId: player.id },
      { sessionId: session.id, characterId: guard.id, participantId: npc.id }
    ]
  })
  await prisma.sessionParticipant.createMany({
    data: [
      { sessionId: session.id, participantId: orga.id, role: 'organizer' },
      { sessionId: session.id, participantId: cook.id, role: 'kitchen' }
    ]
  })
  const dashboard = async () => (await api(alice, 'GET', `/api/sessions/${session.id}/payments`)).body as Dashboard
  const row = async (participantId: string) => (await dashboard()).rows.find((item) => item.participant.id === participantId)!
  return { session, player, npc, orga, cook, dashboard, row }
}

describe('tarifs d’une session (US-031)', () => {
  it('reste en mode simple sans tarif, puis met toute l’équipe dans le tableau avec le tarif de son rôle', async () => {
    const t = await team()
    const simple = await t.dashboard()
    expect(simple.mode).toBe('simple')
    expect(simple.rows.map((row) => row.participant.id)).not.toContain(t.cook.id)

    const pj = await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'PJ', amount: 80, defaultRole: 'pj' })
    expect(pj.status, JSON.stringify(pj.body)).toBe(200)
    expect((await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'PNJ', amount: 30.5, defaultRole: 'pnj' })).status).toBe(200)
    // Un seul tarif par rôle
    expect((await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'PJ bis', amount: 70, defaultRole: 'pj' })).status).toBe(409)

    const tariffs = await t.dashboard()
    expect(tariffs.mode).toBe('tariffs')
    const due = Object.fromEntries(tariffs.rows.map((row) => [row.participant.id, [row.dueCents, row.state]]))
    expect(due).toEqual({
      [t.player.id]: [8000, 'unpaid'],
      [t.npc.id]: [3050, 'unpaid'],
      [t.orga.id]: [0, 'nothing_due'],
      [t.cook.id]: [0, 'nothing_due']
    })

    // Une PAF orga payante : un tarif choisi pour cette personne
    const pjId = (pj.body as { id: string }).id
    expect((await api(alice, 'PUT', `/api/sessions/${t.session.id}/payments/${t.orga.id}/tariff`, { tariffId: pjId })).status).toBe(200)
    expect((await t.row(t.orga.id)).dueCents).toBe(8000)
    expect((await api(alice, 'PUT', `/api/sessions/${t.session.id}/payments/${t.orga.id}/tariff`, { tariffId: null })).status).toBe(200)
    expect((await t.row(t.orga.id)).dueCents).toBe(0)
  })
})

describe('versements et état calculé (US-032)', () => {
  it('additionne les versements, calcule l’état, et refuse la case « payé » en mode tarifs', async () => {
    const t = await team()
    await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'PJ', amount: 80, defaultRole: 'pj' })

    const first = await api(alice, 'POST', `/api/sessions/${t.session.id}/payments/${t.player.id}/instalments`, { amount: 30, receivedAt: '2026-10-01' })
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(await t.row(t.player.id)).toMatchObject({ receivedCents: 3000, remainingCents: 5000, state: 'partial' })

    await api(alice, 'POST', `/api/sessions/${t.session.id}/payments/${t.player.id}/instalments`, { amount: 50 })
    expect(await t.row(t.player.id)).toMatchObject({ receivedCents: 8000, remainingCents: 0, state: 'paid' })

    const instalmentId = (first.body as { id: string }).id
    expect((await api(alice, 'DELETE', `/api/sessions/${t.session.id}/payments/${t.player.id}/instalments/${instalmentId}`)).status).toBe(200)
    expect((await t.row(t.player.id)).state).toBe('partial')

    expect((await api(alice, 'PUT', `/api/sessions/${t.session.id}/payments/${t.player.id}`, { paid: true })).status).toBe(409)
    // Une personne hors du tableau ne reçoit pas de versement
    const stranger = await prisma.participant.create({ data: { name: `Inconnue ${t.session.id}`, slug: `inconnue-${t.session.id}` } })
    expect((await api(alice, 'POST', `/api/sessions/${t.session.id}/payments/${stranger.id}/instalments`, { amount: 10 })).status).toBe(400)

    // Une session avec un versement ne se supprime pas
    expect((await api(alice, 'DELETE', `/api/sessions/${t.session.id}`)).status).toBe(409)
  })

  it('l’export RGPD contient le tarif choisi et les versements', async () => {
    const t = await team()
    const reduced = await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'Réduit', amount: 50 })
    await api(alice, 'PUT', `/api/sessions/${t.session.id}/payments/${t.player.id}/tariff`, { tariffId: (reduced.body as { id: string }).id })
    await api(alice, 'POST', `/api/sessions/${t.session.id}/payments/${t.player.id}/instalments`, { amount: 20 })

    const exported = await api(alice, 'GET', `/api/participants/${t.player.id}/export`)
    expect(exported.status).toBe(200)
    expect(JSON.stringify(exported.body)).toContain('"name":"Réduit"')
    expect(JSON.stringify(exported.body)).toContain('"amountCents":2000')
  })
})

describe('places solidaires (US-033)', () => {
  it('rattache soutien et réduit à un tarif de base, et calcule le solde', async () => {
    const t = await team()
    const id = (response: { body: unknown }) => (response.body as { id: string }).id
    const pj = id(await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'PJ', amount: 80, defaultRole: 'pj' }))
    const support = await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'Soutien', amount: 120, baseTariffId: pj })
    expect(support.status, JSON.stringify(support.body)).toBe(200)
    const reduced = id(await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'Réduit', amount: 50, baseTariffId: pj }))
    // Pas de chaîne : un tarif solidaire ne sert pas de base
    expect((await api(alice, 'POST', `/api/sessions/${t.session.id}/tariffs`, { name: 'Chaîne', amount: 10, baseTariffId: id(support) })).status).toBe(400)

    await api(alice, 'PUT', `/api/sessions/${t.session.id}/payments/${t.player.id}/tariff`, { tariffId: id(support) })
    await api(alice, 'PUT', `/api/sessions/${t.session.id}/payments/${t.npc.id}/tariff`, { tariffId: reduced })
    await api(alice, 'POST', `/api/sessions/${t.session.id}/payments/${t.player.id}/instalments`, { amount: 100 })

    const dashboard = (await api(alice, 'GET', `/api/sessions/${t.session.id}/payments`)).body as { solidarity: Record<string, number> }
    expect(dashboard.solidarity).toEqual({
      contributionAssigned: 4000,
      contributionReceived: 2000,
      reductionCost: 3000,
      balanceAssigned: 1000,
      balanceReceived: -1000
    })

    // Supprimer la base retire le lien des tarifs solidaires
    expect((await api(alice, 'DELETE', `/api/sessions/${t.session.id}/tariffs/${pj}`)).status).toBe(200)
    expect(await prisma.sessionTariff.count({ where: { sessionId: t.session.id, baseTariffId: { not: null } } })).toBe(0)
  })
})

