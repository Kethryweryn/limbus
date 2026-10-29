import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { itemInclude } from '~/server/utils/items'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const idOrSlug = requireRouterParam(event, 'id')

  const item = await prisma.item.findFirst({
    where: await gameScopedWhere(event, {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    }),
    include: itemInclude
  })

  if (!item) {
    throw createError({ statusCode: 404, message: 'Objet introuvable' })
  }

  return item
})
