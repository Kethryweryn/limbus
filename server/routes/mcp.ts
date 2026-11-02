import { OAuthError, OAuthErrorCode, createMcpHandler, getOAuthProtectedResourceMetadataUrl, requireBearerAuth } from '@modelcontextprotocol/server'
import { aiResourceUrl, bindAiAuthorization, verifyAiAccessToken, type LoadedAiAuthorization } from '~/server/utils/aiAuth'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { buildLimbusMcpServer } from '~/server/mcp/server'

// Serveur MCP de Limbus (US-122, SPEC-014 R1, ADR-0058) : spécification du 28 juillet 2026, sans état, un serveur par
// requête. Seul le jeton Bearer d'un assistant est accepté : le cookie de connexion est retiré avant tout, pour que
// n'importe quel site ne puisse pas écrire au nom de la personne connectée
export default defineEventHandler(async (event) => {
  delete event.node.req.headers.cookie
  if (event.method !== 'POST') {
    setResponseHeader(event, 'allow', 'POST')
    throw createError({ statusCode: 405, message: 'Seul POST est servi.' })
  }

  const resource = new URL(aiResourceUrl())
  let authorization: LoadedAiAuthorization | undefined
  const gate = requireBearerAuth({
    expectedResource: resource,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource),
    verifier: {
      async verifyAccessToken(token) {
        const verified = await verifyAiAccessToken(token)
        if (!verified) throw new OAuthError(OAuthErrorCode.InvalidToken, 'Jeton invalide ou autorisation retirée')
        authorization = verified.authorization
        return {
          token,
          clientId: verified.authorization.clientId,
          scopes: verified.authorization.canWrite ? ['jeux:lecture', 'jeux:ecriture'] : ['jeux:lecture'],
          expiresAt: verified.expiresAt,
          resource
        }
      }
    }
  })

  const request = toWebRequest(event)
  const auth = await gate(request)
  if (auth instanceof Response) return sendWebResponse(event, auth)
  if (!authorization || !await bindAiAuthorization(event, authorization)) {
    throw createError({ statusCode: 403, message: 'Compte inutilisable : confirmez l’adresse et acceptez les conditions en vigueur.' })
  }

  // Limite propre à chaque autorisation (R14) : tous les appels d'un assistant viennent des mêmes machines
  assertRateLimit(event, { name: 'mcp', limit: 120, windowMs: 60 * 1000, keyParts: [authorization.id] })

  const handler = createMcpHandler(() => buildLimbusMcpServer(event))
  return sendWebResponse(event, await handler.fetch(request, { authInfo: auth }))
})
