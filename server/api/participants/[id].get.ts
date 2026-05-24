import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'
import { exposeParticipantGames, participantGameLinksInclude } from '~/server/utils/participants'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const gameIds = await accessibleGameIds(event)
  const participant = await prisma.participant.findFirst({
    where: { id },
    include: participantGameLinksInclude(gameIds)
  })

  if (!participant) {
    throw createError({ statusCode: 404, statusMessage: 'Participant introuvable' })
  }
  if (gameIds !== null && !participant.gameLinks.length) {
    throw createError({ statusCode: 403, statusMessage: 'Participant inaccessible' })
  }

  return exposeParticipantGames(participant)
})



