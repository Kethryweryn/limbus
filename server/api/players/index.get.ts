import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  return await prisma.player.findMany({
    orderBy: { name: 'asc' },
    include: {
      games: {
        orderBy: { title: 'asc' }
      }
    }
  })
})
