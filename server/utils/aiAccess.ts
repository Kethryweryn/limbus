import { prisma } from '~/server/utils/prisma'
import { AI_LOG_ACTIONS, aiGameWhere, aiLog, endAiAuthorization } from '~/server/utils/aiAuth'

// Suivi des assistants (US-123, SPEC-014 R5, R6, R13) : autorisations d'un compte, réglage et journal d'un jeu

const LOG_LIMIT = 200

const logSelect = {
  id: true, createdAt: true, clientName: true, action: true, tool: true, targetType: true, targetName: true,
  game: { select: { id: true, title: true } },
  user: { select: { id: true, name: true } }
} as const

async function effectiveGameIds(userId: string, gameIds: string[]) {
  const games = await prisma.game.findMany({ where: { id: { in: gameIds }, ...aiGameWhere(userId) }, select: { id: true } })
  return new Set(games.map((game) => game.id))
}

/** Autorisations d'un compte, avec leurs jeux ; un jeu coché qui n'est plus ouvert aux assistants est signalé. */
export async function listAccountAuthorizations(userId: string) {
  const authorizations = await prisma.aiAuthorization.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, canWrite: true, createdAt: true, lastUsedAt: true,
      client: { select: { name: true } },
      games: { select: { game: { select: { id: true, title: true } } } }
    }
  })
  const open = await effectiveGameIds(userId, authorizations.flatMap((authorization) => authorization.games.map((link) => link.game.id)))
  return authorizations.map(({ games, ...authorization }) => ({
    ...authorization,
    games: games.map(({ game }) => ({ ...game, open: open.has(game.id) }))
  }))
}

async function ownAuthorization(userId: string, id: string) {
  const authorization = await prisma.aiAuthorization.findFirst({
    where: { id, userId },
    include: { user: true, client: { select: { id: true, name: true } }, games: { select: { gameId: true } } }
  })
  if (!authorization) throw createError({ statusCode: 404, message: 'Autorisation introuvable' })
  return authorization
}

export async function setAuthorizationGames(userId: string, id: string, gameIds: string[]) {
  const authorization = await ownAuthorization(userId, id)
  const wanted = [...new Set(gameIds)]
  const open = await effectiveGameIds(userId, wanted)
  if (wanted.some((gameId) => !open.has(gameId))) {
    throw createError({ statusCode: 403, message: 'Un des jeux choisis n’est pas ouvert aux assistants.' })
  }
  await prisma.$transaction([
    prisma.aiAuthorizationGame.deleteMany({ where: { authorizationId: id } }),
    prisma.aiAuthorizationGame.createMany({ data: wanted.map((gameId) => ({ authorizationId: id, gameId })) })
  ])
  const touched = [...new Set([...authorization.games.map((game) => game.gameId), ...wanted])]
  await aiLog({ authorization, action: AI_LOG_ACTIONS.updated, gameIds: touched })
}

export async function revokeAuthorization(userId: string, id: string) {
  await endAiAuthorization(await ownAuthorization(userId, id), AI_LOG_ACTIONS.revoked)
}

export async function accountAiLog(userId: string) {
  return await prisma.aiLogEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: LOG_LIMIT, select: logSelect })
}

/** Ce que voit la propriétaire d'un jeu : le réglage, les autorisations qui le cochent, le journal du jeu. */
export async function gameAiAccess(gameId: string) {
  const [game, links, log] = await Promise.all([
    prisma.game.findUniqueOrThrow({ where: { id: gameId }, select: { ownerId: true, aiForCoorganizers: true } }),
    prisma.aiAuthorizationGame.findMany({
      where: { gameId },
      select: {
        authorization: {
          select: { id: true, canWrite: true, createdAt: true, lastUsedAt: true, client: { select: { name: true } }, user: { select: { id: true, name: true } } }
        }
      }
    }),
    prisma.aiLogEntry.findMany({ where: { gameId }, orderBy: { createdAt: 'desc' }, take: LOG_LIMIT, select: logSelect })
  ])
  return {
    aiForCoorganizers: game.aiForCoorganizers,
    authorizations: links.map(({ authorization }) => ({
      ...authorization,
      // Celle d'une co-organisatrice n'ouvre le jeu que si le réglage le permet
      open: authorization.user.id === game.ownerId || game.aiForCoorganizers
    })),
    log
  }
}

/** Autorisations et journal du compte, pour l'export (US-123, ADR-0043). */
export async function exportAiData(userId: string) {
  return {
    authorizations: await listAccountAuthorizations(userId),
    log: (await prisma.aiLogEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: logSelect }))
      .map(({ user: _user, ...entry }) => entry)
  }
}
