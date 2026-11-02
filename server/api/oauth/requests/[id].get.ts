import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { describeAuthorizationRequest } from '~/server/utils/aiAuthorizationRequests'

// Demande d'autorisation d'un assistant, lue par la page « Autoriser » (US-121)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await describeAuthorizationRequest(user, requireRouterParam(event, 'id'))
})
