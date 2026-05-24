import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }

  return await prisma.character.findFirst({
    where: await gameScopedWhere(event, { id }),
    include: {
      game: true,
      intrigues: {
        orderBy: { updatedAt: 'desc' }
      },
      factions: true
    }
  })
})
