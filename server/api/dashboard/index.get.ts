import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const now = new Date()

  const [
    gamesCount,
    totalParticipantsCount,
    participantsWhoPlayedCount,
    neverCastParticipantsCount,
    nextSession,
    games
  ] = await Promise.all([
    prisma.game.count(),
    prisma.participant.count(),
    prisma.participant.count({
      where: {
        assignments: {
          some: {
            session: {
              date: { lt: now },
              status: { not: 'cancelled' }
            }
          }
        }
      }
    }),
    prisma.participant.count({
      where: {
        assignments: { none: {} }
      }
    }),
    prisma.session.findFirst({
      where: {
        date: { gte: now },
        status: { not: 'cancelled' }
      },
      orderBy: { date: 'asc' },
      include: {
        game: true,
        location: true,
        assignments: {
          include: {
            character: true
          }
        }
      }
    }),
    prisma.game.findMany({
      orderBy: { title: 'asc' },
      include: {
        _count: {
          select: { sessions: true }
        }
      }
    })
  ])

  const pjAssignments = nextSession?.assignments.filter((assignment) => assignment.character?.type !== 'pnj') || []
  const castAssigned = pjAssignments.filter((assignment) => Boolean(assignment.participantId)).length
  const castTotal = pjAssignments.length

  return {
    nextSession: nextSession
      ? {
          id: nextSession.id,
          name: nextSession.name,
          date: nextSession.date,
          status: nextSession.status,
          game: {
            id: nextSession.game.id,
            title: nextSession.game.title
          },
          location: nextSession.location
            ? {
                id: nextSession.location.id,
                name: nextSession.location.name,
                address: nextSession.location.address
              }
            : null,
          cast: {
            assigned: castAssigned,
            total: castTotal,
            percent: castTotal ? Math.round((castAssigned / castTotal) * 100) : 0
          }
        }
      : null,
    stats: {
      gamesCount,
      totalParticipantsCount,
      participantsWhoPlayedCount,
      neverCastParticipantsCount,
      sessionsByGame: games.map((game) => ({
        id: game.id,
        title: game.title,
        sessionsCount: game._count.sessions
      }))
    }
  }
})
