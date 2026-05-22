import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      game: true
    }
  })

  if (!location) {
    throw createError({ statusCode: 404, statusMessage: 'Lieu introuvable' })
  }

  return location
})
