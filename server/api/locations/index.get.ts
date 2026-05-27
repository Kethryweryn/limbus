import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  return await prisma.location.findMany({
    where: await gameScopedWhere(event),
    orderBy: { createdAt: 'desc' },
    include: {
      game: true
    }
  })
})
