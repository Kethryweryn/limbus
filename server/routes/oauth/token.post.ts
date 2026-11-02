import { createHash } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { oauthError, readOAuthForm } from '~/server/utils/oauthResponses'
import { AI_LOG_ACTIONS, activeAiAuthorization, endAiAuthorization, hashSecret, isAiResource, issueAiTokens } from '~/server/utils/aiAuth'

const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/
const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

// Échange d'un code (PKCE) ou d'un jeton de rafraîchissement (US-121, SPEC-014 R1 et R6). Le rafraîchissement est
// renouvelé à chaque usage ; présenter un jeton déjà renouvelé fait tomber l'autorisation (OAuth 2.1, 4.3.1)
export default defineEventHandler(async (event) => {
  // Large : tous les utilisateurs d'un même assistant arrivent des mêmes adresses, et les codes et jetons (256 bits) ne se
  // devinent pas
  assertRateLimit(event, { name: 'oauth-token', limit: 600, windowMs: 60 * 1000 })
  setResponseHeader(event, 'cache-control', 'no-store')
  const params = await readOAuthForm(event)
  if (!isAiResource(params.resource)) return oauthError(event, 400, 'invalid_target', 'Ressource inconnue.')

  if (params.grant_type === 'authorization_code') {
    const codeHash = hashSecret(params.code || '')
    const request = await prisma.aiAuthorizationRequest.findUnique({ where: { codeHash } })
    // Un code ne sert qu'une fois, réussite ou échec
    if (request) await prisma.aiAuthorizationRequest.deleteMany({ where: { id: request.id } })
    if (!request || !request.authorizationId || request.expiresAt <= new Date()
      || request.clientId !== params.client_id || request.redirectUri !== params.redirect_uri) {
      return oauthError(event, 400, 'invalid_grant', 'Code invalide ou expiré.')
    }
    if (!PKCE_VERIFIER.test(params.code_verifier || '') || s256(params.code_verifier!) !== request.codeChallenge) {
      return oauthError(event, 400, 'invalid_grant', 'Vérification PKCE refusée.')
    }
    const authorization = await activeAiAuthorization(request.authorizationId)
    if (!authorization) return oauthError(event, 400, 'invalid_grant', 'Autorisation retirée.')
    return await issueAiTokens(authorization)
  }

  if (params.grant_type === 'refresh_token') {
    const token = await prisma.aiToken.findUnique({ where: { hash: hashSecret(params.refresh_token || '') } })
    if (!token || token.kind !== 'refresh' || token.expiresAt <= new Date()) {
      return oauthError(event, 400, 'invalid_grant', 'Jeton de rafraîchissement invalide.')
    }
    const authorization = await activeAiAuthorization(token.authorizationId)
    if (!authorization || authorization.clientId !== params.client_id) {
      return oauthError(event, 400, 'invalid_grant', 'Autorisation retirée.')
    }
    if (token.usedAt) {
      await endAiAuthorization(authorization, AI_LOG_ACTIONS.reused)
      return oauthError(event, 400, 'invalid_grant', 'Jeton déjà utilisé : l’autorisation est retirée.')
    }
    // Marqué utilisé d'un seul coup : deux échanges simultanés du même jeton (une relance de l'assistant) n'en renouvellent
    // qu'un, et le second est refusé sans faire tomber l'autorisation
    const { count } = await prisma.aiToken.updateMany({ where: { hash: token.hash, usedAt: null }, data: { usedAt: new Date() } })
    if (!count) return oauthError(event, 400, 'invalid_grant', 'Jeton en cours de renouvellement.')
    return await issueAiTokens(authorization)
  }

  return oauthError(event, 400, 'unsupported_grant_type')
})
