import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { canAccessAllGames, accessibleGameWhere } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug manquant' })
  }

  const { user, allGames } = await canAccessAllGames(event)
  const game = await prisma.game.findFirst({
    where: {
      slug,
      ...accessibleGameWhere(user.id, allGames)
    }
  })
  if (!game) {
    throw createError({ statusCode: 404, message: 'Jeu non trouvé' })
  }

  return game
})
