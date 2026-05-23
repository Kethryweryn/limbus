import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug manquant' })
  }

  return await prisma.intrigue.findUnique({
    where: { slug },
    include: {
      game: true,
      characters: { orderBy: { name: 'asc' } },
      factions: { orderBy: { name: 'asc' } },
      items: { orderBy: { name: 'asc' } }
    }
  })
})
