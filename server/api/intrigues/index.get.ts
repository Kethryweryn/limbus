import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  return await prisma.intrigue.findMany({
    where: await gameScopedWhere(event),
    orderBy: { updatedAt: 'desc' },
    include: {
      game: true,
      characters: {
        orderBy: { name: 'asc' }
      },
      factions: {
        orderBy: { name: 'asc' }
      },
      items: {
        orderBy: { name: 'asc' }
      }
    }
  })
})
