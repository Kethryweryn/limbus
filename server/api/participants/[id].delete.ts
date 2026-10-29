import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds, requireParticipantAccess } from '~/server/utils/gameAccess'
import { eraseParticipant } from '~/server/utils/participantPrivacy'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  await requireParticipantAccess(event, id)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'participant', id)
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
