import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { revokeAuthorization } from '~/server/utils/aiAccess'

// Retrait d'un assistant (US-123, SPEC-014 R6) : ses jetons ne passent plus
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await revokeAuthorization(user.id, requireRouterParam(event, 'id'))
  return { success: true }
})
