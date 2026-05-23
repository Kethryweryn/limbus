import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { exposeParticipantGames, participantGameLinksInclude } from '~/server/utils/participants'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const participant = await prisma.participant.findUnique({
    where: { id },
    include: participantGameLinksInclude
  })

  if (!participant) {
    throw createError({ statusCode: 404, statusMessage: 'Participant introuvable' })
  }

  return exposeParticipantGames(participant)
})



