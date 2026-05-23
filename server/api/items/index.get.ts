import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { itemInclude } from '~/server/utils/items'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  return await prisma.item.findMany({
    orderBy: { updatedAt: 'desc' },
    include: itemInclude
  })
})
