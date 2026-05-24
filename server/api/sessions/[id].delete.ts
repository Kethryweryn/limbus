import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireSessionAccess(event, id)

  await prisma.sessionAssignment.deleteMany({
    where: { sessionId: id }
  })

  await prisma.session.delete({
    where: { id }
  })

  return { success: true }
})
