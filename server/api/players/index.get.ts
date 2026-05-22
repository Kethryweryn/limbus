import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { exposePlayersGames, playerGameLinksInclude } from '~/server/utils/players'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const players = await prisma.player.findMany({
    orderBy: { name: 'asc' },
    include: playerGameLinksInclude
  })

  return exposePlayersGames(players)
})
