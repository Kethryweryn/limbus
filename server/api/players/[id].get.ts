import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { exposePlayerGames, playerGameLinksInclude } from '~/server/utils/players'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const player = await prisma.player.findUnique({
    where: { id },
    include: playerGameLinksInclude
  })

  if (!player) {
    throw createError({ statusCode: 404, statusMessage: 'Joueur introuvable' })
  }

  return exposePlayerGames(player)
})
