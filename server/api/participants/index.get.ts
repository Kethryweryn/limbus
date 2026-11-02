import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accessibleGameIds, queryGameFilter } from '~/server/utils/gameAccess'
import { exposeParticipantsGames, participantGameLinksInclude } from '~/server/utils/participants'

// ?gameId= limite la liste aux participants d'un jeu accessible (invitations d'une période d'inscription, US-117)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameIds = await accessibleGameIds(event)
  const { gameId } = queryGameFilter(event)
  const listedGameIds = gameId ? (gameIds ?? [gameId]).filter((id) => id === gameId) : gameIds
  const participants = await prisma.participant.findMany({
    where: listedGameIds === null
      ? undefined
      : { gameLinks: { some: { gameId: { in: listedGameIds } } } },
    orderBy: { name: 'asc' },
    include: participantGameLinksInclude(gameIds)
  })

  return exposeParticipantsGames(participants)
})



