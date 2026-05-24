import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'
import { exposeParticipantsGames, participantGameLinksInclude } from '~/server/utils/participants'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const gameIds = await accessibleGameIds(event)
  const participants = await prisma.participant.findMany({
    where: gameIds === null
      ? undefined
      : { gameLinks: { some: { gameId: { in: gameIds } } } },
    orderBy: { name: 'asc' },
    include: participantGameLinksInclude
  })

  return exposeParticipantsGames(participants)
})



