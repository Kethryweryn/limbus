import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  const location = await prisma.location.findUnique({ where: { id }, select: { gameId: true } })
  if (!location) {
    throw createError({ statusCode: 404, statusMessage: 'Lieu introuvable' })
  }
  await requireGameAccess(event, location.gameId)

  await prisma.session.updateMany({
    where: { locationId: id },
    data: { locationId: null }
  })

  return await prisma.location.delete({
    where: { id }
  })
})
