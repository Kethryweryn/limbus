import type { Prisma } from '~/generated/prisma/client'
import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { absoluteAppUrl, publicAppUrl } from '~/server/utils/appUrl'
import { fetchPublicResource } from '~/server/utils/remoteImage'
import { touchAccount } from '~/server/utils/auth'
import { RETENTION, TERMS_VERSION } from '~/utils/legal'
import { AI_LOG_ACTIONS } from '~/utils/aiAssistants'

// Serveur d'autorisation OAuth 2.1 pour les assistants d'IA (US-121, SPEC-014 R1 à R6, ADR-0058). Exigences suivies :
// spécification MCP du 28 juillet 2026 (autorisation), OAuth 2.1 (code + PKCE S256, rafraîchissement renouvelé pour un
// client public), RFC 8707 (ressource), RFC 9207 (iss), Client ID Metadata Document

export const AI_LIMITS = {
  requestMinutes: 10,
  codeSeconds: 60,
  accessSeconds: 3600,
  idleDays: RETENTION.aiAuthorizationIdleDays,
  unusedClientHours: 24,
  logDays: RETENTION.aiLogDays,
  cimdCacheMinutes: 60,
  cimdMaxBytes: 10_000
}

export const AI_SCOPES = { read: 'jeux:lecture', write: 'jeux:ecriture' }
export { AI_LOG_ACTIONS }

const DAY_MS = 24 * 60 * 60 * 1000

/** Adresse canonique du serveur MCP (RFC 8707) : l'audience des jetons. */
export const aiResourceUrl = () => absoluteAppUrl('/mcp')
export const aiIssuer = () => publicAppUrl()

export const hashSecret = (value: string) => createHash('sha256').update(value).digest('base64url')
export const newSecret = () => randomBytes(32).toString('base64url')

/** Ressource demandée (RFC 8707) : absente, ou le serveur MCP de Limbus. */
export const isAiResource = (value: string | undefined | null) => !value || value.replace(/\/$/, '') === aiResourceUrl()

export function isLoopbackUri(uri: string) {
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//i.test(uri)
}

const withoutPort = (uri: string) => uri.replace(/^(http:\/\/[^/:]+|http:\/\/\[::1\]):\d+\//i, '$1/')

/** Adresse de retour déclarée par l'assistant : égalité exacte, sauf le port d'une adresse locale (RFC 8252, 7.3). */
export function isRedirectAllowed(redirectUris: string[], uri: string) {
  return redirectUris.some((allowed) => allowed === uri || (isLoopbackUri(allowed) && isLoopbackUri(uri) && withoutPort(allowed) === withoutPort(uri)))
}

export function validRedirectUris(uris: unknown): uris is string[] {
  return Array.isArray(uris) && uris.length > 0 && uris.length <= 10
    && uris.every((uri) => typeof uri === 'string' && uri.length <= 500 && !uri.includes('#') && (uri.startsWith('https://') || isLoopbackUri(uri)))
}

const clientName = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : fallback

/** Identifiant d'assistant qui est l'URL de son document de métadonnées : HTTPS, avec un chemin, sans fragment ni identifiants. */
export function isClientMetadataUrl(clientId: string) {
  const url = URL.parse(clientId)
  return Boolean(url && url.protocol === 'https:' && url.pathname !== '/' && !url.hash && !url.username && !url.password && url.href === clientId)
}

/** Document CIMD lu : il doit se désigner lui-même, déclarer ses adresses de retour et être un client public. */
export function parseClientMetadata(clientId: string, raw: string): { name: string, redirectUris: string[] } | null {
  let doc: Record<string, unknown>
  try {
    doc = JSON.parse(raw)
  } catch {
    return null
  }
  if (!doc || typeof doc !== 'object' || doc.client_id !== clientId || !validRedirectUris(doc.redirect_uris)) return null
  if (doc.token_endpoint_auth_method !== undefined && doc.token_endpoint_auth_method !== 'none') return null
  return { name: clientName(doc.client_name, new URL(clientId).host), redirectUris: doc.redirect_uris }
}

type Fetcher = (url: string, maxBytes: number) => Promise<Buffer | null>

/**
 * Assistant désigné par une demande : document CIMD (relu au plus tard une heure après, hôte public seulement), ou
 * assistant inscrit dynamiquement.
 */
export async function findAiClient(clientId: unknown, fetcher: Fetcher = fetchPublicResource) {
  if (typeof clientId !== 'string' || !clientId || clientId.length > 500) return null
  const known = await prisma.aiClient.findUnique({ where: { id: clientId } })
  if (!isClientMetadataUrl(clientId)) return known?.dynamic ? known : null

  if (known && Date.now() - known.fetchedAt.getTime() < AI_LIMITS.cimdCacheMinutes * 60_000) return known
  const body = await fetcher(clientId, AI_LIMITS.cimdMaxBytes)
  const metadata = body && parseClientMetadata(clientId, body.toString('utf8'))
  if (!metadata) return null
  const data = { name: metadata.name, redirectUris: metadata.redirectUris, fetchedAt: new Date() }
  return await prisma.aiClient.upsert({ where: { id: clientId }, create: { id: clientId, dynamic: false, ...data }, update: data })
}

/** Inscription dynamique (RFC 7591, dépréciée par MCP, gardée pour les assistants sans CIMD). */
export async function registerDynamicClient(body: Record<string, unknown>) {
  if (!validRedirectUris(body.redirect_uris)) return null
  if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== 'none') return null
  return await prisma.aiClient.create({
    data: { id: newSecret(), dynamic: true, name: clientName(body.client_name, 'Assistant'), redirectUris: body.redirect_uris }
  })
}

