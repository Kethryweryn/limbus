import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')

  const record = await prisma.character.findFirst({
    where: await gameScopedWhere(event, { id }),
    include: {
      game: true,
      intrigues: {
        orderBy: { updatedAt: 'desc' }
      },
      factions: true
    }
  })
  if (!record) {
    throw createError({ statusCode: 404, message: 'Introuvable' })
  }

  return record
})
