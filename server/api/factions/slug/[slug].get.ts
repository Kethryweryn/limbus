import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const slug = requireRouterParam(event, 'slug')

  const record = await prisma.faction.findFirst({
    where: await gameScopedWhere(event, { slug }),
    include: {
      game: true,
      characters: {
        orderBy: { name: 'asc' }
      },
      intrigues: {
        orderBy: { updatedAt: 'desc' }
      }
    }
  })
  if (!record) {
    throw createError({ statusCode: 404, message: 'Introuvable' })
  }

  return record
})
