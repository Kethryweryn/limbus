import { PrismaClient } from '@prisma/client'
import { getAuthUser } from '@/server/utils/auth'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = getAuthUser(event)
  if (!user || user.role !== 'orga') {
    return sendError(event, createError({ statusCode: 403, statusMessage: 'Forbidden' }))
  }

  const id = getRouterParam(event, 'id')!

  const game = await prisma.game.findUnique({
    where: { id }
  })

  if (!game) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Not Found' }))
  }

  return game
})
