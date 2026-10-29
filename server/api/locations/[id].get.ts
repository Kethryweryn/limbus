import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const idOrSlug = requireRouterParam(event, 'id')

  const location = await prisma.location.findFirst({
    where: await gameScopedWhere(event, {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    }),
    include: {
      game: true
    }
  })

  if (!location) {
    throw createError({ statusCode: 404, message: 'Lieu introuvable' })
  }

  return location
})
