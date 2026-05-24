import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      ownedGames: {
        select: { id: true, title: true, slug: true },
        orderBy: { title: 'asc' }
      },
      gameShares: {
        include: {
          game: { select: { id: true, title: true, slug: true } }
        }
      }
    }
  })
})
