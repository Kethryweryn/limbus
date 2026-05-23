import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { exposeParticipantsGames, participantGameLinksInclude } from '~/server/utils/participants'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const participants = await prisma.participant.findMany({
    orderBy: { name: 'asc' },
    include: participantGameLinksInclude
  })

  return exposeParticipantsGames(participants)
})



