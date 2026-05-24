import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { itemInclude } from '~/server/utils/items'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  return await prisma.item.findMany({
    where: await gameScopedWhere(event),
    orderBy: { updatedAt: 'desc' },
    include: itemInclude
  })
})
