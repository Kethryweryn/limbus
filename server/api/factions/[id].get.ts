import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  return await prisma.faction.findUnique({
    where: { id },
    include: {
      game: true,
      characters: {
        orderBy: { name: 'asc' }
      }
    }
  })
})
