import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  return await prisma.session.findMany({
    orderBy: [{ date: 'asc' }, { name: 'asc' }],
    include: {
      game: true,
      location: true,
      participants: {
        include: {
          participant: true
        }
      },
      assignments: {
        include: {
          character: true,
          participant: true
        },
        orderBy: {
          characterId: 'asc'
        }
      }
    }
  })
})
