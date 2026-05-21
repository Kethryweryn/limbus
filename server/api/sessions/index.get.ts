import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  return await prisma.session.findMany({
    orderBy: [{ date: 'asc' }, { name: 'asc' }],
    include: {
      game: true,
      location: true,
      assignments: {
        include: {
          character: true,
          player: true
        },
        orderBy: {
          characterId: 'asc'
        }
      }
    }
  })
})
