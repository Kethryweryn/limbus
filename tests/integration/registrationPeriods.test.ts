// US-001 : créer et paramétrer une période d'inscription (SPEC-001, R1, R5, R6)
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

// Un jeu d'Alice avec deux sessions et trois personnages, dont deux PJ
async function aliceGame() {
  const key = `inscriptions-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  await prisma.character.createMany({
    data: [
      { name: 'PJ 1', slug: `pj1-${key}`, gameId: game.id, type: 'pj' },
      { name: 'PJ 2', slug: `pj2-${key}`, gameId: game.id, type: 'pj' },
      { name: 'PNJ', slug: `pnj-${key}`, gameId: game.id, type: 'pnj' }
    ]
  })
  const first = await prisma.session.create({ data: { name: 'Mars', slug: `mars-${key}`, gameId: game.id, date: new Date('2027-03-10') } })
  const second = await prisma.session.create({ data: { name: 'Avril', slug: `avril-${key}`, gameId: game.id, date: new Date('2027-04-10') } })
  return { game, first, second }
}

function periodBody(gameId: string, sessions: Array<{ sessionId: string, seats?: number }>, extra: Record<string, unknown> = {}) {
  return { name: 'Printemps', gameId, sessions, ...extra }
}

describe('périodes d’inscription', () => {
  it('crée une période sur plusieurs sessions, avec les places par défaut du nombre de PJ', async () => {
    const { game, first, second } = await aliceGame()

    const response = await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [
      { sessionId: first.id },
      { sessionId: second.id, seats: 5 }
    ]))

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const period = response.body as any
    expect(period).toMatchObject({ scope: 'sessions', entryMode: 'invitation', state: 'draft', effectiveState: 'draft', responseDelayDays: 7 })
    expect(period.publicId).toMatch(/^[\w-]{8}$/)
    expect(period.sessions.map((link: any) => [link.session.name, link.seats])).toEqual([['Mars', 2], ['Avril', 5]])
  })

  it('refuse une session déjà rattachée à une autre période', async () => {
    const { game, first, second } = await aliceGame()
    expect((await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }]))).status).toBe(200)

    const response = await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: second.id }, { sessionId: first.id }]))
    expect(response.status).toBe(409)
    expect((response.body as any).message).toContain('Mars')
    expect(await prisma.registrationPeriod.count({ where: { gameId: game.id } })).toBe(1)
  })

  it('deux créations simultanées sur la même session : une seule réussit', async () => {
    const { game, first } = await aliceGame()
    const statuses = (await Promise.all([1, 2, 3].map(() =>
      api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }]))
    ))).map((response) => response.status).sort()

    expect(statuses).toEqual([200, 409, 409])
  })

  it('modifie la période : sessions, places, clôture et état', async () => {
    const { game, first, second } = await aliceGame()
    const created = (await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }]))).body as any

    const response = await api(alice, 'PUT', `/api/registration-periods/${created.id}`, periodBody(game.id, [
      { sessionId: first.id, seats: 8 },
      { sessionId: second.id, seats: 9 }
    ], { name: 'Printemps 2027', state: 'open', closesAt: '2027-02-01T18:00:00.000Z', responseDelayDays: 10 }))

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ name: 'Printemps 2027', state: 'open', effectiveState: 'open', responseDelayDays: 10, publicId: created.publicId })
    expect((response.body as any).sessions.map((link: any) => link.seats)).toEqual([8, 9])

    // Retirer une session la libère pour une autre période
    await api(alice, 'PUT', `/api/registration-periods/${created.id}`, periodBody(game.id, [{ sessionId: second.id, seats: 9 }]))
    expect((await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }]))).status).toBe(200)
  })

  it('une période ouverte dont la date de clôture passe apparaît clôturée', async () => {
    const { game, first } = await aliceGame()
    const created = (await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }], {
      state: 'open',
      closesAt: '2099-01-01T00:00:00.000Z'
    }))).body as any
    // Le temps passe : la date de clôture est maintenant dans le passé
    await prisma.registrationPeriod.update({ where: { id: created.id }, data: { closesAt: new Date('2020-01-01T00:00:00Z') } })

    const response = await api(alice, 'GET', `/api/registration-periods/${created.id}`)
    expect(response.body).toMatchObject({ state: 'open', effectiveState: 'closed' })
  })

  it('refuse d’ouvrir une période dont la date de clôture est passée', async () => {
    const { game, first } = await aliceGame()
    const response = await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }], {
      state: 'open',
      closesAt: '2020-01-01T00:00:00.000Z'
    }))
    expect(response.status).toBe(400)
    expect((response.body as any).message).toContain('date de clôture est passée')
  })

  it('une modification partielle garde l’état, la clôture et le délai', async () => {
    const { game, first } = await aliceGame()
    const created = (await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }], {
      state: 'open',
      closesAt: '2099-01-01T00:00:00.000Z',
      responseDelayDays: 12
    }))).body as any

    const response = await api(alice, 'PUT', `/api/registration-periods/${created.id}`, { name: 'Renommée', gameId: game.id, sessions: [{ sessionId: first.id, seats: 4 }] })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ name: 'Renommée', state: 'open', closesAt: '2099-01-01T00:00:00.000Z', responseDelayDays: 12 })

    // closesAt explicitement à null retire la date
    const cleared = await api(alice, 'PUT', `/api/registration-periods/${created.id}`, { name: 'Renommée', gameId: game.id, closesAt: null, sessions: [{ sessionId: first.id, seats: 4 }] })
    expect(cleared.body).toMatchObject({ closesAt: null, state: 'open' })
  })

  it('refuse d’ajouter une session annulée ou terminée, avec un message en français', async () => {
    const { game, first, second } = await aliceGame()
    await prisma.session.update({ where: { id: second.id }, data: { status: 'cancelled' } })

    const response = await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }, { sessionId: second.id }]))
    expect(response.status).toBe(400)
    expect((response.body as any).message).toContain('« Avril »')

    const invalid = await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id, seats: 5000 }]))
    expect(invalid.status).toBe(400)
    expect(JSON.stringify(invalid.body)).toContain('Pas plus de 1000 places')
  })

  it('le contexte du jeu liste ses sessions avec leur période et le nombre de PJ', async () => {
    const { game, first, second } = await aliceGame()
    await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }]))

    const response = await api(alice, 'GET', `/api/games/${game.id}/registration-context`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      playableCharacters: 2,
      sessions: [
        { id: first.id, periodName: 'Printemps' },
        { id: second.id, periodId: null }
      ]
    })
  })

  it('supprimer une session ou la période retire seulement le rattachement', async () => {
    const { game, first, second } = await aliceGame()
    const period = (await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }, { sessionId: second.id }]))).body as any

    expect((await api(alice, 'DELETE', `/api/sessions/${first.id}`)).status).toBe(200)
    expect(await prisma.registrationPeriodSession.count({ where: { periodId: period.id } })).toBe(1)

    expect((await api(alice, 'DELETE', `/api/registration-periods/${period.id}`)).status).toBe(200)
    expect(await prisma.registrationPeriodSession.count({ where: { periodId: period.id } })).toBe(0)
    expect(await prisma.session.findUnique({ where: { id: second.id } })).not.toBeNull()
  })

  it('la suppression du jeu emporte ses périodes', async () => {
    const { game, first } = await aliceGame()
    const period = (await api(alice, 'POST', '/api/registration-periods', periodBody(game.id, [{ sessionId: first.id }]))).body as any

    expect((await api(alice, 'DELETE', `/api/games/${game.id}`)).status).toBe(200)
    expect(await prisma.registrationPeriod.findUnique({ where: { id: period.id } })).toBeNull()
  })
})
