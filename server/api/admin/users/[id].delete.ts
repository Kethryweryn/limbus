import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAdmin(event)

  const id = requireRouterParam(event, 'id')
  if (id === currentUser.id) {
    throw createError({ statusCode: 400, message: 'Impossible de supprimer son propre utilisateur' })
  }

  const ownedGamesCount = await prisma.game.count({ where: { ownerId: id } })
  if (ownedGamesCount) {
    throw createError({
      statusCode: 400,
      message: 'Cet utilisateur possède encore des jeux. Transférez-les avant suppression.'
    })
  }

  await prisma.user.delete({ where: { id } })
  return { success: true }
})
