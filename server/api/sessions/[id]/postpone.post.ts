import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { readZodBody, sessionPostponeSchema } from '~/server/utils/schemas'
import { postponeSession } from '~/server/utils/sessionLifecycle'
import { requireRouterParam } from '~/server/utils/routeParams'

// Report d'une session sur une nouvelle session (US-022) : une action, jamais mise en file hors ligne
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  const body = await readZodBody(event, sessionPostponeSchema)

  return await postponeSession(session.id, body)
})
