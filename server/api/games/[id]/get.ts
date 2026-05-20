import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')!

  const game = await prisma.game.findUnique({
    where: { id }
  })

  if (!game) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Not Found' }))
  }

  return game
})
