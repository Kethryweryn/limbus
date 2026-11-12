// US-160, US-162 : un seul vivier par jeu, sessions ouvertes à la pré-inscription (SPEC-018, R1, R2, R6, R8)
import { labelled } from '../sessionLabel'
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, errorMessage } from './api'
import { createTestPrisma } from './db'
import { createPool } from './pool'
import { withFicheValues } from '../fiche'

const { alice } = inject('world').users
const prisma = createTestPrisma()
let counter = 0

type Period = ApiResponse<'/api/registration-periods', 'post'>
type Selection = ApiResponse<'/api/registration-periods/:id/selection'>

afterAll(async () => {
  await prisma.$disconnect()
})

// Un jeu d'Alice sans vivier, avec deux sessions et trois personnages, dont deux PJ
async function aliceGame() {
  const key = `inscriptions-${++counter}-${Date.now()}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  await prisma.character.createMany({
    data: [
      { name: 'PJ 1', slug: `pj1-${key}`, gameId: game.id, type: 'pj' },
      { name: 'PJ 2', slug: `pj2-${key}`, gameId: game.id, type: 'pj' },
      { name: 'PNJ', slug: `pnj-${key}`, gameId: game.id, type: 'pnj' }
    ]
  })
  const first = await labelled(prisma, await prisma.session.create({ data: { slug: `mars-${key}`, gameId: game.id, date: new Date(Date.now() + 30 * 86_400_000) } }))
  const second = await labelled(prisma, await prisma.session.create({ data: { slug: `avril-${key}`, gameId: game.id, date: new Date(Date.now() + 60 * 86_400_000) } }))
  return { game, first, second }
}

const settings = (period: { id: string }, sessionId: string, body: Record<string, unknown>) =>
  api(alice, 'PUT', `/api/registration-periods/${period.id}/sessions/${sessionId}`, body)
const offered = async (publicId: string) => (await fetch(`${inject('baseUrl')}/api/public/periods/${publicId}`, { headers: { 'x-forwarded-for': `10.41.0.${++counter % 250}` } }).then((response) => response.json()) as { sessions: Array<{ id: string }> }).sessions.map((session) => session.id)

describe('un seul vivier par jeu (R1)', () => {
  it('crée le vivier en brouillon, sans sessions ouvertes', async () => {
    const { game } = await aliceGame()
    const response = await api(alice, 'POST', '/api/registration-periods', { gameId: game.id })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const period = bodyOf<Period>(response)
    expect(period).toMatchObject({ state: 'draft', responseDelayDays: 7 })
    expect(period.publicId).toMatch(/^[\w-]{8}$/)
  })

  it('refuse un second vivier, même créé en même temps', async () => {
    const { game } = await aliceGame()
    const statuses = (await Promise.all([1, 2, 3].map(() => api(alice, 'POST', '/api/registration-periods', { gameId: game.id }))))
      .map((response) => response.status).sort()
    expect(statuses).toEqual([200, 409, 409])
    expect(await prisma.registrationPeriod.count({ where: { gameId: game.id } })).toBe(1)

    const refused = await api(alice, 'POST', '/api/registration-periods', { gameId: game.id })
    expect(errorMessage(refused)).toContain('déjà un vivier')
  })

  it('une modification partielle garde l’état et le délai ; on ouvre et on ferme à la main (R2)', async () => {
    const { game } = await aliceGame()
    const created = bodyOf<Period>(await api(alice, 'POST', '/api/registration-periods', { gameId: game.id, state: 'open', responseDelayDays: 12 }))

    const replay = await api(alice, 'PUT', `/api/registration-periods/${created.id}`, { gameId: game.id, replayPolicy: 'flagged' })
    expect(replay.status, JSON.stringify(replay.body)).toBe(200)
    expect(replay.body).toMatchObject({ state: 'open', responseDelayDays: 12, replayPolicy: 'flagged', publicId: created.publicId })

    const closed = await api(alice, 'PUT', `/api/registration-periods/${created.id}`, { gameId: game.id, state: 'closed' })
    expect(closed.body).toMatchObject({ state: 'closed', responseDelayDays: 12 })
  })

  it('un vivier avec des personnes ne se supprime pas ; vide, si, et les sessions restent', async () => {
    const pool = await createPool(prisma, alice.id)
    expect((await api(alice, 'DELETE', `/api/registration-periods/${pool.period.id}`)).status).toBe(200)
    expect(await prisma.registrationPeriodSession.count({ where: { periodId: pool.period.id } })).toBe(0)
    expect(await prisma.session.count({ where: { gameId: pool.game.id } })).toBe(2)
  })

  it('la suppression du jeu emporte son vivier', async () => {
    const pool = await createPool(prisma, alice.id)
    // Seul un jeu archivé se supprime (US-207)
    await prisma.game.update({ where: { id: pool.game.id }, data: { published: false } })
    expect((await api(alice, 'DELETE', `/api/games/${pool.game.id}`)).status).toBe(200)
    expect(await prisma.registrationPeriod.findUnique({ where: { id: pool.period.id } })).toBeNull()
  })
})

describe('ouvrir une session à la pré-inscription (R6, R8)', () => {
  it('une session ouverte est proposée au vivier, avec autant de places que de PJ', async () => {
    const { game, first, second } = await aliceGame()
    const period = bodyOf<Period>(await api(alice, 'POST', '/api/registration-periods', { gameId: game.id, state: 'open' }))
    expect(await offered(period.publicId)).toEqual([])

    expect((await settings(period, first.id, { open: true })).status).toBe(200)
    expect(await offered(period.publicId)).toEqual([first.id])

    const overview = bodyOf<Selection>(await api(alice, 'GET', `/api/registration-periods/${period.id}/selection`))
    expect(overview.sessions.map((session) => [session.id, session.seats, session.offered])).toEqual([[first.id, 2, true], [second.id, 2, false]])
  })

  it('une session terminée, annulée, passée ou sans date ne s’ouvre pas', async () => {
    const { game, first, second } = await aliceGame()
    const period = bodyOf<Period>(await api(alice, 'POST', '/api/registration-periods', { gameId: game.id, state: 'open' }))
    await prisma.session.update({ where: { id: first.id }, data: { status: 'cancelled' } })
    expect((await settings(period, first.id, { open: true })).status).toBe(409)
    await prisma.session.update({ where: { id: first.id }, data: { status: 'completed' } })
    expect((await settings(period, first.id, { open: true })).status).toBe(409)
    await prisma.session.update({ where: { id: second.id }, data: { date: null } })
    const undated = await settings(period, second.id, { open: true })
    expect(undated.status).toBe(409)
    expect(errorMessage(undated)).toContain('datée et à venir')
    await prisma.session.update({ where: { id: second.id }, data: { date: new Date('2020-01-01') } })
    expect((await settings(period, second.id, { open: true })).status).toBe(409)
  })

  it('une session d’un autre jeu est refusée', async () => {
    const pool = await createPool(prisma, alice.id)
    const other = await createPool(prisma, alice.id)
    expect((await settings(pool.period, other.sessions[0]!.id, { open: true })).status).toBe(400)
  })

  it('date passée ou session annulée : elle n’est plus proposée, sans autre action', async () => {
    const pool = await createPool(prisma, alice.id)
    const [first, second] = pool.sessions as [typeof pool.sessions[number], typeof pool.sessions[number]]
    expect((await offered(pool.key)).sort()).toEqual([first.id, second.id].sort())
    await prisma.session.update({ where: { id: first.id }, data: { date: new Date('2020-01-01') } })
    await prisma.session.update({ where: { id: second.id }, data: { status: 'cancelled' } })
    expect(await offered(pool.key)).toEqual([])
  })

  it('retirer la date d’une session ouverte la referme', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1 })
    const session = pool.sessions[0]!
    const current = await labelled(prisma, await prisma.session.findUniqueOrThrow({ where: { id: session.id } }))
    const updated = await api(alice, 'PUT', `/api/sessions/${session.id}`, {
      name: current.label, gameId: pool.game.id, status: 'scheduled', date: null, updatedAt: current.updatedAt.toISOString(), participants: [], assignments: []
    })
    expect(updated.status, JSON.stringify(updated.body)).toBe(200)
    expect(await prisma.registrationPeriodSession.findUniqueOrThrow({ where: { sessionId: session.id } })).toMatchObject({ open: false })
  })

  it('refermer ne retire aucune pré-inscription, et le casting continue', async () => {
    const pool = await createPool(prisma, alice.id, { sessions: 1, seats: 1 })
    const session = pool.sessions[0]!
    const participant = await withFicheValues(prisma.participant.create({ data: { slug: `lou-${pool.key}`, email: `lou-${pool.key}@example.test`, gameLinks: { create: { gameId: pool.game.id , name: 'Lou' } } } }), { name: 'Lou' })
    const registration = await prisma.registration.create({
      data: { gameId: pool.period.gameId, periodId: pool.period.id, participantId: participant.id, status: 'received', source: 'form', email: participant.email!, sessionLines: { create: { sessionId: session.id, status: 'preregistered', answer: 'available' } } }
    })
    expect((await settings(pool.period, session.id, { open: false })).status).toBe(200)
    expect(await offered(pool.key)).toEqual([])
    expect(await prisma.registrationSession.count({ where: { sessionId: session.id, status: 'preregistered' } })).toBe(1)
    expect((await api(alice, 'POST', `/api/registrations/${registration.id}/selection`, { action: 'retain', sessionId: session.id })).status).toBe(200)
  })

  it('le mode de sélection se règle par session, sans toucher au reste', async () => {
    const pool = await createPool(prisma, alice.id)
    const session = pool.sessions[0]!
    expect((await settings(pool.period, session.id, { selectionMode: 'mixed', organizerPicks: 2, waitlistSize: 3 })).status).toBe(200)
    expect(await prisma.registrationPeriodSession.findUniqueOrThrow({ where: { sessionId: session.id } })).toMatchObject({ open: true, selectionMode: 'mixed', organizerPicks: 2, waitlistSize: 3 })
    // Une autre session n'en est pas changée
    expect(await prisma.registrationPeriodSession.findUniqueOrThrow({ where: { sessionId: pool.sessions[1]!.id } })).toMatchObject({ selectionMode: 'chosen' })
    expect((await settings(pool.period, session.id, { waitlistSize: -1 })).status).toBe(400)
  })
})
