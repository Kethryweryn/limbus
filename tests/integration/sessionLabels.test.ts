// SPEC-021, ADR-0083 : le libellé d'une session, calculé par le serveur et gardé à la place du nom
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

async function aliceGame() {
  const key = `libelle-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const location = await prisma.location.create({ data: { name: `Grange ${key}`, slug: `grange-${key}`, gameId: game.id } })
  return { key, game, location }
}

const create = (gameId: string, date: string, locationId?: string) =>
  api(alice, 'POST', '/api/sessions', { gameId, date, locationId: locationId ?? '', status: 'scheduled', participants: [] })
const labels = async (gameId: string) =>
  (await prisma.session.findMany({ where: { gameId }, orderBy: { createdAt: 'asc' }, select: { name: true, slug: true } }))

describe('libellé d’une session (R1, R2, R5)', () => {
  it('donne le jour, puis l’heure et le lieu en cas de doublon, et l’adresse du jeu et de la date', async () => {
    const { game, location } = await aliceGame()
    expect((await create(game.id, '2099-05-15T12:00:00.000Z', location.id)).status).toBe(200)
    expect(await labels(game.id)).toEqual([{ name: 'Session du 15 mai 2099', slug: `${game.slug}-2099-05-15` }])

    expect((await create(game.id, '2099-05-15T12:00:00.000Z')).status).toBe(200)
    const both = await labels(game.id)
    expect(both.map((row) => row.name)).toEqual([`Session du 15 mai 2099, 14 h — ${location.name}`, 'Session du 15 mai 2099, 14 h'])
    expect(both.map((row) => row.slug)).toEqual([`${game.slug}-2099-05-15`, `${game.slug}-2099-05-15-2`])
  })

  it('recalcule les voisines sans changer leur version', async () => {
    const { game } = await aliceGame()
    await create(game.id, '2099-06-01T08:00:00.000Z')
    const first = await prisma.session.findFirstOrThrow({ where: { gameId: game.id }, select: { id: true, updatedAt: true } })
    await create(game.id, '2099-06-01T14:00:00.000Z')
    const after = await prisma.session.findUniqueOrThrow({ where: { id: first.id }, select: { name: true, updatedAt: true } })
    expect(after.name).toBe('Session du 1er juin 2099, 10 h')
    expect(after.updatedAt.getTime()).toBe(first.updatedAt.getTime())
  })

  it('suit le lieu renommé ou supprimé', async () => {
    const { game, location, key } = await aliceGame()
    await create(game.id, '2099-07-01T12:00:00.000Z', location.id)
    await create(game.id, '2099-07-01T12:00:00.000Z')
    const renamed = await api(alice, 'PUT', `/api/locations/${location.id}`, { name: `Grange nord ${key}`, gameId: game.id })
    expect(renamed.status, JSON.stringify(renamed.body)).toBe(200)
    expect((await labels(game.id))[0]!.name).toBe(`Session du 1er juillet 2099, 14 h — Grange nord ${key}`)

    expect((await api(alice, 'DELETE', `/api/locations/${location.id}`)).status).toBe(200)
    expect((await labels(game.id)).map((row) => row.name)).toEqual(['Session du 1er juillet 2099, 14 h', 'Session du 1er juillet 2099, 14 h (2)'])
  })
})