/** Jeux qu'un compte peut ouvrir à un assistant : les siens, et ceux partagés dont la propriétaire le permet (R5). */
export function aiGameWhere(userId: string) {
  return {
    bequestPending: false,
    OR: [
      { ownerId: userId },
      { aiForCoorganizers: true, shares: { some: { userId } } }
    ]
  }
}

/** Jeux proposés à cocher : ceux du compte, et ceux partagés dont la propriétaire permet les assistants (R5). */
export async function offeredAiGames(userId: string) {
  const games = await prisma.game.findMany({
    where: aiGameWhere(userId),
    orderBy: { title: 'asc' },
    select: { id: true, title: true, ownerId: true }
  })
  return games.map((game) => ({ id: game.id, title: game.title, owned: game.ownerId === userId }))
}

/** Compte qui peut autoriser un assistant, ou dont l'assistant peut encore agir (R3). */
export function aiAccountUsable(user: { disabledAt: Date | null, emailConfirmedAt: Date | null, termsAcceptedVersion: string | null }) {
  return !user.disabledAt && Boolean(user.emailConfirmedAt) && user.termsAcceptedVersion === TERMS_VERSION
}

export function scopeOf(canWrite: boolean) {
  return canWrite ? `${AI_SCOPES.read} ${AI_SCOPES.write}` : AI_SCOPES.read
}

/** Jeton d'accès (une heure) et jeton de rafraîchissement (durée d'inactivité), gardés en empreinte. */
export async function issueAiTokens(authorization: { id: string, canWrite: boolean }) {
  const access = newSecret()
  const refresh = newSecret()
  const now = Date.now()
  await prisma.aiToken.createMany({
    data: [
      { hash: hashSecret(access), authorizationId: authorization.id, kind: 'access', expiresAt: new Date(now + AI_LIMITS.accessSeconds * 1000) },
      { hash: hashSecret(refresh), authorizationId: authorization.id, kind: 'refresh', expiresAt: new Date(now + AI_LIMITS.idleDays * DAY_MS) }
    ]
  })
  return { access_token: access, token_type: 'Bearer', expires_in: AI_LIMITS.accessSeconds, refresh_token: refresh, scope: scopeOf(authorization.canWrite) }
}

const authorizationInclude = {
  user: { select: { id: true, name: true, email: true, role: true, sessionVersion: true, disabledAt: true, emailConfirmedAt: true, termsAcceptedVersion: true, lastSeenAt: true } },
  client: { select: { id: true, name: true } },
  games: { select: { gameId: true } }
} as const satisfies Prisma.AiAuthorizationInclude

async function loadAuthorization(id: string) {
  return await prisma.aiAuthorization.findUnique({ where: { id }, include: authorizationInclude })
}
export type LoadedAiAuthorization = NonNullable<Awaited<ReturnType<typeof loadAuthorization>>>

/** Journal des assistants (R13) : une ligne par jeu concerné, ou une seule sans jeu. */
export async function aiLog(entry: {
  authorization: { id: string, userId: string, client: { name: string } }
  action: string
  gameIds: string[]
  tool?: string
  target?: { type: string, id: string, name: string }
}) {
  const base = {
    userId: entry.authorization.userId,
    clientName: entry.authorization.client.name,
    authorizationId: entry.authorization.id,
    action: entry.action,
    tool: entry.tool,
    targetType: entry.target?.type,
    targetId: entry.target?.id,
    targetName: entry.target?.name
  }
  const gameIds = entry.gameIds.length ? entry.gameIds : [null]
  await prisma.aiLogEntry.createMany({ data: gameIds.map((gameId) => ({ ...base, gameId })) })
}

/** Fin d'une autorisation (R6) : notée au journal, puis effacée avec ses jetons. */
export async function endAiAuthorization(authorization: LoadedAiAuthorization, action: string) {
  await aiLog({ authorization, action, gameIds: authorization.games.map((game) => game.gameId) })
  await prisma.aiAuthorization.deleteMany({ where: { id: authorization.id } })
}

