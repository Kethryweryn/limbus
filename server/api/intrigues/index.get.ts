import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireUser(event)

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
