import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accessibleGameIds, queryGameFilter } from '~/server/utils/gameAccess'
import { exposeParticipantsGames, participantGameLinksInclude } from '~/server/utils/participants'
import { byName, withGameValuesIn } from '~/server/utils/participantValues'

// ?gameId= limite la liste aux participants d'un jeu accessible (invitations au vivier, US-117)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameIds = await accessibleGameIds(event)
  const { gameId } = queryGameFilter(event)
  const listedGameIds = gameId ? (gameIds ?? [gameId]).filter((id) => id === gameId) : gameIds
  const participants = await prisma.participant.findMany({
    where: listedGameIds === null
      ? undefined
      : { gameLinks: { some: { gameId: { in: listedGameIds } } } },
    include: participantGameLinksInclude(gameIds)
  })

  // Tri par le nom que voit l'équipe (ADR-0086) ; la liste d'un jeu donne le nom de ce jeu
  const exposed = exposeParticipantsGames(participants)
  if (gameId) await withGameValuesIn(exposed, gameId)
  return exposed.sort(byName)
})



