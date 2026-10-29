import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { storageUsedBytes } from '~/server/utils/uploads'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailConfirmedAt: true,
      disabledAt: true,
      storageQuotaMb: true,
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
  // Espace utilisé par compte (US-066)
  return await Promise.all(users.map(async (user) => ({ ...user, storageUsedBytes: await storageUsedBytes(user.id) })))
})
