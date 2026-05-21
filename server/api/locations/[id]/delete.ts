import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  await prisma.session.updateMany({
    where: { locationId: id },
    data: { locationId: null }
  })

  return await prisma.location.delete({
    where: { id }
  })
})
