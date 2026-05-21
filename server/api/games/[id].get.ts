import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const game = await prisma.game.findUnique({
    where: { id }
  })

  if (!game) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return game
})
