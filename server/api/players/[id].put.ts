import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { playerSchema, readZodBody } from '~/server/utils/schemas'
import { exposePlayerGames, playerGameLinksInclude } from '~/server/utils/players'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, playerSchema)
  const { name, email, phone, notes, gameIds, published } = body
  const uniqueGameIds = [...new Set(gameIds)]

  const existingLinks = await prisma.playerGame.findMany({
    where: { playerId: id },
    select: { gameId: true }
  })
  const existingGameIds = new Set(existingLinks.map((link) => link.gameId))
  const nextGameIds = new Set(uniqueGameIds)

  const gameIdsToRemove = [...existingGameIds].filter((gameId) => !nextGameIds.has(gameId))
  const gameIdsToAdd = uniqueGameIds.filter((gameId) => !existingGameIds.has(gameId))

  const player = await prisma.player.update({
    where: { id },
    data: {
      name,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      gameLinks: {
        deleteMany: gameIdsToRemove.map((gameId) => ({ gameId })),
        create: gameIdsToAdd.map((gameId) => ({ gameId }))
      },
      published: published ?? true
    },
    include: playerGameLinksInclude
  })

  return exposePlayerGames(player)
})
