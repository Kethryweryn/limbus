import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { aiAuthorizationDecisionSchema, readZodBody } from '~/server/utils/schemas'
import { decideAuthorizationRequest } from '~/server/utils/aiAuthorizationRequests'

// Décision sur la page « Autoriser » (US-121) : la réponse donne l'adresse de retour vers l'assistant
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const decision = await readZodBody(event, aiAuthorizationDecisionSchema)
  return await decideAuthorizationRequest(user, requireRouterParam(event, 'id'), decision)
})
