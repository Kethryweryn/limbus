import { prisma } from '~/server/utils/prisma'

export const itemInclude = {
  game: true,
  locationParticipant: true,
  participants: {
    orderBy: { name: 'asc' as const }
  },
  intrigues: {
    orderBy: { name: 'asc' as const }
  }
}

export async function validateItemRelations(gameId: string, participantIds: string[], intrigueIds: string[], locationParticipantId?: string | null) {
  const allParticipantIds = [...new Set([
    ...participantIds,
    ...(locationParticipantId ? [locationParticipantId] : [])
  ])]

  if (allParticipantIds.length) {
    const count = await prisma.participant.count({
      where: {
        id: { in: allParticipantIds },
        gameLinks: { some: { gameId } }
      }
    })
    if (count !== allParticipantIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Participants invalides pour ce jeu' })
    }
  }

  if (intrigueIds.length) {
    const count = await prisma.intrigue.count({
      where: { id: { in: intrigueIds }, gameId }
    })
    if (count !== intrigueIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Intrigues invalides pour ce jeu' })
    }
  }
}
