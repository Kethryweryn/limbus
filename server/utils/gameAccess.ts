import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { isAdminMode, requireAuthUser } from '~/server/utils/auth'

export async function requireCurrentUser(event: H3Event) {
  return await requireAuthUser(event)
}

export async function canAccessAllGames(event: H3Event) {
  const user = await requireCurrentUser(event)
  return {
    user,
    allGames: isAdminMode(event, user)
  }
}

export function accessibleGameWhere(userId: string, allGames = false) {
  if (allGames) return {}

  return {
    OR: [
      { ownerId: userId },
      { shares: { some: { userId } } }
    ]
  }
}

export async function accessibleGameIds(event: H3Event) {
  const { user, allGames } = await canAccessAllGames(event)
  if (allGames) return null

  const games = await prisma.game.findMany({
    where: accessibleGameWhere(user.id),
    select: { id: true }
  })

  return games.map((game) => game.id)
}

export async function requireGameAccess(event: H3Event, gameId: string) {
  const { user, allGames } = await canAccessAllGames(event)
  if (allGames) return { user, allGames }

  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      ...accessibleGameWhere(user.id)
    },
    select: { id: true }
  })

  if (!game) {
    throw createError({ statusCode: 403, statusMessage: 'Jeu inaccessible' })
  }

  return { user, allGames }
}

export async function requireGameOwner(event: H3Event, gameId: string) {
  const { user, allGames } = await canAccessAllGames(event)
  if (allGames) return { user, allGames }

  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      ownerId: user.id
    },
    select: { id: true }
  })

  if (!game) {
    throw createError({ statusCode: 403, statusMessage: 'Seul le propriétaire du jeu peut faire cette action' })
  }

  return { user, allGames }
}

export async function requireSessionAccess(event: H3Event, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gameId: true }
  })
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session introuvable' })
  }

  await requireGameAccess(event, session.gameId)
  return session
}

export async function gameScopedWhere(event: H3Event, extraWhere: Record<string, any> = {}) {
  const gameIds = await accessibleGameIds(event)
  if (gameIds === null) return extraWhere

  return {
    AND: [
      extraWhere,
      { gameId: { in: gameIds } }
    ]
  }
}
