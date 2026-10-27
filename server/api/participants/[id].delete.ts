import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds, requireParticipantAccess } from '~/server/utils/gameAccess'
import { eraseParticipant } from '~/server/utils/participantPrivacy'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireParticipantAccess(event, id)
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

  const { deletedPhotos } = await eraseParticipant(id)
  return { success: true, deletedPhotos }
})
