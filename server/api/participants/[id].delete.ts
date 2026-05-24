import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const allowedGameIds = await accessibleGameIds(event)
  if (allowedGameIds !== null) {
    const links = await prisma.participantGame.findMany({
      where: { participantId: id },
      select: { gameId: true }
    })
    if (links.some((link) => !allowedGameIds.includes(link.gameId))) {
      throw createError({
        statusCode: 403,
        message: 'Ce participant est lié à des jeux auxquels vous n’avez pas accès'
      })
    }
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



