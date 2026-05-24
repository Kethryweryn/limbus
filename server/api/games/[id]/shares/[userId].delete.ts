import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')
  if (!id || !userId) {
    throw createError({ statusCode: 400, statusMessage: 'Paramètre manquant' })
  }
  await requireGameOwner(event, id)

  await prisma.gameShare.deleteMany({
    where: {
      gameId: id,
      userId
    }
  })

  return { success: true }
})
