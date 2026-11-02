import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere, queryGameFilter } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  return await prisma.faction.findMany({
    where: await gameScopedWhere(event, queryGameFilter(event)),
    orderBy: { updatedAt: 'desc' },
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
})
