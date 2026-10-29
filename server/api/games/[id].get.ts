import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')

  await requireGameAccess(event, id)

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      shares: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } }
      }
    }
  })

  if (!game) {
    throw createError({ statusCode: 404, message: 'Not Found' })
  }

  return game
})
