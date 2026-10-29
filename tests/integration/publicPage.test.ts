// EPIC-009 : page publique d'un jeu
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

async function publicGame(extra: Record<string, unknown> = {}) {
  const key = `public-${++counter}`
  return await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, publicPage: true, ...extra } })
}

describe('crédit sur la page publique (US-044)', () => {
  it('renvoie le crédit d’une copie, et rien pour un jeu original', async () => {
    const copy = await publicGame({ creditSourceTitle: 'Les Brumes', creditAuthorName: 'Bob' })
    expect((await api(null, 'GET', `/api/public/games/${copy.slug}`)).body).toMatchObject({ creditSourceTitle: 'Les Brumes', creditAuthorName: 'Bob' })
    const original = await publicGame()
    expect((await api(null, 'GET', `/api/public/games/${original.slug}`)).body).toMatchObject({ creditSourceTitle: null, creditAuthorName: null })
  })
})