/** Raison de fin d'une autorisation encore en base, ou null si elle vaut toujours. */
export function aiAuthorizationEnd(authorization: LoadedAiAuthorization, now = new Date()) {
  const user = authorization.user
  if (user.sessionVersion !== authorization.sessionVersion || user.disabledAt) return AI_LOG_ACTIONS.sessionsRevoked
  if (now.getTime() - authorization.lastUsedAt.getTime() > AI_LIMITS.idleDays * DAY_MS) return AI_LOG_ACTIONS.expired
  return null
}

/** Autorisation qui vaut encore, ou null ; une autorisation finie est effacée au passage. */
export async function activeAiAuthorization(id: string, now = new Date()) {
  const authorization = await loadAuthorization(id)
  if (!authorization) return null
  const end = aiAuthorizationEnd(authorization, now)
  if (end) {
    await endAiAuthorization(authorization, end)
    return null
  }
  return authorization
}

/** Jeton d'accès présenté au serveur MCP : son autorisation, si le jeton et elle valent encore. */
export async function verifyAiAccessToken(token: string, now = new Date()) {
  const row = await prisma.aiToken.findUnique({ where: { hash: hashSecret(token) } })
  if (!row || row.kind !== 'access' || row.expiresAt <= now) return null
  const authorization = await activeAiAuthorization(row.authorizationId, now)
  if (!authorization) return null
  // Dernier usage : noté au plus une fois par minute
  if (now.getTime() - authorization.lastUsedAt.getTime() > 60_000) {
    await prisma.aiAuthorization.update({ where: { id: authorization.id }, data: { lastUsedAt: now } })
  }
  return { authorization, expiresAt: Math.floor(row.expiresAt.getTime() / 1000) }
}

/**
 * Jeux qu'une autorisation ouvre à cet instant : cochés, encore accessibles au compte, et, pour un jeu partagé, permis par
 * sa propriétaire (R5).
 */
export async function aiAuthorizedGameIds(authorization: LoadedAiAuthorization) {
  const games = await prisma.game.findMany({
    where: { id: { in: authorization.games.map((game) => game.gameId) }, ...aiGameWhere(authorization.userId) },
    select: { id: true }
  })
  return games.map((game) => game.id)
}

/**
 * Pose sur l'événement le compte et l'autorisation d'un assistant : les fonctions serveur de l'interface s'appliquent
 * alors telles quelles, restreintes aux jeux de l'autorisation (`gameAccess`).
 */
export async function bindAiAuthorization(event: H3Event, authorization: LoadedAiAuthorization) {
  const { user } = authorization
  if (!aiAccountUsable(user)) return false
  event.context.authUser = { id: user.id, email: user.email, name: user.name, role: user.role, emailConfirmed: true, termsAccepted: true }
  event.context.aiAuthorization = {
    id: authorization.id,
    userId: authorization.userId,
    clientName: authorization.client.name,
    canWrite: authorization.canWrite,
    gameIds: await aiAuthorizedGameIds(authorization)
  }
  // L'usage par un assistant est une activité du compte (US-112)
  touchAccount(user.id, user.lastSeenAt).catch((error) => console.error('[comptes] activité non notée', { error: (error as Error)?.message }))
  return true
}

declare module 'h3' {
  interface H3EventContext {
    aiAuthorization?: { id: string, userId: string, clientName: string, canWrite: boolean, gameIds: string[] }
    // Version lue donnée par un outil d'écriture (SPEC-014, R10), contrôlée comme l'en-tête If-Unmodified-Since
    writeVersion?: Date
  }
}

/**
 * Ménage, après une connexion : demandes échues, jetons expirés, assistants inscrits jamais servis (24 heures),
 * autorisations finies (inactives 90 jours, sessions coupées), journal de plus d'un an.
 */
export async function purgeAiData(now = new Date()) {
  await prisma.aiAuthorizationRequest.deleteMany({ where: { expiresAt: { lt: now } } })
  await prisma.aiToken.deleteMany({ where: { expiresAt: { lt: now } } })
  await prisma.aiClient.deleteMany({
    where: { dynamic: true, usedAt: null, createdAt: { lt: new Date(now.getTime() - AI_LIMITS.unusedClientHours * 3600_000) } }
  })
  const authorizations = await prisma.aiAuthorization.findMany({ include: authorizationInclude })
  for (const authorization of authorizations) {
    const end = aiAuthorizationEnd(authorization, now)
    if (end) await endAiAuthorization(authorization, end)
  }
  await prisma.aiLogEntry.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - AI_LIMITS.logDays * DAY_MS) } } })
}
