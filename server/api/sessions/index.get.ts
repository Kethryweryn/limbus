import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  return await prisma.session.findMany({
    where: await gameScopedWhere(event),
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
