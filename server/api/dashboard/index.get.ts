import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const now = new Date()

  const [
    gamesCount,
    registeredPlayersCount,
    playersWhoPlayedCount,
    totalPlayersCount,
    nextSession,
    games
  ] = await Promise.all([
    prisma.game.count(),
    prisma.player.count({ where: { gameLinks: { some: {} } } }),
    prisma.player.count({
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
    prisma.player.count(),
    prisma.session.findFirst({
      where: {
        date: { gte: now },
        status: { not: 'cancelled' }
      },
      orderBy: { date: 'asc' },
      include: {
        game: true,
        location: true,
        assignments: true
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

  const castAssigned = nextSession?.assignments.filter((assignment) => Boolean(assignment.playerId)).length || 0
  const castTotal = nextSession?.assignments.length || 0

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
      registeredPlayersCount,
      playersWhoPlayedCount,
      neverCastPlayersCount: totalPlayersCount - playersWhoPlayedCount,
      sessionsByGame: games.map((game) => ({
        id: game.id,
        title: game.title,
        sessionsCount: game._count.sessions
      }))
    }
  }
})
