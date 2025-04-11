import { PrismaClient } from '@prisma/client'
import { getAuthUser } from '@/server/utils/auth'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = getAuthUser(event)
  if (!user || user.role !== 'organizer') {
    return sendError(event, createError({ statusCode: 403, statusMessage: 'Forbidden' }))
  }

  const id = getRouterParam(event, 'id')!

  await prisma.game.delete({
    where: { id }
  })

  return { success: true }
})
