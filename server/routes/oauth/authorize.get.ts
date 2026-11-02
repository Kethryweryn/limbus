import { prisma } from '~/server/utils/prisma'
import { AI_LIMITS, aiIssuer, findAiClient, isAiResource, isRedirectAllowed } from '~/server/utils/aiAuth'
import { authorizationRedirect } from '~/server/utils/oauthResponses'

const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/

// Demande d'autorisation d'un assistant (US-121, SPEC-014 R1 et R2) : vérifiée, gardée 10 minutes, puis présentée sur
// la page « Autoriser ». Tant que l'assistant ou son adresse de retour ne sont pas sûrs, aucune redirection vers lui
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const param = (name: string) => typeof query[name] === 'string' ? query[name] as string : undefined

  const client = await findAiClient(param('client_id'))
  if (!client) throw createError({ statusCode: 400, message: 'Assistant inconnu : son document de présentation est introuvable ou invalide.' })
  const redirectUri = param('redirect_uri')
  if (!redirectUri || !isRedirectAllowed(client.redirectUris, redirectUri)) {
    throw createError({ statusCode: 400, message: 'Adresse de retour non déclarée par l’assistant.' })
  }

  const state = param('state')
  const back = (error: string, description: string) =>
    sendRedirect(event, authorizationRedirect(redirectUri, { error, error_description: description, state, iss: aiIssuer() }))
  if (param('response_type') !== 'code') return back('unsupported_response_type', 'Seul « code » est accepté.')
  const codeChallenge = param('code_challenge')
  if (param('code_challenge_method') !== 'S256' || !codeChallenge || !PKCE_CHALLENGE.test(codeChallenge)) {
    return back('invalid_request', 'PKCE S256 exigé.')
  }
  if (!isAiResource(param('resource'))) return back('invalid_target', 'Ressource inconnue.')

  const request = await prisma.aiAuthorizationRequest.create({
    data: {
      clientId: client.id,
      redirectUri,
      state: state?.slice(0, 500),
      codeChallenge,
      expiresAt: new Date(Date.now() + AI_LIMITS.requestMinutes * 60_000)
    }
  })
  return sendRedirect(event, `/autoriser/${request.id}`)
})
