import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const userId = requireRouterParam(event, 'userId')
  await requireGameOwner(event, id)

  await prisma.gameShare.deleteMany({
    where: {
      gameId: id,
      userId
    }
  })

  return { success: true }
})
