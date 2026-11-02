import { prisma } from '~/server/utils/prisma'
import { AI_LIMITS, AI_LOG_ACTIONS, aiAccountUsable, aiIssuer, aiLog, hashSecret, isLoopbackUri, newSecret, offeredAiGames } from '~/server/utils/aiAuth'
import { authorizationRedirect } from '~/server/utils/oauthResponses'
import type { AuthUser } from '~/server/utils/auth'

// Page « Autoriser » (US-121, SPEC-014 R2 à R5) : une demande en attente, lue puis décidée par un compte connecté

async function pendingRequest(id: string) {
  const request = await prisma.aiAuthorizationRequest.findUnique({ where: { id }, include: { client: true } })
  if (!request || request.codeHash || request.expiresAt <= new Date()) {
    throw createError({ statusCode: 404, message: 'Demande d’autorisation expirée : relancez la connexion depuis votre assistant.' })
  }
  return request
}

async function usableAccount(user: AuthUser) {
  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { disabledAt: true, emailConfirmedAt: true, termsAcceptedVersion: true, sessionVersion: true } })
  if (!aiAccountUsable(record)) {
    throw createError({ statusCode: 403, message: 'Acceptez d’abord les conditions d’utilisation en vigueur.' })
  }
  return record
}

export async function describeAuthorizationRequest(user: AuthUser, id: string) {
  const request = await pendingRequest(id)
  await usableAccount(user)
  return {
    client: { name: request.client.name, dynamic: request.client.dynamic },
    redirectHost: new URL(request.redirectUri).host,
    // Adresse locale : n'importe quel programme de l'appareil peut la prendre (spécification MCP, localhost)
    loopbackOnly: isLoopbackUri(request.redirectUri),
    games: await offeredAiGames(user.id)
  }
}

/** Décision : une autorisation et un code (60 secondes), ou un refus ; la réponse donne l'adresse de retour. */
export async function decideAuthorizationRequest(user: AuthUser, id: string, decision: { allow: boolean, canWrite: boolean, gameIds: string[] }) {
  const request = await pendingRequest(id)
  const account = await usableAccount(user)
  const back = (params: Record<string, string>) => authorizationRedirect(request.redirectUri, { ...params, state: request.state, iss: aiIssuer() })

  if (!decision.allow) {
    await prisma.aiAuthorizationRequest.deleteMany({ where: { id } })
    return { redirectUrl: back({ error: 'access_denied', error_description: 'Accès refusé par la personne.' }) }
  }

  const allowed = new Set((await offeredAiGames(user.id)).map((game) => game.id))
  const gameIds = [...new Set(decision.gameIds)]
  if (gameIds.some((gameId) => !allowed.has(gameId))) {
    throw createError({ statusCode: 403, message: 'Un des jeux choisis n’est pas ouvert aux assistants.' })
  }

  const code = newSecret()
  const authorization = await prisma.$transaction(async (tx) => {
    const created = await tx.aiAuthorization.create({
      data: {
        userId: user.id,
        clientId: request.clientId,
        canWrite: decision.canWrite,
        sessionVersion: account.sessionVersion,
        games: { create: gameIds.map((gameId) => ({ gameId })) }
      }
    })
    // Une seule décision par demande : la mise à jour échoue si une autre l'a déjà prise
    const { count } = await tx.aiAuthorizationRequest.updateMany({
      where: { id, codeHash: null },
      data: { codeHash: hashSecret(code), authorizationId: created.id, expiresAt: new Date(Date.now() + AI_LIMITS.codeSeconds * 1000) }
    })
    if (!count) throw createError({ statusCode: 409, message: 'Demande déjà traitée.' })
    await tx.aiClient.update({ where: { id: request.clientId }, data: { usedAt: new Date() } })
    return created
  })

  await aiLog({ authorization: { ...authorization, client: request.client }, action: AI_LOG_ACTIONS.authorized, gameIds })
  return { redirectUrl: back({ code }) }
}
