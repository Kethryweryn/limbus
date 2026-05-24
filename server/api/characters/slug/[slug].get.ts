import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug manquant' })
  }

  return await prisma.character.findFirst({
    where: await gameScopedWhere(event, { slug }),
    include: {
      game: true,
      intrigues: {
        orderBy: { updatedAt: 'desc' }
      },
      factions: true
    }
  })
})
