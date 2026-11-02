import { AI_SCOPES, aiIssuer } from '~/server/utils/aiAuth'

// Serveur d'autorisation (RFC 8414, US-121), servi par nuxt.config comme la ressource protégée
export default defineEventHandler((event) => {
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  const issuer = aiIssuer()
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    // Tous les assistants sont des clients publics ; Claude exige « none » pour passer par CIMD
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [AI_SCOPES.read, AI_SCOPES.write],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true
  }
})
