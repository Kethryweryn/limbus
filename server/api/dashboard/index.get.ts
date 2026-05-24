import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { CHARACTER_TYPES, SESSION_STATUSES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const now = new Date()
  const gameWhere = await gameScopedWhere(event)
  const sessionWhere = await gameScopedWhere(event, {})

  const [
    gamesCount,
    totalParticipantsCount,
    participantsWhoPlayedCount,
    neverCastParticipantsCount,
    nextSession,
    games
  ] = await Promise.all([
    prisma.game.count({ where: gameWhere }),
    prisma.participant.count({
      where: {
        gameLinks: {
          some: {
            game: gameWhere
          }
        }
      }
    }),
    prisma.participant.count({
      where: {
        assignments: {
          some: {
            session: {
              ...sessionWhere,
              date: { lt: now },
              status: { not: SESSION_STATUSES.cancelled }
            }
          }
        }
      }
    }),
    prisma.participant.count({
      where: {
        gameLinks: {
          some: {
            game: gameWhere
          }
        },
        assignments: { none: {} }
      }
    }),
    prisma.session.findFirst({
      where: {
        ...sessionWhere,
        date: { gte: now },
        status: { not: SESSION_STATUSES.cancelled }
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
      where: gameWhere,
      orderBy: { title: 'asc' },
      include: {
        _count: {
          select: { sessions: true }
        }
      }
    })
  ])

  const pjAssignments = nextSession?.assignments.filter((assignment) => assignment.character?.type !== CHARACTER_TYPES.pnj) || []
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
