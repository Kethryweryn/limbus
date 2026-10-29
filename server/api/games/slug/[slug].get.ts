import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { canAccessAllGames, accessibleGameWhere } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const slug = requireRouterParam(event, 'slug')

  const { user, allGames } = await canAccessAllGames(event)
  const game = await prisma.game.findFirst({
    where: {
      slug,
      ...accessibleGameWhere(user.id, allGames)
    },
    include: {
      // Transfert proposé (US-060) et partage de la personne connectée, pour « Quitter ce jeu » (US-059)
      transferTo: { select: { id: true, name: true } },
      shares: { where: { userId: user.id }, select: { id: true } }
    }
  })
  if (!game) {
    throw createError({ statusCode: 404, message: 'Jeu non trouvé' })
  }

  const { shares, ...rest } = game
  return { ...rest, sharedWithMe: shares.length > 0 }
})
