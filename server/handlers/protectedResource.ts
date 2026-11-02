import { AI_SCOPES, aiIssuer, aiResourceUrl } from '~/server/utils/aiAuth'

// Ressource protégée (RFC 9728, US-121) : le serveur MCP et son serveur d'autorisation. Route déclarée dans
// nuxt.config (serverHandlers), avec les autres adresses `/.well-known`
export default defineEventHandler((event) => {
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  return {
    resource: aiResourceUrl(),
    resource_name: 'Limbus',
    authorization_servers: [aiIssuer()],
    // Portée minimale demandée par défaut ; l'écriture se choisit sur la page « Autoriser »
    scopes_supported: [AI_SCOPES.read],
    bearer_methods_supported: ['header']
  }
})
