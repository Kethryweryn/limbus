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

describe('adresse stable de la page publique (US-045)', () => {
  it('redirige un ancien slug vers le nouveau, sauf s’il est repris ou si la page n’existe plus', async () => {
    const game = await publicGame()
    const oldSlug = game.slug
    const renamed = await api(alice, 'PUT', `/api/games/${game.id}`, { title: `Renommé ${game.id}` })
    expect(renamed.status, JSON.stringify(renamed.body)).toBe(200)
    const newSlug = (renamed.body as { slug: string }).slug
    expect(newSlug).not.toBe(oldSlug)

    expect((await api(null, 'GET', `/api/public/games/${oldSlug}`)).body).toEqual({ redirectSlug: newSlug })
    expect((await api(null, 'GET', `/api/public/games/${newSlug}`)).body).toMatchObject({ slug: newSlug })

    // Revenir à l'ancien titre reprend l'ancien slug, sans boucle
    const back = await api(alice, 'PUT', `/api/games/${game.id}`, { title: game.title })
    expect((back.body as { slug: string }).slug).toBe(oldSlug)
    expect((await api(null, 'GET', `/api/public/games/${oldSlug}`)).body).toMatchObject({ slug: oldSlug })
    expect((await api(null, 'GET', `/api/public/games/${newSlug}`)).body).toEqual({ redirectSlug: oldSlug })

    // Dépublié : l'ancienne adresse répond comme une page absente
    await api(alice, 'PUT', `/api/games/${game.id}`, { publicPage: false })
    expect((await api(null, 'GET', `/api/public/games/${newSlug}`)).status).toBe(404)
  })

  it('un ancien slug repris par un autre jeu sert ce jeu', async () => {
    const game = await publicGame()
    const oldSlug = game.slug
    await api(alice, 'PUT', `/api/games/${game.id}`, { title: `Autre titre ${game.id}` })
    await prisma.game.update({ where: { id: game.id }, data: { slug: `${oldSlug}-ailleurs` } })
    const other = await publicGame({ slug: oldSlug, title: 'Le nouveau venu' })
    expect((await api(null, 'GET', `/api/public/games/${oldSlug}`)).body).toMatchObject({ title: other.title })
  })
})

