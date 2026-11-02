import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { aiAuthorizationGamesSchema, readZodBody } from '~/server/utils/schemas'
import { setAuthorizationGames } from '~/server/utils/aiAccess'

// Jeux d'une autorisation, changés depuis le compte (US-123)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { gameIds } = await readZodBody(event, aiAuthorizationGamesSchema)
  await setAuthorizationGames(user.id, requireRouterParam(event, 'id'), gameIds)
  return { success: true }
})
