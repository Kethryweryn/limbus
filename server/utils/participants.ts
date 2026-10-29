import { prisma } from '~/server/utils/prisma'
import { deleteUnusedUploads } from '~/server/utils/uploads'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'
import { publicAppUrl } from '~/server/utils/appUrl'
import { REGISTRATION_STATUSES } from '~/utils/domain'

type ParticipantWithGameLinks = {
  gameLinks?: Array<{
    createdAt: Date
    game: {
      id: string
      title: string
      slug: string
      description: string
      noteIntention: string | null
      teaserUrl: string | null
      createdAt: Date
      updatedAt: Date
      published: boolean
    }
  }>
}

export function participantGameLinksInclude(gameIds: string[] | null = null) {
  return {
    gameLinks: {
      where: gameIds === null ? undefined : { gameId: { in: gameIds } },
      orderBy: { createdAt: 'desc' as const },
      include: { game: true }
    }
  }
}

export function exposeParticipantGames<T extends ParticipantWithGameLinks>(participant: T) {
  const { gameLinks, ...rest } = participant
  return {
    ...rest,
    games: gameLinks?.map((link) => ({
      ...link.game,
      registeredAt: link.createdAt
    })) || []
  }
}

export function exposeParticipantsGames<T extends ParticipantWithGameLinks>(participants: T[]) {
  return participants.map(exposeParticipantGames)
}



/**
 * Retrait d'une personne de jeux (US-035) : elle quitte aussi les sessions de ces jeux (équipe, casting,
 * déroulé, présence), et ses inscriptions à leurs périodes passent au statut « retirée ». Ses paiements
 * restent, affichés à part (ADR-0033). Les trombinoscopes déjà générés sont refaits sans elle, sans
 * faire échouer le retrait.
 */
export async function removeParticipantFromGames(participantId: string, gameIds: string[], removedBy: { id: string }) {
  if (!gameIds.length) return
  const inSessions = { participantId, session: { gameId: { in: gameIds } } }
  const [roles, assignments, responsibilities, attendances] = await Promise.all([
    prisma.sessionParticipant.findMany({ where: inSessions, select: { sessionId: true } }),
    prisma.sessionAssignment.findMany({ where: inSessions, select: { sessionId: true, photoUrl: true } }),
    prisma.timelineEventResponsible.findMany({ where: inSessions, select: { sessionId: true } }),
    prisma.sessionAttendance.findMany({ where: inSessions, select: { sessionId: true } })
  ])
  const sessionIds = [...new Set([...roles, ...assignments, ...responsibilities, ...attendances].map((item) => item.sessionId))]
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.participantGame.deleteMany({ where: { participantId, gameId: { in: gameIds } } })
    await tx.sessionParticipant.deleteMany({ where: inSessions })
    await tx.timelineEventResponsible.deleteMany({ where: inSessions })
    await tx.sessionAssignment.updateMany({ where: inSessions, data: { participantId: null, photoUrl: null } })
    await tx.sessionAttendance.deleteMany({ where: inSessions })
    await tx.registration.updateMany({
      where: { participantId, period: { gameId: { in: gameIds } }, status: { not: REGISTRATION_STATUSES.withdrawn } },
      data: { status: REGISTRATION_STATUSES.withdrawn, withdrawnAt: now, withdrawnById: removedBy.id }
    })
    // L'équipe et le casting de ces sessions ont changé : leur version aussi (ADR-0028)
    if (sessionIds.length) await tx.session.updateMany({ where: { id: { in: sessionIds } }, data: { updatedAt: now } })
  })

  await deleteUnusedUploads(assignments.map((assignment) => assignment.photoUrl))
  const withTrombinoscopes = await prisma.sessionTrombinoscope.groupBy({ by: ['sessionId'], where: { sessionId: { in: sessionIds } } })
  for (const { sessionId } of withTrombinoscopes) {
    await generateSessionTrombinoscopes(sessionId, publicAppUrl()).catch((error) =>
      console.error('[retrait d’un jeu] trombinoscopes non régénérés', { sessionId, error: (error as Error)?.message })
    )
  }
}
