import { prisma } from '~/server/utils/prisma'

type SessionParticipantRole = 'participant' | 'organizer' | 'npc'

export function normalizeAssignments(assignments: Array<{
  characterId: string
  participantId?: string | null
  photoUrl?: string | null
  notes?: string | null
}> | undefined) {
  if (!Array.isArray(assignments)) return []

  const seen = new Set<string>()
  const normalized: Array<{
    characterId: string
    participantId: string | null
    photoUrl: string | null
    notes: string | null
  }> = []

  for (const assignment of assignments) {
    if (!assignment.characterId || seen.has(assignment.characterId)) continue

    seen.add(assignment.characterId)
    normalized.push({
      characterId: assignment.characterId,
      participantId: assignment.participantId || null,
      photoUrl: assignment.photoUrl || null,
      notes: assignment.notes || null
    })
  }

  return normalized
}

export function normalizeSessionParticipants(participants: Array<{
  participantId: string
  role: SessionParticipantRole
}> | undefined, assignments: ReturnType<typeof normalizeAssignments>) {
  const normalized = new Map<string, { participantId: string, role: SessionParticipantRole }>()

  for (const participant of Array.isArray(participants) ? participants : []) {
    if (!participant.participantId) continue
    normalized.set(`${participant.participantId}:${participant.role}`, {
      participantId: participant.participantId,
      role: participant.role
    })
  }

  for (const assignment of assignments) {
    if (!assignment.participantId) continue

    const hasSessionRole = ['participant', 'organizer', 'npc'].some((role) =>
      normalized.has(`${assignment.participantId}:${role}`)
    )
    if (!hasSessionRole) {
      normalized.set(`${assignment.participantId}:participant`, {
        participantId: assignment.participantId,
        role: 'participant'
      })
    }
  }

  return [...normalized.values()]
}

export async function assertSessionCastRules(
  gameId: string,
  sessionParticipants: ReturnType<typeof normalizeSessionParticipants>,
  assignments: ReturnType<typeof normalizeAssignments>
) {
  const participantIds = [...new Set([
    ...sessionParticipants.map((participant) => participant.participantId),
    ...assignments
      .map((assignment) => assignment.participantId)
      .filter((participantId): participantId is string => Boolean(participantId))
  ])]

  if (participantIds.length) {
    const registeredParticipants = await prisma.participant.count({
      where: {
        id: { in: participantIds },
        gameLinks: { some: { gameId } }
      }
    })

    if (registeredParticipants !== participantIds.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Un participant assigné n’est pas inscrit au jeu de la session'
      })
    }
  }

  const characterIds = [...new Set(assignments.map((assignment) => assignment.characterId))]
  if (!characterIds.length) return

  const characters = await prisma.character.findMany({
    where: {
      id: { in: characterIds },
      gameId
    },
    select: {
      id: true,
      type: true
    }
  })
  const charactersById = new Map(characters.map((character) => [character.id, character]))

  if (characters.length !== characterIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Un personnage assigné n’appartient pas au jeu de la session'
    })
  }

  const pnjCastableParticipantIds = new Set(
    sessionParticipants
      .filter((participant) => participant.role === 'organizer' || participant.role === 'npc')
      .map((participant) => participant.participantId)
  )

  for (const assignment of assignments) {
    if (!assignment.participantId) continue

    const character = charactersById.get(assignment.characterId)
    if (character?.type === 'pnj' && !pnjCastableParticipantIds.has(assignment.participantId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Un rôle PNJ ne peut être assigné qu’à un organisateur ou un PNJ de session'
      })
    }
  }
}
