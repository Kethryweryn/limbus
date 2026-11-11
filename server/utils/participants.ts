import { prisma, type PrismaTx } from '~/server/utils/prisma'
import { deleteUnusedUploads } from '~/server/utils/uploads'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'
import { publicAppUrl } from '~/server/utils/appUrl'
import { REGISTRATION_SESSION_STATUSES, REGISTRATION_STATUSES, SESSION_STATUSES } from '~/utils/domain'
import { latestVisibleValues } from '~/server/utils/participantValues'

type ParticipantWithGameLinks = {
  gameLinks?: Array<{
    createdAt: Date
    notes?: string | null
    name?: string | null
    phone?: string | null
    updatedAt?: Date
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
  // Nom et téléphone du jeu visible le plus récemment modifié (ADR-0086) : gameLinks est déjà filtré
  const { gameLinks, ...rest } = latestVisibleValues(participant)
  // `published` n'a aucun effet sur une fiche : il n'est plus exposé (US-038). L'ancienne note commune non plus (ADR-0040)
  delete (rest as { published?: unknown }).published
  delete (rest as { notes?: unknown }).notes
  return {
    ...rest,
    games: gameLinks?.map((link) => ({
      ...link.game,
      registeredAt: link.createdAt
    })) || [],
    // Notes des seuls jeux accessibles : gameLinks est déjà filtré (US-069)
    gameNotes: Object.fromEntries((gameLinks || []).map((link) => [link.game.id, link.notes ?? null]))
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
/**
 * Retrait d'une personne de jeux (US-035), en deux temps : apply dans la transaction de l'appelant, avec la mise à
 * jour de la fiche ; afterCommit ensuite (fichiers, trombinoscopes), une fois le retrait enregistré.
 */
export async function planParticipantRemoval(participantId: string, gameIds: string[], removedBy: { id: string }) {
  if (!gameIds.length) return { apply: async () => {}, afterCommit: async () => {} }
  const inSessions = { participantId, session: { gameId: { in: gameIds } } }
  const [roles, assignments, responsibilities, attendances] = await Promise.all([
    prisma.sessionParticipant.findMany({ where: inSessions, select: { sessionId: true } }),
    prisma.sessionAssignment.findMany({ where: inSessions, select: { sessionId: true, photoUrl: true } }),
    prisma.timelineEventResponsible.findMany({ where: inSessions, select: { sessionId: true } }),
    prisma.sessionAttendance.findMany({ where: inSessions, select: { sessionId: true } })
  ])
  const sessionIds = [...new Set([...roles, ...assignments, ...responsibilities, ...attendances].map((item) => item.sessionId))]
  const now = new Date()

  const apply = async (tx: PrismaTx) => {
    await tx.participantGame.deleteMany({ where: { participantId, gameId: { in: gameIds } } })
    await tx.sessionParticipant.deleteMany({ where: inSessions })
    await tx.timelineEventResponsible.deleteMany({ where: inSessions })
    await tx.sessionAssignment.updateMany({ where: inSessions, data: { participantId: null, photoUrl: null } })
    await tx.sessionAttendance.deleteMany({ where: inSessions })
    await tx.registration.updateMany({
      where: { participantId, period: { gameId: { in: gameIds } }, status: { not: REGISTRATION_STATUSES.withdrawn } },
      data: { status: REGISTRATION_STATUSES.withdrawn, withdrawnAt: now, withdrawnById: removedBy.id }
    })
    // Sortie du vivier : ses liens ne marchent plus (ADR-0070)
    await tx.registrationLink.deleteMany({ where: { registration: { participantId, period: { gameId: { in: gameIds } } } } })
    // Retirée du jeu, elle l'est de ses sessions à venir ; les sessions passées gardent leur trace
    await tx.registrationSession.updateMany({
      where: {
        registration: { participantId, period: { gameId: { in: gameIds } } },
        session: { status: SESSION_STATUSES.scheduled },
        status: { notIn: [REGISTRATION_SESSION_STATUSES.cancelled, REGISTRATION_SESSION_STATUSES.unavailable] }
      },
      data: { status: REGISTRATION_SESSION_STATUSES.cancelled, cancelledAt: now, cancelledById: removedBy.id, waitlistPosition: null, retainedById: null }
    })
    await tx.sessionAssignment.updateMany({
      where: { reservedRegistration: { participantId, period: { gameId: { in: gameIds } } } },
      data: { reservedRegistrationId: null }
    })
    // L'équipe et le casting de ces sessions ont changé : leur version aussi (ADR-0028)
    if (sessionIds.length) await tx.session.updateMany({ where: { id: { in: sessionIds } }, data: { updatedAt: now } })
  }

  const afterCommit = async () => {
    await deleteUnusedUploads(assignments.map((assignment) => assignment.photoUrl))
    // Après la réponse, comme pour un désistement : l'enregistrement de la fiche n'attend pas les PDF
    regenerateTrombinoscopes(sessionIds).catch((error) =>
      console.error('[retrait d’un jeu] trombinoscopes non régénérés', { error: (error as Error)?.message })
    )
  }

  return { apply, afterCommit }
}

async function regenerateTrombinoscopes(sessionIds: string[]) {
  const withTrombinoscopes = await prisma.sessionTrombinoscope.groupBy({ by: ['sessionId'], where: { sessionId: { in: sessionIds } } })
  for (const { sessionId } of withTrombinoscopes) {
    await generateSessionTrombinoscopes(sessionId, publicAppUrl()).catch((error) =>
      console.error('[retrait d’un jeu] trombinoscopes non régénérés', { sessionId, error: (error as Error)?.message })
    )
  }
}
