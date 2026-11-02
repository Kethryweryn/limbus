import { assertRateLimit } from '~/server/utils/rateLimit'
import { oauthError, readOAuthJson } from '~/server/utils/oauthResponses'
import { registerDynamicClient } from '~/server/utils/aiAuth'

// Inscription dynamique d'un assistant (RFC 7591, US-121) : dépréciée par MCP, gardée pour les assistants sans CIMD.
// Limitée par adresse, largement : tous les utilisateurs d'un même assistant arrivent des mêmes adresses. Un assistant
// jamais autorisé est effacé au bout de 24 heures (purgeAiData)
export default defineEventHandler(async (event) => {
  assertRateLimit(event, { name: 'oauth-register', limit: 200, windowMs: 60 * 60 * 1000 })
  const client = await registerDynamicClient(await readOAuthJson(event))
  if (!client) return oauthError(event, 400, 'invalid_client_metadata', 'Adresses de retour HTTPS ou locales, client public seulement.')

  setResponseStatus(event, 201)
  return {
    client_id: client.id,
    client_name: client.name,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code']
  }
})
