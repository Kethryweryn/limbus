import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const slug = requireRouterParam(event, 'slug')

  const record = await prisma.intrigue.findFirst({
    where: await gameScopedWhere(event, { slug }),
    include: {
      game: true,
      characters: { orderBy: { name: 'asc' } },
      factions: { orderBy: { name: 'asc' } },
      items: { orderBy: { name: 'asc' } }
    }
  })
  if (!record) {
    throw createError({ statusCode: 404, message: 'Introuvable' })
  }

  return record
})
