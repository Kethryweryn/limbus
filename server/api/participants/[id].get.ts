import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'
import { exposeParticipantGames, participantGameLinksInclude } from '~/server/utils/participants'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const idOrSlug = getRouterParam(event, 'id')
  if (!idOrSlug) {
    throw createError({ statusCode: 400, message: 'Paramètre manquant' })
  }

  const gameIds = await accessibleGameIds(event)
  const participant = await prisma.participant.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    },
    include: participantGameLinksInclude(gameIds)
  })

  if (!participant) {
    throw createError({ statusCode: 404, message: 'Participant introuvable' })
  }
  if (gameIds !== null && !participant.gameLinks.length) {
    throw createError({ statusCode: 403, message: 'Participant inaccessible' })
  }

  return exposeParticipantGames(participant)
})



