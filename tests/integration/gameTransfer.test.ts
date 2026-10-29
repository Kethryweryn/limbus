// EPIC-012 : quitter un jeu partagé (US-059) et transférer un jeu à une co-organisatrice (US-060)
import { afterAll, describe, expect, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

// Une propriétaire, deux co-organisatrices et une personne sans accès, sur un jeu propre au test
async function sharedGame() {
  const key = `transfert-${++counter}`
  const user = (name: string) => prisma.user.create({ data: { email: `${name}-${key}@example.test`, name: `${name} ${key}`, password: 'non-utilise', role: 'user' } })
  const [owner, coOrga, other, stranger] = await Promise.all([user('owner'), user('coorga'), user('other'), user('stranger')])
  const game = await prisma.game.create({
    data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id, shares: { create: [{ userId: coOrga.id }, { userId: other.id }] } }
  })
  return { owner, coOrga, other, stranger, game }
}

const sharesOf = async (gameId: string) =>
  (await prisma.gameShare.findMany({ where: { gameId }, select: { userId: true } })).map((share) => share.userId).sort()

describe('quitter un jeu partagé (US-059)', () => {
  it('une co-organisatrice quitte le jeu et perd l’accès ; elle ne retire pas une autre', async () => {
    const { coOrga, other, game } = await sharedGame()
    expect((await api(coOrga, 'DELETE', `/api/games/${game.id}/shares/${other.id}`)).status).toBe(403)
    expect((await api(coOrga, 'GET', `/api/games/slug/${game.slug}`)).body).toMatchObject({ sharedWithMe: true })

    expect((await api(coOrga, 'DELETE', `/api/games/${game.id}/shares/${coOrga.id}`)).status).toBe(200)
    expect(await sharesOf(game.id)).toEqual([other.id])
    expect((await api(coOrga, 'GET', `/api/games/slug/${game.slug}`)).status).toBe(404)
  })

  it('la propriétaire n’a pas de partage à quitter', async () => {
    const { owner, game } = await sharedGame()
    expect((await api(owner, 'GET', `/api/games/slug/${game.slug}`)).body).toMatchObject({ sharedWithMe: false })
  })
})

describe('transférer un jeu (US-060)', () => {
  it('la co-organisatrice accepte : elle devient propriétaire, l’ancienne reste co-organisatrice', async () => {
    const { owner, coOrga, other, game } = await sharedGame()
    expect((await api(owner, 'POST', `/api/games/${game.id}/transfer`, { userId: coOrga.id })).status).toBe(200)
    expect((await api(coOrga, 'GET', `/api/games/slug/${game.slug}`)).body).toMatchObject({ transferTo: { id: coOrga.id } })

    // Seule la destinataire accepte
    expect((await api(other, 'POST', `/api/games/${game.id}/transfer/accept`)).status).toBe(404)
    expect((await api(owner, 'POST', `/api/games/${game.id}/transfer/accept`)).status).toBe(404)

    expect((await api(coOrga, 'POST', `/api/games/${game.id}/transfer/accept`)).status).toBe(200)
    expect(await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).toMatchObject({ ownerId: coOrga.id, transferToUserId: null })
    expect(await sharesOf(game.id)).toEqual([other.id, owner.id].sort())
  })

  it('le transfert ne se propose qu’à une co-organisatrice, et par la seule propriétaire', async () => {
    const { owner, coOrga, stranger, game } = await sharedGame()
    expect((await api(owner, 'POST', `/api/games/${game.id}/transfer`, { userId: stranger.id })).status).toBe(400)
    expect((await api(coOrga, 'POST', `/api/games/${game.id}/transfer`, { userId: coOrga.id })).status).toBe(403)
  })

  it('la propriétaire retire sa proposition, la destinataire la refuse', async () => {
    const { owner, coOrga, game } = await sharedGame()
    await api(owner, 'POST', `/api/games/${game.id}/transfer`, { userId: coOrga.id })
    expect((await api(owner, 'DELETE', `/api/games/${game.id}/transfer`)).status).toBe(200)
    expect((await api(coOrga, 'POST', `/api/games/${game.id}/transfer/accept`)).status).toBe(404)

    await api(owner, 'POST', `/api/games/${game.id}/transfer`, { userId: coOrga.id })
    expect((await api(coOrga, 'DELETE', `/api/games/${game.id}/transfer`)).status).toBe(200)
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).transferToUserId).toBeNull()
  })

  it('une proposition tombe quand la destinataire quitte le jeu', async () => {
    const { owner, coOrga, game } = await sharedGame()
    await api(owner, 'POST', `/api/games/${game.id}/transfer`, { userId: coOrga.id })
    expect((await api(coOrga, 'DELETE', `/api/games/${game.id}/shares/${coOrga.id}`)).status).toBe(200)
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).transferToUserId).toBeNull()
  })
})
