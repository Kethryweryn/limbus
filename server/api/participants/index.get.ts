import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'
import { exposeParticipantsGames, participantGameLinksInclude } from '~/server/utils/participants'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameIds = await accessibleGameIds(event)
  const participants = await prisma.participant.findMany({
    where: gameIds === null
      ? undefined
      : { gameLinks: { some: { gameId: { in: gameIds } } } },
    orderBy: { name: 'asc' },
    include: participantGameLinksInclude(gameIds)
  })

  return exposeParticipantsGames(participants)
})



