import { prisma } from '~/server/utils/prisma'

export function normalizeAssignments(assignments: Array<{
  characterId: string
  playerId?: string | null
  photoUrl?: string | null
  notes?: string | null
}> | undefined) {
  if (!Array.isArray(assignments)) return []

  const seen = new Set<string>()
  const normalized: Array<{
    characterId: string
    playerId: string | null
    photoUrl: string | null
    notes: string | null
  }> = []

  for (const assignment of assignments) {
    if (!assignment.characterId || seen.has(assignment.characterId)) continue

    seen.add(assignment.characterId)
    normalized.push({
      characterId: assignment.characterId,
      playerId: assignment.playerId || null,
      photoUrl: assignment.photoUrl || null,
      notes: assignment.notes || null
    })
  }

  return normalized
}

export async function assertPlayersRegisteredForGame(gameId: string, assignments: ReturnType<typeof normalizeAssignments>) {
  const playerIds = [...new Set(assignments
    .map((assignment) => assignment.playerId)
    .filter((playerId): playerId is string => Boolean(playerId)))]
  if (!playerIds.length) return

  const registeredPlayers = await prisma.player.count({
    where: {
      id: { in: playerIds },
      gameLinks: { some: { gameId } }
    }
  })

  if (registeredPlayers !== playerIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Un joueur assigne n est pas inscrit au jeu de la session'
    })
  }
}
