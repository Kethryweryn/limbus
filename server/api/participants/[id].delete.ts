import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  await prisma.sessionAssignment.updateMany({
    where: { participantId: id },
    data: { participantId: null }
  })

  await prisma.participant.delete({
    where: { id }
  })

  return { success: true }
})



